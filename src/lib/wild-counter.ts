import { prisma } from "@/lib/prisma";
import { STRUGGLE_MOVE, type MoveSnapshot, type TurnEvent } from "@/lib/battle";
import { pickWildMove } from "@/lib/battle-ai";
import {
  playerStageColumns,
  playerStagesFromSession,
  wildStageColumns,
  wildStagesFromSession,
} from "@/lib/battle-stages";
import { playerCombatantStats, wildCombatantStats } from "@/lib/combatant";
import { calculateMaxHp } from "@/lib/stats";
import { resolveWildCounter, type SideBattleState } from "@/lib/resolve-action";
import { earlyGameBattleMode, isOnboardingAiMode } from "@/lib/early-game-balance";
import { heldItemSnapshotFromItem } from "@/lib/held-items";
import type { StatusCondition } from "@/lib/status";
import { twoTurnSpec } from "@/lib/two-turn";

type BattleWithFighters = {
  id: string;
  routeTrainerId?: string | null;
  pvpMatchId?: string | null;
  clanWarBattleId?: string | null;
  gymRunId?: string | null;
  log?: string[];
  wildCurrentHp: number;
  wildMaxHp: number;
  wildLevel: number;
  wildMoveIds: number[];
  wildMovePp: number[];
  playerStatus: StatusCondition | null;
  wildStatus: StatusCondition | null;
  playerSleepTurns: number;
  wildSleepTurns: number;
  playerAtkStage: number;
  playerDefStage: number;
  playerSpeStage: number;
  wildAtkStage: number;
  wildDefStage: number;
  wildSpeStage: number;
  playerChoiceLockMoveId?: number | null;
  playerItemConsumed?: boolean;
  wildItemConsumed?: boolean;
  wildChoiceLockMoveId?: number | null;
  playerChargeMoveId?: number | null;
  wildChargeMoveId?: number | null;
  wildHeldItem?: {
    id: string;
    name: string;
    heldEffect: string | null;
    heldValue: number | null;
    heldStat: string | null;
    heldBoostType: string | null;
  } | null;
  pokemonInstance: {
    id: string;
    currentHp: number;
    level: number;
    nickname: string | null;
    ptStrength: number;
    ptDexterity: number;
    ptIntelligence: number;
    ptSpeed: number;
    ptConstitution: number;
    heldItem?: {
      id: string;
      name: string;
      heldEffect: string | null;
      heldValue: number | null;
      heldStat: string | null;
      heldBoostType: string | null;
    } | null;
    species: {
      name: string;
      types: string[];
      baseHp: number;
      baseAttack: number;
      baseDefense: number;
      baseSpAtk: number;
      baseSpDef: number;
      baseSpeed: number;
      evolvesTo?: { id: number }[];
    };
  };
  wildSpecies: {
    name: string;
    types: string[];
    baseAttack: number;
    baseDefense: number;
    baseSpAtk: number;
    baseSpDef: number;
    baseSpeed: number;
  };
};

export async function runWildCounterAttack(battle: BattleWithFighters): Promise<{
  events: TurnEvent[];
  playerHp: number;
  wildHp: number;
  counterAttack: TurnEvent | null;
  statePatch: Record<string, unknown>;
}> {
  const instance = battle.pokemonInstance;
  const playerMaxHp = calculateMaxHp(
    instance.species.baseHp,
    instance.level,
    instance.ptConstitution,
  );
  const playerBase = playerCombatantStats(instance.species, instance.level, instance);
  const wildBase = wildCombatantStats(battle.wildSpecies, battle.wildLevel);
  const playerHeldItem = heldItemSnapshotFromItem(instance.heldItem);
  const wildHeldItem = heldItemSnapshotFromItem(battle.wildHeldItem);
  const playerIsFullyEvolved = (instance.species.evolvesTo?.length ?? 0) === 0;

  let playerState: SideBattleState = {
    hp: instance.currentHp,
    maxHp: playerMaxHp,
    status: battle.playerStatus ?? null,
    sleepTurns: battle.playerSleepTurns ?? 0,
    stages: playerStagesFromSession(battle),
    name: instance.nickname ?? instance.species.name,
    baseStats: playerBase,
    heldItem: playerHeldItem,
    isFullyEvolved: playerIsFullyEvolved,
    chargeMoveId: battle.playerChargeMoveId ?? null,
    semiInvuln: null,
  };
  let wildState: SideBattleState = {
    hp: battle.wildCurrentHp,
    maxHp: battle.wildMaxHp,
    status: battle.wildStatus ?? null,
    sleepTurns: battle.wildSleepTurns ?? 0,
    stages: wildStagesFromSession(battle),
    name: battle.wildSpecies.name,
    baseStats: wildBase,
    heldItem: wildHeldItem,
    isFullyEvolved: true,
    chargeMoveId: battle.wildChargeMoveId ?? null,
    semiInvuln: null,
  };

  const earlyMode = earlyGameBattleMode(battle);
  const earlyGameOpts = earlyMode
    ? { earlyGame: { playerLevel: instance.level, mode: earlyMode } }
    : undefined;

  const wildMoves = await prisma.move.findMany({ where: { id: { in: battle.wildMoveIds } } });
  const snapshots: MoveSnapshot[] = battle.wildMoveIds
    .map((id) => wildMoves.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m);

  // Semi-invuln del jugador (p. ej. mid-Fly mientras el rival contraataca por mochila).
  if (playerState.chargeMoveId) {
    const charged = await prisma.move.findUnique({
      where: { id: playerState.chargeMoveId },
      select: { name: true },
    });
    playerState.semiInvuln = charged ? (twoTurnSpec(charged.name)?.invuln ?? null) : null;
  }
  if (wildState.chargeMoveId) {
    const charged = snapshots.find((m) => m.id === wildState.chargeMoveId);
    wildState.semiInvuln = charged ? (twoTurnSpec(charged.name)?.invuln ?? null) : null;
  }

  const wildMovePp =
    (battle.wildMovePp?.length ?? 0) === battle.wildMoveIds.length && battle.wildMovePp
      ? [...battle.wildMovePp]
      : snapshots.map((m) => m.pp ?? 20);

  const lockedWild =
    battle.wildChargeMoveId != null
      ? snapshots.find((m) => m.id === battle.wildChargeMoveId)
      : battle.wildChoiceLockMoveId != null
        ? snapshots.find((m) => m.id === battle.wildChoiceLockMoveId)
        : undefined;
  const pick = lockedWild
    ? lockedWild
    : pickWildMove(
        snapshots.length > 0 ? snapshots : [STRUGGLE_MOVE],
        wildBase,
        playerBase,
        playerState.hp,
        wildMovePp,
        {
          attackerHp: wildState.hp,
          attackerMaxHp: wildState.maxHp,
          earlyGame: isOnboardingAiMode(earlyMode),
        },
      );
  const noPp = wildMovePp.length > 0 && wildMovePp.every((pp) => pp <= 0);
  const lockedPpIdx = lockedWild ? snapshots.findIndex((m) => m.id === lockedWild.id) : -1;
  const lockedOutOfPp = lockedPpIdx >= 0 && (wildMovePp[lockedPpIdx] ?? 0) <= 0;
  const wildMove =
    pick.id < 0 || noPp || snapshots.length === 0 || (lockedWild && lockedOutOfPp)
      ? STRUGGLE_MOVE
      : pick;
  const wi = snapshots.findIndex((m) => m.id === wildMove.id);

  const outcome = resolveWildCounter(
    wildMove,
    playerState,
    wildState,
    battle.playerItemConsumed ?? false,
    earlyGameOpts,
  );
  playerState = outcome.player;
  wildState = outcome.wild;

  const wildActed = outcome.events.some((e) => e.side === "wild" && !e.skipped);
  const wildFinishedCharge = outcome.events.some(
    (e) => e.side === "wild" && e.chargePhase === "finish",
  );
  if (wildActed && !wildFinishedCharge && wi >= 0 && (wildMovePp[wi] ?? 0) > 0) {
    wildMovePp[wi] -= 1;
  }

  const counterAttack = outcome.events[0] ?? null;
  const wildChoiceLockMoveId =
    battle.wildChoiceLockMoveId ??
    (wildActed &&
    wildHeldItem?.effect === "CHOICE_LOCK" &&
    wildMove.id !== STRUGGLE_MOVE.id
      ? wildMove.id
      : null);

  return {
    events: outcome.events,
    playerHp: playerState.hp,
    wildHp: wildState.hp,
    counterAttack,
    statePatch: {
      wildCurrentHp: wildState.hp,
      wildMovePp,
      playerStatus: playerState.status,
      wildStatus: wildState.status,
      playerSleepTurns: playerState.sleepTurns,
      wildSleepTurns: wildState.sleepTurns,
      ...playerStageColumns(playerState.stages),
      ...wildStageColumns(wildState.stages),
      playerItemConsumed: outcome.itemConsumed,
      wildItemConsumed: battle.wildItemConsumed ?? false,
      wildChoiceLockMoveId,
      playerChargeMoveId: playerState.chargeMoveId ?? null,
      wildChargeMoveId: wildState.chargeMoveId ?? null,
    },
  };
}
