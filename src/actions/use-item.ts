"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { TurnEvent } from "@/lib/battle";
import { calculateMaxHp } from "@/lib/stats";
import { hasHealthyBackup } from "@/lib/team";
import { runWildCounterAttack } from "@/lib/wild-counter";
import { nextTurnDeadline } from "@/lib/battle-turn-timer";
import { closeBattleIfIdle } from "@/lib/close-battle-if-idle";

const MAX_LOG_LINES = 20;

export interface UseItemResult {
  /** HP tras la cura, antes del contraataque del rival. */
  healedTo: number;
  healedBy: number;
  itemName: string;
  /** Full Restore también limpia status. */
  statusCured?: boolean;
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
      include: {
        pokemonInstance: {
          include: { species: { include: { evolvesTo: { select: { id: true } } } }, heldItem: true },
        },
        wildSpecies: true,
        wildHeldItem: true,
      },
    }),
    prisma.inventoryItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    }),
  ]);
  if (!battle) return null;
  if (!inventoryItem || inventoryItem.quantity < 1) return null;
  if (await closeBattleIfIdle(battle, locale)) {
    return {
      healedTo: battle.pokemonInstance.currentHp,
      healedBy: 0,
      itemName: inventoryItem.item.name,
      counterAttack: null,
      outcome: "lost",
    };
  }
  const { item } = inventoryItem;
  const healAmount = item.healAmount;
  if (item.type !== "POTION" || healAmount === null) return null;

  const instance = battle.pokemonInstance;
  const maxHp = calculateMaxHp(instance.species.baseHp, instance.level, instance.ptConstitution);
  const healedTo = Math.min(maxHp, instance.currentHp + healAmount);
  const healedBy = healedTo - instance.currentHp;
  // Full Restore en los juegos clásicos también limpia status.
  const curesStatus = item.name.trim().toLowerCase() === "full restore";
  const playerStatusAfterHeal = curesStatus ? null : battle.playerStatus;
  const playerSleepTurnsAfterHeal = curesStatus ? 0 : battle.playerSleepTurns;

  const counter = await runWildCounterAttack({
    ...battle,
    playerStatus: playerStatusAfterHeal,
    playerSleepTurns: playerSleepTurnsAfterHeal,
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
        ? { status: "LOST", log: finalLog, turnDeadlineAt: null, ...counter.statePatch }
        : { log: finalLog, turnDeadlineAt: nextTurnDeadline(), ...counter.statePatch },
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

  // healedTo = HP tras la cura (antes del contraataque). El cliente anima la
  // barra a este valor y después reproduce counterAttack, que baja el HP.
  return {
    healedTo,
    healedBy,
    itemName: item.name,
    statusCured: curesStatus && battle.playerStatus != null,
    counterAttack: counter.counterAttack,
    outcome: lostBattle ? "lost" : mustSwitch ? "fainted" : "continues",
  };
}
