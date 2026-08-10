"use server";

/**
 * Turno de batalla doble (MVP Torre elite).
 * El jugador elige un move para slot A y otro para slot B;
 * el rival actúa en ambas calles. Targeting fijo misma calle.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateCombatUi } from "@/lib/battle-lock";
import { nextTurnDeadline } from "@/lib/battle-turn-timer";
import { closeBattleIfIdle } from "@/lib/close-battle-if-idle";
import { calculateMaxHp } from "@/lib/stats";
import {
  effectivePp,
  STRUGGLE_MOVE,
  mergeBattleParticipantIds,
  type MoveSnapshot,
  type TurnEvent,
} from "@/lib/battle";
import { pickWildMove } from "@/lib/battle-ai";
import {
  playerStageColumns,
  playerStagesFromSession,
  slotStageColumns,
  stagesFromSlot,
  wildStageColumns,
  wildStagesFromSession,
} from "@/lib/battle-stages";
import { playerCombatantStats, wildCombatantStats } from "@/lib/combatant";
import type { SideBattleState } from "@/lib/resolve-action";
import { heldItemSnapshotFromItem } from "@/lib/held-items";
import { normalizeStages, type StatusCondition } from "@/lib/status";
import { twoTurnSpec, type SemiInvulnKind } from "@/lib/two-turn";
import {
  parseDoublesFieldB,
  buildDoublesFieldB,
  resolveDoubleTurn,
  doublesWon,
  doublesLost,
  type DoublesFieldB,
} from "@/lib/doubles";
import type { UseMoveResult, XpSummaryEntry } from "@/actions/battle-move";

const MAX_LOG_LINES = 20;

export type DoubleUseMoveResult = UseMoveResult & {
  playerBMaxHp: number | null;
  wildBMaxHp: number | null;
  playerHp: number;
  wildHp: number;
  playerBHp: number | null;
  wildBHp: number | null;
  playerMovesPpB: { moveId: number; pp: number }[];
  playerBStatus: StatusCondition | null;
  wildBStatus: StatusCondition | null;
  /** Carga de 2 turnos del slot B (Fly/Dig…), o null. */
  playerChargeMoveIdB: number | null;
};

function semiInvulnFromCharge(
  chargeMoveId: number | null,
  moveName: string | undefined,
): SemiInvulnKind | null {
  if (chargeMoveId == null || !moveName) return null;
  return twoTurnSpec(moveName)?.invuln ?? null;
}

function toSnapshot(m: {
  id: number;
  name: string;
  type: string;
  category: MoveSnapshot["category"];
  power: number | null;
  accuracy: number | null;
  priority: number;
  pp?: number;
  target?: string | null;
}): MoveSnapshot {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    category: m.category,
    power: m.power,
    accuracy: m.accuracy,
    priority: m.priority,
    pp: m.pp,
    target: m.target ?? "selected-pokemon",
  };
}

type InstWithMoves = {
  id: string;
  moves: {
    moveId: number;
    slot: number;
    currentPp: number;
    move: {
      id: number;
      name: string;
      type: string;
      category: MoveSnapshot["category"];
      power: number | null;
      accuracy: number | null;
      priority: number;
      pp: number;
      target?: string | null;
    };
  }[];
};

function pickPlayerMove(
  inst: InstWithMoves,
  moveId: number,
): {
  snap: MoveSnapshot;
  slot: number | null;
  nextPp: number | null;
} {
  const chosen = inst.moves.find((m) => m.moveId === moveId);
  const allEmpty = inst.moves.every((m) => effectivePp(m.currentPp, m.move.pp) <= 0);
  if ((!chosen && !allEmpty) || !chosen) {
    return { snap: STRUGGLE_MOVE, slot: null, nextPp: null };
  }
  const ppNow = effectivePp(chosen.currentPp, chosen.move.pp);
  if (ppNow <= 0) {
    return { snap: STRUGGLE_MOVE, slot: null, nextPp: null };
  }
  return {
    snap: toSnapshot(chosen.move),
    slot: chosen.slot,
    nextPp: ppNow - 1,
  };
}

function clampLaneAgainstField(
  lane: "A" | "B" | null,
  attackerAlive: boolean,
  wildAHp: number,
  wildBHp: number,
): "A" | "B" | null {
  if (!attackerAlive) return null;
  const living: ("A" | "B")[] = [];
  if (wildAHp > 0) living.push("A");
  if (wildBHp > 0) living.push("B");
  if (living.length === 0) return null;
  if (lane === "A" || lane === "B") {
    if (living.includes(lane)) return lane;
  }
  return living[0]!;
}

/** Target del finish de carga: respeta la calle locked aunque esté vacía. */
function lockedChargeLane(
  charging: boolean,
  locked: "A" | "B" | null | undefined,
  fallback: "A" | "B" | null,
): "A" | "B" | null {
  if (!charging) return fallback;
  if (locked === "A" || locked === "B") return locked;
  return fallback;
}

export async function submitDoubleBattleMoves(
  sessionId: string,
  moveIdA: number,
  moveIdB: number,
  locale: string,
  targetLaneA: "A" | "B" | null = null,
  targetLaneB: "A" | "B" | null = null,
): Promise<DoubleUseMoveResult | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  const battle = await prisma.battleSession.findFirst({
    where: { id: sessionId, userId, status: "ACTIVE", format: "DOUBLE" },
    include: {
      pokemonInstance: {
        include: {
          species: { include: { evolvesTo: { select: { id: true } } } },
          moves: { include: { move: true }, orderBy: { slot: "asc" } },
          heldItem: true,
        },
      },
      pokemonInstanceB: {
        include: {
          species: { include: { evolvesTo: { select: { id: true } } } },
          moves: { include: { move: true }, orderBy: { slot: "asc" } },
          heldItem: true,
        },
      },
      wildSpecies: true,
    },
  });
  if (!battle?.towerRunId) return null;

  if (await closeBattleIfIdle(battle, locale)) {
    const fieldB = parseDoublesFieldB(battle.fieldB);
    const instA = battle.pokemonInstance;
    const instB = battle.pokemonInstanceB!;
    return {
      events: [],
      playerMaxHp: calculateMaxHp(instA.species.baseHp, instA.level, instA.ptConstitution),
      wildMaxHp: battle.wildMaxHp,
      playerBMaxHp: calculateMaxHp(instB.species.baseHp, instB.level, instB.ptConstitution),
      wildBMaxHp: fieldB?.wild.maxHp ?? null,
      playerHp: instA.currentHp,
      wildHp: battle.wildCurrentHp,
      playerBHp: instB.currentHp,
      wildBHp: fieldB?.wild.currentHp ?? null,
      outcome: "lost",
      leveledUpTo: null,
      xpGained: null,
      xpSummary: null,
      coinsGained: 0,
      badgeEarned: false,
      tmRewardName: null,
      heldRewardName: null,
      rematch: false,
      playerMovesPp: instA.moves.map((m) => ({
        moveId: m.moveId,
        pp: m.currentPp,
      })),
      playerMovesPpB: instB.moves.map((m) => ({
        moveId: m.moveId,
        pp: m.currentPp,
      })),
      playerChoiceLockMoveId: battle.playerChoiceLockMoveId,
      playerChargeMoveId: battle.playerChargeMoveId,
      playerChargeMoveIdB: fieldB?.player.chargeMoveId ?? null,
      playerStatus: battle.playerStatus,
      wildStatus: battle.wildStatus,
      playerBStatus: fieldB?.player.status ?? null,
      wildBStatus: fieldB?.wild.status ?? null,
      pvpResult: null,
      nextOpponent: null,
      turnDeadlineAt: null,
    };
  }

  const fieldBParsed = parseDoublesFieldB(battle.fieldB);
  if (!fieldBParsed || !battle.pokemonInstanceB) return null;

  const instA = battle.pokemonInstance;
  const instB = battle.pokemonInstanceB;

  // Carga de 2 turnos manda: el 2º turno está forzado (como en singles).
  const effectiveMoveIdA = battle.playerChargeMoveId ?? moveIdA;
  const effectiveMoveIdB = fieldBParsed.player.chargeMoveId ?? moveIdB;
  const moveA = pickPlayerMove(instA, effectiveMoveIdA);
  const moveB = pickPlayerMove(instB, effectiveMoveIdB);

  const wildAMoves = await prisma.move.findMany({ where: { id: { in: battle.wildMoveIds } } });
  const wildASnaps: MoveSnapshot[] = battle.wildMoveIds
    .map((id) => wildAMoves.find((x) => x.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map(toSnapshot);
  const wildAPp =
    (battle.wildMovePp?.length ?? 0) === battle.wildMoveIds.length && battle.wildMovePp
      ? [...battle.wildMovePp]
      : wildASnaps.map((m) => m.pp ?? 20);

  const wildBDef = fieldBParsed.wild;
  const wildBMoves = await prisma.move.findMany({ where: { id: { in: wildBDef.moveIds } } });
  const wildBSnaps: MoveSnapshot[] = wildBDef.moveIds
    .map((id) => wildBMoves.find((x) => x.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map(toSnapshot);
  const wildBPp =
    wildBDef.movePp.length === wildBDef.moveIds.length
      ? [...wildBDef.movePp]
      : wildBSnaps.map((m) => m.pp ?? 20);

  const speciesB = await prisma.species.findUniqueOrThrow({ where: { id: wildBDef.speciesId } });

  const playerAChargeName = battle.playerChargeMoveId
    ? instA.moves.find((m) => m.moveId === battle.playerChargeMoveId)?.move.name
    : undefined;
  const playerBChargeName = fieldBParsed.player.chargeMoveId
    ? instB.moves.find((m) => m.moveId === fieldBParsed.player.chargeMoveId)?.move.name
    : undefined;

  const playerAState: SideBattleState = {
    hp: instA.currentHp,
    maxHp: calculateMaxHp(instA.species.baseHp, instA.level, instA.ptConstitution),
    status: battle.playerStatus ?? null,
    sleepTurns: battle.playerSleepTurns ?? 0,
    stages: playerStagesFromSession(battle),
    name: instA.nickname ?? instA.species.name,
    baseStats: playerCombatantStats(instA.species, instA.level, instA),
    heldItem: heldItemSnapshotFromItem(instA.heldItem),
    isFullyEvolved: instA.species.evolvesTo.length === 0,
    chargeMoveId: battle.playerChargeMoveId ?? null,
    semiInvuln: semiInvulnFromCharge(battle.playerChargeMoveId ?? null, playerAChargeName),
    chargeTargetLane: fieldBParsed.playerAChargeTargetLane ?? null,
  };

  const playerBState: SideBattleState = {
    hp: instB.currentHp,
    maxHp: calculateMaxHp(instB.species.baseHp, instB.level, instB.ptConstitution),
    status: fieldBParsed.player.status,
    sleepTurns: fieldBParsed.player.sleepTurns,
    stages: stagesFromSlot(fieldBParsed.player),
    name: instB.nickname ?? instB.species.name,
    baseStats: playerCombatantStats(instB.species, instB.level, instB),
    heldItem: heldItemSnapshotFromItem(instB.heldItem),
    isFullyEvolved: instB.species.evolvesTo.length === 0,
    chargeMoveId: fieldBParsed.player.chargeMoveId,
    semiInvuln: semiInvulnFromCharge(
      fieldBParsed.player.chargeMoveId,
      playerBChargeName,
    ),
    chargeTargetLane: fieldBParsed.player.chargeTargetLane,
  };

  const wildAChargeName = battle.wildChargeMoveId
    ? wildASnaps.find((m) => m.id === battle.wildChargeMoveId)?.name
    : undefined;
  const wildBChargeName = wildBDef.chargeMoveId
    ? wildBSnaps.find((m) => m.id === wildBDef.chargeMoveId)?.name
    : undefined;

  const wildAState: SideBattleState = {
    hp: battle.wildCurrentHp,
    maxHp: battle.wildMaxHp,
    status: battle.wildStatus ?? null,
    sleepTurns: battle.wildSleepTurns ?? 0,
    stages: wildStagesFromSession(battle),
    name: battle.wildSpecies.name,
    baseStats: wildCombatantStats(battle.wildSpecies, battle.wildLevel),
    heldItem: null,
    isFullyEvolved: true,
    chargeMoveId: battle.wildChargeMoveId ?? null,
    semiInvuln: semiInvulnFromCharge(battle.wildChargeMoveId ?? null, wildAChargeName),
    chargeTargetLane: fieldBParsed.wildAChargeTargetLane ?? null,
  };

  const wildBState: SideBattleState = {
    hp: wildBDef.currentHp,
    maxHp: wildBDef.maxHp,
    status: wildBDef.status,
    sleepTurns: wildBDef.sleepTurns,
    stages: stagesFromSlot(wildBDef),
    name: speciesB.name,
    baseStats: wildCombatantStats(speciesB, wildBDef.level),
    heldItem: null,
    isFullyEvolved: true,
    chargeMoveId: wildBDef.chargeMoveId,
    semiInvuln: semiInvulnFromCharge(wildBDef.chargeMoveId, wildBChargeName),
    chargeTargetLane: wildBDef.chargeTargetLane,
  };

  const wildAPool = wildASnaps.length > 0 ? wildASnaps : [STRUGGLE_MOVE];
  const wildBPool = wildBSnaps.length > 0 ? wildBSnaps : [STRUGGLE_MOVE];
  const wildAMove =
    battle.wildChargeMoveId != null
      ? (wildAPool.find((m) => m.id === battle.wildChargeMoveId) ?? STRUGGLE_MOVE)
      : pickWildMove(
          wildAPool,
          wildAState.baseStats,
          playerAState.baseStats,
          playerAState.hp,
          wildAPp,
          {
            attackerHp: wildAState.hp,
            attackerMaxHp: wildAState.maxHp,
          },
        );
  const wildBMove =
    wildBDef.chargeMoveId != null
      ? (wildBPool.find((m) => m.id === wildBDef.chargeMoveId) ?? STRUGGLE_MOVE)
      : pickWildMove(
          wildBPool,
          wildBState.baseStats,
          playerBState.baseStats,
          playerBState.hp,
          wildBPp,
          {
            attackerHp: wildBState.hp,
            attackerMaxHp: wildBState.maxHp,
          },
        );

  const resolved = resolveDoubleTurn(
    {
      playerA: playerAState,
      playerB: playerBState,
      wildA: wildAState,
      wildB: wildBState,
    },
    [
      {
        slot: "playerA",
        move: moveA.snap,
        targetLane: lockedChargeLane(
          battle.playerChargeMoveId != null,
          fieldBParsed.playerAChargeTargetLane,
          clampLaneAgainstField(
            targetLaneA,
            playerAState.hp > 0,
            wildAState.hp,
            wildBState.hp,
          ),
        ),
      },
      {
        slot: "playerB",
        move: moveB.snap,
        targetLane: lockedChargeLane(
          fieldBParsed.player.chargeMoveId != null,
          fieldBParsed.player.chargeTargetLane,
          clampLaneAgainstField(
            targetLaneB,
            playerBState.hp > 0,
            wildAState.hp,
            wildBState.hp,
          ),
        ),
      },
      {
        slot: "wildA",
        move: wildAMove.id > 0 ? wildAMove : STRUGGLE_MOVE,
        targetLane: lockedChargeLane(
          battle.wildChargeMoveId != null,
          fieldBParsed.wildAChargeTargetLane,
          playerAState.hp > 0 ? "A" : "B",
        ),
      },
      {
        slot: "wildB",
        move: wildBMove.id > 0 ? wildBMove : STRUGGLE_MOVE,
        targetLane: lockedChargeLane(
          wildBDef.chargeMoveId != null,
          wildBDef.chargeTargetLane,
          playerBState.hp > 0 ? "B" : "A",
        ),
      },
    ],
    battle.playerItemConsumed,
    fieldBParsed.player.itemConsumed,
  );

  const { field, events } = resolved;

  // El 2º turno de un charge no vuelve a gastar PP (se descontó al empezar).
  const finishedChargeA = events.some(
    (e) => e.side === "player" && e.fieldSlot === "A" && e.chargePhase === "finish",
  );
  const finishedChargeB = events.some(
    (e) => e.side === "player" && e.fieldSlot === "B" && e.chargePhase === "finish",
  );
  const wildAFinishedCharge = events.some(
    (e) => e.side === "wild" && e.fieldSlot === "A" && e.chargePhase === "finish",
  );
  const wildBFinishedCharge = events.some(
    (e) => e.side === "wild" && e.fieldSlot === "B" && e.chargePhase === "finish",
  );

  if (wildAMove.id > 0 && !wildAFinishedCharge) {
    const wildAActed = events.some(
      (e) => e.side === "wild" && (e.fieldSlot ?? "A") === "A" && !e.skipped,
    );
    if (wildAActed) {
      const idx = wildASnaps.findIndex((m) => m.id === wildAMove.id);
      if (idx >= 0) wildAPp[idx] = Math.max(0, (wildAPp[idx] ?? 0) - 1);
    }
  }
  if (wildBMove.id > 0 && !wildBFinishedCharge) {
    const wildBActed = events.some(
      (e) => e.side === "wild" && e.fieldSlot === "B" && !e.skipped,
    );
    if (wildBActed) {
      const idx = wildBSnaps.findIndex((m) => m.id === wildBMove.id);
      if (idx >= 0) wildBPp[idx] = Math.max(0, (wildBPp[idx] ?? 0) - 1);
    }
  }

  const moveAPp =
    finishedChargeA ||
    !events.some((e) => e.side === "player" && (e.fieldSlot ?? "A") === "A" && !e.skipped)
      ? { slot: null, nextPp: null }
      : moveA;
  const moveBPp =
    finishedChargeB ||
    !events.some((e) => e.side === "player" && e.fieldSlot === "B" && !e.skipped)
      ? { slot: null, nextPp: null }
      : moveB;

  const nextFieldB: DoublesFieldB = {
    ...buildDoublesFieldB(
      {
        ...wildBDef,
        currentHp: field.wildB?.hp ?? 0,
        movePp: wildBPp,
        status: field.wildB?.status ?? null,
        sleepTurns: field.wildB?.sleepTurns ?? 0,
        ...slotStageColumns(normalizeStages(field.wildB?.stages)),
        itemConsumed: wildBDef.itemConsumed,
        choiceLockMoveId: wildBDef.choiceLockMoveId,
        chargeMoveId: field.wildB?.chargeMoveId ?? null,
        chargeTargetLane: field.wildB?.chargeTargetLane ?? null,
      },
      {
        status: field.playerB?.status ?? null,
        sleepTurns: field.playerB?.sleepTurns ?? 0,
        ...slotStageColumns(normalizeStages(field.playerB?.stages)),
        choiceLockMoveId: fieldBParsed.player.choiceLockMoveId,
        itemConsumed: resolved.playerItemConsumedB,
        chargeMoveId: field.playerB?.chargeMoveId ?? null,
        chargeTargetLane: field.playerB?.chargeTargetLane ?? null,
      },
    ),
    playerAChargeTargetLane: field.playerA.chargeTargetLane ?? null,
    wildAChargeTargetLane: field.wildA.chargeTargetLane ?? null,
  };

  const won = doublesWon(field);
  const lost = doublesLost(field);
  const log = [
    `doubleMove:${moveA.snap.name}+${moveB.snap.name}`,
    ...(won ? ["towerDoubleWin"] : []),
    ...(lost ? ["towerDoubleLoss"] : []),
  ];
  const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);

  const participantIds = mergeBattleParticipantIds(
    battle.participantIds,
    instA.id,
    instB.id,
  );

  const resultBase = {
    events,
    field,
    playerAMax: playerAState.maxHp,
    playerBMax: playerBState.maxHp,
    wildAMax: battle.wildMaxHp,
    wildBMax: wildBDef.maxHp,
    moveA: moveAPp,
    moveB: moveBPp,
    instA,
    instB,
    nextFieldB,
  };

  if (won) {
    const { settleTowerFloorWin } = await import("@/lib/tower/settle");
    const { parseTowerTeamSnapshot } = await import("@/lib/tower/team");
    const { lockUsers } = await import("@/lib/db-locks");

    await prisma.$transaction(async (tx) => {
      if (moveAPp.slot != null && moveAPp.nextPp != null) {
        await tx.pokemonMove.update({
          where: {
            pokemonInstanceId_slot: {
              pokemonInstanceId: instA.id,
              slot: moveAPp.slot,
            },
          },
          data: { currentPp: moveAPp.nextPp },
        });
      }
      if (moveBPp.slot != null && moveBPp.nextPp != null) {
        await tx.pokemonMove.update({
          where: {
            pokemonInstanceId_slot: {
              pokemonInstanceId: instB.id,
              slot: moveBPp.slot,
            },
          },
          data: { currentPp: moveBPp.nextPp },
        });
      }
      await tx.pokemonInstance.update({
        where: { id: instA.id },
        data: { currentHp: Math.max(0, field.playerA.hp) },
      });
      await tx.pokemonInstance.update({
        where: { id: instB.id },
        data: { currentHp: Math.max(0, field.playerB?.hp ?? 0) },
      });
      await tx.battleSession.update({
        where: { id: battle.id },
        data: {
          status: "WON",
          wildCurrentHp: 0,
          pendingXp: 0,
          log: finalLog,
          participantIds,
          fieldB: JSON.parse(
            JSON.stringify({
              ...nextFieldB,
              wild: { ...nextFieldB.wild, currentHp: 0 },
            }),
          ),
        },
      });
      await tx.battleLog.create({
        data: { kind: "PVE_TOWER", userId, userWon: true },
      });
    });

    await prisma.$transaction(
      async (tx) => {
        await lockUsers(tx, userId);
        const run = await tx.towerRun.findFirstOrThrow({ where: { id: battle.towerRunId! } });
        const snap = parseTowerTeamSnapshot(run.teamSnapshot);
        const instances = await tx.pokemonInstance.findMany({
          where: { id: { in: snap.map((m) => m.instanceId) } },
          select: { id: true, currentHp: true },
        });
        await settleTowerFloorWin(tx, {
          userId,
          runId: battle.towerRunId!,
          instances,
        });
      },
      { timeout: 20_000 },
    );

    revalidatePath(`/${locale}/tower`);
    revalidatePath(`/${locale}/team`);
    revalidateCombatUi(locale);

    return buildResult({ ...resultBase, outcome: "won" });
  }

  if (lost) {
    const { settleTowerFloorLoss } = await import("@/lib/tower/settle");
    const { parseTowerTeamSnapshot } = await import("@/lib/tower/team");
    const { lockUsers } = await import("@/lib/db-locks");

    await prisma.$transaction(
      async (tx) => {
        await lockUsers(tx, userId);
        if (moveAPp.slot != null && moveAPp.nextPp != null) {
          await tx.pokemonMove.update({
            where: {
              pokemonInstanceId_slot: {
                pokemonInstanceId: instA.id,
                slot: moveAPp.slot,
              },
            },
            data: { currentPp: moveAPp.nextPp },
          });
        }
        if (moveBPp.slot != null && moveBPp.nextPp != null) {
          await tx.pokemonMove.update({
            where: {
              pokemonInstanceId_slot: {
                pokemonInstanceId: instB.id,
                slot: moveBPp.slot,
              },
            },
            data: { currentPp: moveBPp.nextPp },
          });
        }
        await tx.pokemonInstance.update({
          where: { id: instA.id },
          data: { currentHp: 0 },
        });
        await tx.pokemonInstance.update({
          where: { id: instB.id },
          data: { currentHp: 0 },
        });
        await tx.battleSession.update({
          where: { id: battle.id },
          data: {
            status: "LOST",
            log: finalLog,
            participantIds,
            fieldB: JSON.parse(JSON.stringify(nextFieldB)),
            wildCurrentHp: field.wildA.hp,
            playerStatus: field.playerA.status,
            wildStatus: field.wildA.status,
          },
        });
        await tx.battleLog.create({
          data: { kind: "PVE_TOWER", userId, userWon: false },
        });
        const run = await tx.towerRun.findFirstOrThrow({ where: { id: battle.towerRunId! } });
        const snap = parseTowerTeamSnapshot(run.teamSnapshot);
        const instances = await tx.pokemonInstance.findMany({
          where: { id: { in: snap.map((m) => m.instanceId) } },
          select: { id: true, currentHp: true },
        });
        await settleTowerFloorLoss(tx, {
          userId,
          runId: battle.towerRunId!,
          instances: instances.map((i) =>
            i.id === instA.id || i.id === instB.id ? { id: i.id, currentHp: 0 } : i,
          ),
        });
      },
      { timeout: 20_000 },
    );

    revalidatePath(`/${locale}/tower`);
    revalidateCombatUi(locale);

    return buildResult({ ...resultBase, outcome: "lost" });
  }

  await prisma.$transaction(async (tx) => {
    if (moveAPp.slot != null && moveAPp.nextPp != null) {
      await tx.pokemonMove.update({
        where: {
          pokemonInstanceId_slot: {
            pokemonInstanceId: instA.id,
            slot: moveAPp.slot,
          },
        },
        data: { currentPp: moveAPp.nextPp },
      });
    }
    if (moveBPp.slot != null && moveBPp.nextPp != null) {
      await tx.pokemonMove.update({
        where: {
          pokemonInstanceId_slot: {
            pokemonInstanceId: instB.id,
            slot: moveBPp.slot,
          },
        },
        data: { currentPp: moveBPp.nextPp },
      });
    }
    await tx.pokemonInstance.update({
      where: { id: instA.id },
      data: { currentHp: Math.max(0, field.playerA.hp) },
    });
    await tx.pokemonInstance.update({
      where: { id: instB.id },
      data: { currentHp: Math.max(0, field.playerB?.hp ?? 0) },
    });
    await tx.battleSession.update({
      where: { id: battle.id },
      data: {
        wildCurrentHp: Math.max(0, field.wildA.hp),
        wildMovePp: wildAPp,
        playerStatus: field.playerA.status,
        wildStatus: field.wildA.status,
        playerSleepTurns: field.playerA.sleepTurns,
        wildSleepTurns: field.wildA.sleepTurns,
        ...playerStageColumns(field.playerA.stages),
        ...wildStageColumns(field.wildA.stages),
        playerItemConsumed: resolved.playerItemConsumedA,
        playerChargeMoveId: field.playerA.chargeMoveId ?? null,
        wildChargeMoveId: field.wildA.chargeMoveId ?? null,
        fieldB: JSON.parse(JSON.stringify(nextFieldB)),
        participantIds,
        log: finalLog,
        turnDeadlineAt: nextTurnDeadline(),
      },
    });
  });

  revalidatePath(`/${locale}/team`);

  return buildResult({ ...resultBase, outcome: "ongoing" });
}

function buildResult(input: {
  events: TurnEvent[];
  field: ReturnType<typeof resolveDoubleTurn>["field"];
  playerAMax: number;
  playerBMax: number;
  wildAMax: number;
  wildBMax: number;
  moveA: { slot: number | null; nextPp: number | null };
  moveB: { slot: number | null; nextPp: number | null };
  instA: InstWithMoves;
  instB: InstWithMoves;
  outcome: "ongoing" | "won" | "lost";
  nextFieldB: DoublesFieldB;
}): DoubleUseMoveResult {
  const { events, field, outcome, nextFieldB } = input;
  const turnDeadlineAt =
    outcome === "ongoing" ? nextTurnDeadline().toISOString() : null;

  const mapPp = (
    inst: InstWithMoves,
    used: { slot: number | null; nextPp: number | null },
  ) =>
    inst.moves.map((m) => ({
      moveId: m.moveId,
      pp:
        used.slot === m.slot && used.nextPp != null
          ? used.nextPp
          : effectivePp(m.currentPp, m.move.pp),
    }));

  return {
    events,
    playerMaxHp: input.playerAMax,
    wildMaxHp: input.wildAMax,
    playerBMaxHp: input.playerBMax,
    wildBMaxHp: input.wildBMax,
    playerHp: field.playerA.hp,
    wildHp: field.wildA.hp,
    playerBHp: field.playerB?.hp ?? null,
    wildBHp: field.wildB?.hp ?? null,
    outcome,
    leveledUpTo: null,
    xpGained: null,
    xpSummary: null as XpSummaryEntry[] | null,
    coinsGained: 0,
    badgeEarned: false,
      tmRewardName: null,
      heldRewardName: null,
      rematch: false,
    playerMovesPp: mapPp(input.instA, input.moveA),
    playerMovesPpB: mapPp(input.instB, input.moveB),
    playerStatus: field.playerA.status,
    wildStatus: field.wildA.status,
    playerBStatus: field.playerB?.status ?? null,
    wildBStatus: field.wildB?.status ?? nextFieldB.wild.status,
    playerChoiceLockMoveId: null,
    playerChargeMoveId: field.playerA.chargeMoveId ?? null,
    playerChargeMoveIdB: field.playerB?.chargeMoveId ?? null,
    pvpResult: null,
    nextOpponent: null,
    turnDeadlineAt,
  };
}
