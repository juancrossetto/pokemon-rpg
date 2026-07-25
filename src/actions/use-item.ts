"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { TurnEvent } from "@/lib/battle";
import { calculateMaxHp } from "@/lib/stats";
import { hasHealthyBackup } from "@/lib/team";
import { runWildCounterAttack } from "@/lib/wild-counter";

const MAX_LOG_LINES = 20;

export interface UseItemResult {
  healedTo: number;
  healedBy: number;
  itemName: string;
  counterAttack: TurnEvent | null;
  outcome: "continues" | "lost" | "fainted";
}

export async function applyBattleItem(
  sessionId: string,
  itemId: string,
  locale: string,
): Promise<UseItemResult | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  const [battle, inventoryItem] = await Promise.all([
    prisma.battleSession.findFirst({
      where: { id: sessionId, userId, status: "ACTIVE" },
      include: { pokemonInstance: { include: { species: true } }, wildSpecies: true },
    }),
    prisma.inventoryItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    }),
  ]);
  if (!battle) return null;
  if (!inventoryItem || inventoryItem.quantity < 1) return null;
  const { item } = inventoryItem;
  const healAmount = item.healAmount;
  if (item.type !== "POTION" || healAmount === null) return null;

  const instance = battle.pokemonInstance;
  const maxHp = calculateMaxHp(instance.species.baseHp, instance.level, instance.ptConstitution);
  const healedTo = Math.min(maxHp, instance.currentHp + healAmount);
  const healedBy = healedTo - instance.currentHp;

  const counter = await runWildCounterAttack({
    ...battle,
    pokemonInstance: { ...instance, currentHp: healedTo },
  });

  const playerHp = counter.playerHp;
  const fainted = playerHp <= 0;
  const mustSwitch = fainted && (await hasHealthyBackup(userId, instance.id));
  const lostBattle = fainted && !mustSwitch;
  const finalLog = [...battle.log, `item:${item.name}`].slice(-MAX_LOG_LINES);

  await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { userId_itemId: { userId, itemId } },
      data: { quantity: { decrement: 1 } },
    }),
    prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: playerHp } }),
    prisma.battleSession.update({
      where: { id: battle.id },
      data: lostBattle
        ? { status: "LOST", log: finalLog, ...counter.statePatch }
        : { log: finalLog, ...counter.statePatch },
    }),
    ...(lostBattle
      ? [
          prisma.battleLog.create({
            data: {
              kind: battle.gymId ? ("PVE_GYM" as const) : ("PVE_WILD" as const),
              userId,
              userWon: false,
              gymId: battle.gymId,
            },
          }),
        ]
      : []),
    ...(lostBattle && battle.gymId
      ? [prisma.gymAttempt.create({ data: { userId, gymId: battle.gymId, won: false } })]
      : []),
    ...(lostBattle && battle.gymRunId
      ? [prisma.gymRun.update({ where: { id: battle.gymRunId }, data: { status: "ABANDONED" } })]
      : []),
  ]);

  if (lostBattle && battle.gymId) {
    const { notifyGymResult } = await import("@/lib/notifications");
    await notifyGymResult(userId, battle.gymId, false);
  }

  revalidatePath(`/${locale}/team`);

  return {
    healedTo: playerHp,
    healedBy,
    itemName: item.name,
    counterAttack: counter.counterAttack,
    outcome: lostBattle ? "lost" : mustSwitch ? "fainted" : "continues",
  };
}
