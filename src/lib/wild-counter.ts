import { prisma } from "@/lib/prisma";
import { STRUGGLE_MOVE, type MoveSnapshot, type TurnEvent } from "@/lib/battle";
import { pickWildMove } from "@/lib/battle-ai";
import { playerCombatantStats, wildCombatantStats } from "@/lib/combatant";
import { calculateMaxHp } from "@/lib/stats";
import { resolveWildCounter, type SideBattleState } from "@/lib/resolve-action";
import { heldItemSnapshotFromItem } from "@/lib/held-items";
import type { StatusCondition } from "@/lib/status";

type BattleWithFighters = {
  id: string;
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
    stages: {
      atk: battle.playerAtkStage ?? 0,
      def: battle.playerDefStage ?? 0,
      spe: battle.playerSpeStage ?? 0,
    },
    name: instance.nickname ?? instance.species.name,
    baseStats: playerBase,
    heldItem: playerHeldItem,
    isFullyEvolved: playerIsFullyEvolved,
  };
  let wildState: SideBattleState = {
    hp: battle.wildCurrentHp,
    maxHp: battle.wildMaxHp,
    status: battle.wildStatus ?? null,
    sleepTurns: battle.wildSleepTurns ?? 0,
    stages: {
      atk: battle.wildAtkStage ?? 0,
      def: battle.wildDefStage ?? 0,
      spe: battle.wildSpeStage ?? 0,
    },
    name: battle.wildSpecies.name,
    baseStats: wildBase,
    heldItem: wildHeldItem,
    isFullyEvolved: true,
  };

  const wildMoves = await prisma.move.findMany({ where: { id: { in: battle.wildMoveIds } } });
  const snapshots: MoveSnapshot[] = battle.wildMoveIds
    .map((id) => wildMoves.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m);

  const wildMovePp =
    (battle.wildMovePp?.length ?? 0) === battle.wildMoveIds.length && battle.wildMovePp
      ? [...battle.wildMovePp]
      : snapshots.map((m) => m.pp ?? 20);

  const lockedWild =
    battle.wildChoiceLockMoveId != null
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
  );
  playerState = outcome.player;
  wildState = outcome.wild;

  const wildActed = outcome.events.some((e) => e.side === "wild" && !e.skipped);
  if (wildActed && wi >= 0 && (wildMovePp[wi] ?? 0) > 0) {
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
      playerAtkStage: playerState.stages.atk,
      playerDefStage: playerState.stages.def,
      playerSpeStage: playerState.stages.spe,
      wildAtkStage: wildState.stages.atk,
      wildDefStage: wildState.stages.def,
      wildSpeStage: wildState.stages.spe,
      playerItemConsumed: outcome.itemConsumed,
      wildItemConsumed: battle.wildItemConsumed ?? false,
      wildChoiceLockMoveId,
    },
  };
}
