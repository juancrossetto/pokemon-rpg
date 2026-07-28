"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateCombatUi } from "@/lib/battle-lock";
import { playerCombatantStats, wildCombatantStats } from "@/lib/combatant";
import { rollFlee } from "@/lib/flee";
import { stageMultiplier } from "@/lib/status";
import { hasHealthyBackup } from "@/lib/team";
import { runWildCounterAttack } from "@/lib/wild-counter";
import type { TurnEvent } from "@/lib/battle";

const MAX_LOG_LINES = 20;

export interface FleeBattleResult {
  fled: boolean;
  counterAttack: TurnEvent | null;
  playerHpAfter: number;
  outcome: "fled" | "continues" | "lost" | "fainted";
}

/**
 * Huida de encuentros salvajes — Gen III/IV con `fleeAttempts`.
 * En gimnasio / PvP no aplica (gymId o pvpMatchId → null).
 */
export async function fleeBattle(sessionId: string, locale: string): Promise<FleeBattleResult | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  const battle = await prisma.battleSession.findFirst({
    where: { id: sessionId, userId, status: "ACTIVE", gymId: null, pvpMatchId: null },
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
  });
  if (!battle) return null;
  if (battle.routeTrainerId) return null;

  const instance = battle.pokemonInstance;
  const playerBase = playerCombatantStats(instance.species, instance.level, instance);
  const wildBase = wildCombatantStats(battle.wildSpecies, battle.wildLevel);
  const playerSpeed = Math.max(
    1,
    Math.floor(playerBase.speed * stageMultiplier(battle.playerSpeStage)),
  );
  const wildSpeed = Math.max(1, Math.floor(wildBase.speed * stageMultiplier(battle.wildSpeStage)));

  const escaped = rollFlee(playerSpeed, wildSpeed, battle.fleeAttempts);

  if (escaped) {
    await prisma.battleSession.update({
      where: { id: battle.id },
      data: { status: "FLED", log: [...battle.log, "fled"].slice(-MAX_LOG_LINES) },
    });
    revalidateCombatUi(locale);
    return {
      fled: true,
      counterAttack: null,
      playerHpAfter: instance.currentHp,
      outcome: "fled",
    };
  }

  const counter = await runWildCounterAttack(battle);
  const playerHp = counter.playerHp;
  const fainted = playerHp <= 0;
  const mustSwitch = fainted && (await hasHealthyBackup(userId, instance.id));
  const lostBattle = fainted && !mustSwitch;
  const finalLog = [...battle.log, "fleeFailed"].slice(-MAX_LOG_LINES);

  await prisma.$transaction([
    prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: playerHp } }),
    prisma.battleSession.update({
      where: { id: battle.id },
      data: lostBattle
        ? {
            status: "LOST",
            fleeAttempts: { increment: 1 },
            log: finalLog,
            ...counter.statePatch,
          }
        : {
            fleeAttempts: { increment: 1 },
            log: finalLog,
            ...counter.statePatch,
          },
    }),
    ...(lostBattle
      ? [prisma.battleLog.create({ data: { kind: "PVE_WILD" as const, userId, userWon: false } })]
      : []),
  ]);

  revalidateCombatUi(locale);

  return {
    fled: false,
    counterAttack: counter.counterAttack,
    playerHpAfter: playerHp,
    outcome: lostBattle ? "lost" : mustSwitch ? "fainted" : "continues",
  };
}
