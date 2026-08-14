"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { TurnEvent } from "@/lib/battle";
import { calculateMaxHp } from "@/lib/stats";
import { hasHealthyBackup } from "@/lib/team";
import { runWildCounterAttack } from "@/lib/wild-counter";
import { turnDeadlineForBattle } from "@/lib/battle-turn-timer";
import { closeBattleIfIdle } from "@/lib/close-battle-if-idle";
import { isReviveItemName, reviveHpFraction } from "@/lib/squad-bag";
import { raidDamageDealt, raidSettleStatement } from "@/lib/raids/settle";
import { consumeInventoryItem } from "@/lib/inventory-consume";

const MAX_LOG_LINES = 20;

export interface UseItemResult {
  /** HP tras la cura/revive, antes del contraataque del rival. */
  healedTo: number;
  healedBy: number;
  itemName: string;
  /** Full Restore también limpia status. */
  statusCured?: boolean;
  /** Si se reanimó a un miembro del equipo (no al activo). */
  revivedTargetId?: string;
  counterAttack: TurnEvent | null;
  outcome: "continues" | "lost" | "fainted";
}

export async function applyBattleItem(
  sessionId: string,
  itemId: string,
  locale: string,
  /** Obligatorio para Revive / Max Revive: instancia debilitada del equipo. */
  targetInstanceId?: string,
): Promise<UseItemResult | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  const [battle, inventoryItem] = await Promise.all([
    prisma.battleSession.findFirst({
      where: { id: sessionId, userId, status: "ACTIVE" },
      include: {
        pokemonInstance: {
          include: {
            species: { include: { evolvesTo: { select: { id: true } } } },
            heldItem: true,
          },
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
  if (item.type !== "POTION") return null;

  if (isReviveItemName(item.name)) {
    if (!targetInstanceId) return null;
    const fraction = reviveHpFraction(item.name);
    if (fraction == null) return null;

    const target = await prisma.pokemonInstance.findFirst({
      where: {
        id: targetInstanceId,
        ownerId: userId,
        teamSlot: { not: null },
      },
      include: { species: { select: { baseHp: true } } },
    });
    if (!target || target.currentHp > 0) return null;
    // Revive es para la banca en el turno normal; el activo debilitado va por mustSwitch.
    if (target.id === battle.pokemonInstanceId) return null;

    const maxHp = calculateMaxHp(
      target.species.baseHp,
      target.level,
      target.ptConstitution,
    );
    const revivedTo = Math.max(1, Math.floor(maxHp * fraction));
    const counter = await runWildCounterAttack(battle);

    return finalizeBattleItemTurn({
      battle,
      userId,
      locale,
      itemName: item.name,
      itemId: inventoryItem.itemId,
      itemQuantity: inventoryItem.quantity,
      activeInstanceId: battle.pokemonInstance.id,
      counter,
      healedTo: revivedTo,
      healedBy: revivedTo,
      revivedTargetId: target.id,
      reviveTargetHp: revivedTo,
    });
  }

  const healAmount = item.healAmount;
  if (healAmount === null) return null;

  const instance = battle.pokemonInstance;
  // Las pociones no reaniman en combate.
  if (instance.currentHp <= 0) return null;

  const maxHp = calculateMaxHp(
    instance.species.baseHp,
    instance.level,
    instance.ptConstitution,
  );
  const healedTo = Math.min(maxHp, instance.currentHp + healAmount);
  const healedBy = healedTo - instance.currentHp;
  const curesStatus = item.name.trim().toLowerCase() === "full restore";
  const playerStatusAfterHeal = curesStatus ? null : battle.playerStatus;
  const playerSleepTurnsAfterHeal = curesStatus ? 0 : battle.playerSleepTurns;

  const counter = await runWildCounterAttack({
    ...battle,
    playerStatus: playerStatusAfterHeal,
    playerSleepTurns: playerSleepTurnsAfterHeal,
    pokemonInstance: { ...instance, currentHp: healedTo },
  });

  return finalizeBattleItemTurn({
    battle,
    userId,
    locale,
    itemName: item.name,
    itemId: inventoryItem.itemId,
    itemQuantity: inventoryItem.quantity,
    activeInstanceId: instance.id,
    counter,
    healedTo,
    healedBy,
    statusCured: curesStatus && battle.playerStatus != null,
  });
}

async function finalizeBattleItemTurn(args: {
  battle: {
    id: string;
    gymId: string | null;
    gymRunId: string | null;
    pvpMatchId?: string | null;
    log: string[];
    /** Incursión: hace falta la semana y el HP del jefe para acreditar el daño. */
    raidWeekKey?: string | null;
    wildMaxHp: number;
  };
  userId: string;
  locale: string;
  itemName: string;
  itemId: string;
  itemQuantity: number;
  activeInstanceId: string;
  counter: Awaited<ReturnType<typeof runWildCounterAttack>>;
  healedTo: number;
  healedBy: number;
  statusCured?: boolean;
  revivedTargetId?: string;
  reviveTargetHp?: number;
}): Promise<UseItemResult> {
  const {
    battle,
    userId,
    locale,
    itemName,
    itemId,
    itemQuantity,
    activeInstanceId,
    counter,
    healedTo,
    healedBy,
    statusCured,
    revivedTargetId,
    reviveTargetHp,
  } = args;

  const playerHp = counter.playerHp;
  const fainted = playerHp <= 0;
  // Si acabamos de reanimar a alguien, ya hay backup sano aunque la DB
  // todavía no refleje el HP (el check corre antes del $transaction).
  const mustSwitch =
    fainted &&
    (revivedTargetId != null ||
      (await hasHealthyBackup(userId, activeInstanceId)));
  const lostBattle = fainted && !mustSwitch;
  const finalLog = [...battle.log, `item:${itemName}`].slice(-MAX_LOG_LINES);
  const raidSettle = battle.raidWeekKey
    ? raidSettleStatement(prisma, {
        userId,
        weekKey: battle.raidWeekKey,
        damage: raidDamageDealt(battle.wildMaxHp, counter.wildHp),
      })
    : null;

  // El objeto se descuenta con guarda de cantidad. La lectura de
  // `itemQuantity` es de antes del contraataque, así que sin la guarda dos
  // envíos seguidos curaban dos veces gastando una sola poción.
  const consumed = await consumeInventoryItem(prisma, { userId, itemId });
  if (!consumed) {
    return {
      healedTo: counter.playerHp,
      healedBy: 0,
      itemName,
      counterAttack: null,
      outcome: "continues",
    };
  }

  await prisma.$transaction([
    ...(revivedTargetId != null && reviveTargetHp != null
      ? [
          prisma.pokemonInstance.update({
            where: { id: revivedTargetId },
            data: { currentHp: reviveTargetHp },
          }),
        ]
      : []),
    prisma.pokemonInstance.update({
      where: { id: activeInstanceId },
      data: { currentHp: playerHp },
    }),
    prisma.battleSession.update({
      where: { id: battle.id },
      data: lostBattle
        ? {
            status: "LOST",
            log: finalLog,
            turnDeadlineAt: null,
            ...counter.statePatch,
          }
        : {
            log: finalLog,
            turnDeadlineAt: turnDeadlineForBattle(battle),
            ...counter.statePatch,
          },
    }),
    // Igual que en el cambio: si el equipo cae durante el contraataque de una
    // incursión, el intento se cierra acá y el daño se acredita en la misma
    // transacción. `BattleLog` se saltea (no es una derrota PvE de ranking).
    ...(lostBattle && raidSettle ? [raidSettle] : []),
    ...(lostBattle && !battle.raidWeekKey
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
      ? [
          prisma.gymAttempt.create({
            data: { userId, gymId: battle.gymId, won: false },
          }),
        ]
      : []),
    ...(lostBattle && battle.gymRunId
      ? [
          prisma.gymRun.update({
            where: { id: battle.gymRunId },
            data: { status: "ABANDONED" },
          }),
        ]
      : []),
  ]);

  if (itemQuantity <= 1) {
    await prisma.inventoryItem.deleteMany({
      where: { userId, itemId, quantity: { lte: 0 } },
    });
  }

  if (lostBattle && battle.gymId) {
    const { notifyGymResult } = await import("@/lib/notifications");
    await notifyGymResult(userId, battle.gymId, false);
  }

  revalidatePath(`/${locale}/team`);

  return {
    healedTo,
    healedBy,
    itemName,
    statusCured,
    revivedTargetId,
    counterAttack: counter.counterAttack,
    outcome: lostBattle ? "lost" : mustSwitch ? "fainted" : "continues",
  };
}
