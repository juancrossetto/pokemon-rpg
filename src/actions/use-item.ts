"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveMoveUse, type TurnEvent } from "@/lib/battle";
import { playerCombatantStats, wildCombatantStats } from "@/lib/combatant";
import { calculateMaxHp } from "@/lib/stats";
import { hasHealthyBackup } from "@/lib/team";

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
  const maxHp = calculateMaxHp(instance.species.baseHp, instance.level);
  const healedTo = Math.min(maxHp, instance.currentHp + healAmount);
  const healedBy = healedTo - instance.currentHp;

  // Usar un objeto gasta el turno completo: el salvaje ataca después.
  const wildMoves = await prisma.move.findMany({ where: { id: { in: battle.wildMoveIds } } });
  const wildMove = wildMoves[Math.floor(Math.random() * wildMoves.length)];
  const wildStats = wildCombatantStats(battle.wildSpecies, battle.wildLevel);
  const playerStats = playerCombatantStats(instance.species, instance.level, instance);

  const result = resolveMoveUse(wildStats, playerStats, wildMove);
  const wildName = battle.wildSpecies.name;
  const playerName = instance.nickname ?? instance.species.name;
  let playerHp = healedTo;
  const log = [...battle.log, `Usaste ${item.name}. ${playerName} recuperó ${healedBy} HP.`];
  let counterAttack: TurnEvent | null = null;

  if (result.hit && wildMove.category !== "STATUS") {
    playerHp = Math.max(0, playerHp - result.damage);
    log.push(`${wildName} usó ${wildMove.name} e hizo ${result.damage} de daño.`);
    if (result.effectiveness > 1) log.push("¡Es súper efectivo!");
    else if (result.effectiveness > 0 && result.effectiveness < 1) log.push("No es muy efectivo...");
    else if (result.effectiveness === 0) log.push("No tuvo efecto...");
    counterAttack = {
      side: "wild",
      moveName: wildMove.name,
      hit: true,
      isStatus: false,
      damage: result.damage,
      effectiveness: result.effectiveness,
      hpAfter: playerHp,
    };
  } else if (!result.hit) {
    log.push(`${wildName} usó ${wildMove.name} pero falló.`);
    counterAttack = {
      side: "wild",
      moveName: wildMove.name,
      hit: false,
      isStatus: false,
      damage: 0,
      effectiveness: 1,
      hpAfter: playerHp,
    };
  } else {
    log.push(`${wildName} usó ${wildMove.name}.`);
    counterAttack = {
      side: "wild",
      moveName: wildMove.name,
      hit: true,
      isStatus: true,
      damage: 0,
      effectiveness: 1,
      hpAfter: playerHp,
    };
  }

  const fainted = playerHp <= 0;
  const mustSwitch = fainted && (await hasHealthyBackup(userId, instance.id));
  const lostBattle = fainted && !mustSwitch;
  if (fainted) log.push(`${playerName} se debilitó.`);
  const finalLog = log.slice(-MAX_LOG_LINES);

  await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { userId_itemId: { userId, itemId } },
      data: { quantity: { decrement: 1 } },
    }),
    prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: playerHp } }),
    prisma.battleSession.update({
      where: { id: battle.id },
      data: lostBattle ? { status: "LOST", log: finalLog } : { log: finalLog },
    }),
    ...(lostBattle
      ? [prisma.battleLog.create({ data: { kind: "PVE_WILD" as const, userId, userWon: false } })]
      : []),
  ]);

  revalidatePath(`/${locale}/team`);

  return {
    healedTo: playerHp,
    healedBy,
    itemName: item.name,
    counterAttack,
    outcome: lostBattle ? "lost" : mustSwitch ? "fainted" : "continues",
  };
}
