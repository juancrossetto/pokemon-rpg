"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateCombatUi } from "@/lib/battle-lock";
import {
  playerStageColumns,
  playerStagesFromSession,
  RESET_WILD_STAGES,
  wildStageColumns,
  wildStagesFromSession,
} from "@/lib/battle-stages";
import { calculateMaxHp, xpForLevel, UNSPENT_POINTS_PER_LEVEL } from "@/lib/stats";
import {
  distributeVictoryXpShares,
  effectivePp,
  playerActsFirst,
  STRUGGLE_MOVE,
  mergeBattleParticipantIds,
  xpForVictory,
  type MoveSnapshot,
  type TurnEvent,
  type CombatantStats,
} from "@/lib/battle";
import { pickWildMove } from "@/lib/battle-ai";
import { disobeyChance, gymRematchCoinMultiplier } from "@/lib/badge-perks";
import {
  GYM_HELD_ITEM_REWARD_BY_TYPE,
  GYM_TM_REWARD_BY_TYPE,
} from "@/lib/gym-tm-rewards";
import { playerCombatantStats, wildCombatantStats } from "@/lib/combatant";
import { resolveSingleAction, type SideBattleState } from "@/lib/resolve-action";
import { applyHeldItemToStats, heldItemSnapshotFromItem } from "@/lib/held-items";
import { applyStagesToStats, type StatusCondition } from "@/lib/status";
import { hasHealthyBackup } from "@/lib/team";
import { getMovesetForLevel } from "@/lib/moveset";
import { applyBonus } from "@/lib/mastery";
import { getZoneContext, grantZoneMastery } from "@/lib/zone-progress";
import { getRouteTrainer } from "@/lib/campaign/trainers";
import {
  completeFarmingStageOnWildWin,
  syncCampaignAfterGymBadge,
} from "@/lib/campaign/sync";
import type { EvolveOffer, LevelUpMoveInfo, KnownMoveInfo } from "@/lib/level-up";
import { resolveLevelUpEffects } from "@/lib/level-up";
import { lockUsers } from "@/lib/db-locks";
import { notifySettledPvp, settlePvpMatch } from "@/lib/pvp/settle";
import { settleClanWarSlot } from "@/lib/clan-war/settle-slot";
import { parseTeamSnap, type PvpTeamMemberSnap } from "@/lib/pvp/team";
import { twoTurnSpec } from "@/lib/two-turn";
import { turnDeadlineForBattle } from "@/lib/battle-turn-timer";
import { closeBattleIfIdle } from "@/lib/close-battle-if-idle";

const MAX_LOG_LINES = 20;

export interface XpSummaryEntry {
  instanceId: string;
  name: string;
  fromSpriteUrl: string;
  isShiny: boolean;
  xpGained: number;
  leveledUpTo: number | null;
  previousLevel: number;
  /** XP acumulada total antes / después del reparto (para barra animada). */
  xpBefore: number;
  xpAfter: number;
  autoTaught: LevelUpMoveInfo[];
  pendingMoves: LevelUpMoveInfo[];
  evolveOffer: EvolveOffer | null;
  /** Movimientos actuales (para elegir cuál olvidar). */
  knownMoves: KnownMoveInfo[];
}

function coinsForVictory(wildLevel: number): number {
  return 10 + wildLevel * 2;
}

/** Botín de la primera victoria contra un líder de gimnasio. */
export type GymFirstWinReward = {
  coins: number;
  tmName: string | null;
  heldName: string | null;
  /** Avatares que la medalla deja disponibles (`avatar-unlocks.ts`). */
  avatarSlugs: string[];
};

export interface UseMoveResult {
  events: TurnEvent[];
  playerMaxHp: number;
  wildMaxHp: number;
  outcome: "ongoing" | "won" | "lost" | "fainted" | "gym_continues" | "trainer_cleared";
  leveledUpTo: number | null;
  xpGained: number | null;
  xpSummary: XpSummaryEntry[] | null;
  /** Monedas acreditadas por la victoria (0 si no se ganó nada). */
  coinsGained: number;
  badgeEarned: boolean;
  tmRewardName: string | null;
  /** Held / ítem extra del líder (p. ej. Exp. Share en Brock). */
  heldRewardName: string | null;
  /**
   * Botín completo de la primera victoria contra un líder, para que la
   * celebración pueda mostrar de una lo que el jugador se llevó. Opcional
   * porque sólo aplica a ese caso: el resto de los returns no lo setean.
   */
  gymFirstWin?: GymFirstWinReward | null;
  rematch: boolean;
  playerMovesPp: { moveId: number; pp: number }[];
  playerStatus: StatusCondition | null;
  wildStatus: StatusCondition | null;
  /** Si porta un objeto Choice, el movimiento al que quedó atado (o null). */
  playerChoiceLockMoveId: number | null;
  /** Movimiento de 2 turnos en curso (Fly/Dig/Solar Beam…), o null. */
  playerChargeMoveId: number | null;
  /** Info de rating PvP al cerrar (solo ranked interactivo). */
  pvpResult: {
    matchId: string;
    ratingBefore: number;
    ratingAfter: number;
    coinsAwarded: number;
  } | null;
  nextOpponent: {
    name: string;
    speciesName: string;
    level: number;
    spriteUrl: string;
    maxHp: number;
    types: string[];
    stats: { def: number; spDef: number; speed: number };
  } | null;
  /** ISO del próximo deadline de decisión (si sigue ACTIVE). */
  turnDeadlineAt?: string | null;
}

function applyXpGain(
  currentXp: number,
  currentLevel: number,
  currentHp: number,
  unspentPoints: number,
  baseHp: number,
  ptConstitution: number,
  xpEarned: number,
) {
  const newXpTotal = currentXp + xpEarned;
  let newLevel = currentLevel;
  let newUnspentPoints = unspentPoints;
  let newMaxHp = calculateMaxHp(baseHp, newLevel, ptConstitution);
  let newCurrentHp = currentHp;

  while (newXpTotal >= xpForLevel(newLevel + 1)) {
    newLevel += 1;
    newUnspentPoints += UNSPENT_POINTS_PER_LEVEL;
    const previousMaxHp = newMaxHp;
    newMaxHp = calculateMaxHp(baseHp, newLevel, ptConstitution);
    newCurrentHp += newMaxHp - previousMaxHp;
  }

  return {
    newXpTotal,
    newLevel,
    newUnspentPoints,
    newMaxHp,
    newCurrentHp,
    leveledUpTo: newLevel > currentLevel ? newLevel : null,
  };
}

function sideSpeed(side: SideBattleState): number {
  const staged = applyStagesToStats(side.baseStats, side.stages, side.status);
  return applyHeldItemToStats(
    { ...side.baseStats, ...staged },
    side.heldItem,
    side.isFullyEvolved ?? true,
  ).speed;
}

export async function submitBattleMove(
  sessionId: string,
  moveId: number,
  locale: string,
): Promise<UseMoveResult | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  const battle = await prisma.battleSession.findFirst({
    where: { id: sessionId, userId, status: "ACTIVE" },
    include: {
      pokemonInstance: {
        include: {
          species: { include: { evolvesTo: { select: { id: true } } } },
          moves: { include: { move: true }, orderBy: { slot: "asc" } },
          heldItem: true,
        },
      },
      wildSpecies: true,
      wildHeldItem: true,
      pvpMatch: true,
      clanWarBattle: { include: { war: true } },
    },
  });
  if (!battle) return null;

  if (await closeBattleIfIdle(battle, locale)) {
    const instance = battle.pokemonInstance;
    return {
      events: [],
      playerMaxHp: calculateMaxHp(
        instance.species.baseHp,
        instance.level,
        instance.ptConstitution,
      ),
      wildMaxHp: battle.wildMaxHp,
      outcome: "lost",
      leveledUpTo: null,
      xpGained: null,
      xpSummary: null,
      coinsGained: 0,
      badgeEarned: false,
      tmRewardName: null,
        heldRewardName: null,
      rematch: false,
      playerMovesPp: instance.moves.map((m) => ({
        moveId: m.moveId,
        pp: m.currentPp,
      })),
      playerChoiceLockMoveId: battle.playerChoiceLockMoveId,
      playerChargeMoveId: battle.playerChargeMoveId,
      playerStatus: battle.playerStatus,
      wildStatus: battle.wildStatus,
      pvpResult: null,
      nextOpponent: null,
      turnDeadlineAt: null,
    };
  }

  // Carga de 2 turnos (Fly/Dig…) manda sobre Choice y sobre lo que eligió
  // el jugador: el 2º turno está forzado.
  const effectiveMoveId =
    battle.playerChargeMoveId ?? battle.playerChoiceLockMoveId ?? moveId;
  const chosenMove = battle.pokemonInstance.moves.find((m) => m.moveId === effectiveMoveId);
  if (!chosenMove) return null;

  const [badgeCount, alreadyHasThisBadge] = await Promise.all([
    prisma.badge.count({ where: { userId } }),
    battle.gymId
      ? prisma.badge
          .findUnique({ where: { userId_gymId: { userId, gymId: battle.gymId } } })
          .then((b) => !!b)
      : Promise.resolve(false),
  ]);

  const wildMoves = await prisma.move.findMany({ where: { id: { in: battle.wildMoveIds } } });
  const wildMoveSnapshots: MoveSnapshot[] = battle.wildMoveIds
    .map((id) => wildMoves.find((x) => x.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m);

  const wildMovePp =
    (battle.wildMovePp?.length ?? 0) === battle.wildMoveIds.length && battle.wildMovePp
      ? [...battle.wildMovePp]
      : wildMoveSnapshots.map((m) => m.pp ?? 20);

  const instance = battle.pokemonInstance;
  const playerMaxHpBase = calculateMaxHp(
    instance.species.baseHp,
    instance.level,
    instance.ptConstitution,
  );
  const playerBase = playerCombatantStats(instance.species, instance.level, instance);

  const snapOppTeam = battle.pvpMatchId
    ? parseTeamSnap(battle.pvpMatch?.opponentTeam)
    : battle.clanWarBattleId
      ? parseTeamSnap(battle.clanWarBattle?.opponentTeam)
      : [];
  const pvpOppTeam = snapOppTeam;
  const pvpActive: PvpTeamMemberSnap | null =
    pvpOppTeam.find((m) => m.slot === battle.opponentSlot) ?? pvpOppTeam[0] ?? null;

  const wildBase: CombatantStats = pvpActive
    ? {
        level: pvpActive.stats.level,
        atk: pvpActive.stats.atk,
        def: pvpActive.stats.def,
        spAtk: pvpActive.stats.spAtk,
        spDef: pvpActive.stats.spDef,
        speed: pvpActive.stats.speed,
        types: pvpActive.stats.types,
      }
    : wildCombatantStats(battle.wildSpecies, battle.wildLevel);

  const playerHeldItem = heldItemSnapshotFromItem(instance.heldItem);
  const wildHeldItem = heldItemSnapshotFromItem(battle.wildHeldItem ?? pvpActive?.heldItem);
  const playerIsFullyEvolved = instance.species.evolvesTo.length === 0;
  const wildIsFullyEvolved = pvpActive?.isFullyEvolved ?? true;

  let playerState: SideBattleState = {
    hp: instance.currentHp,
    maxHp: playerMaxHpBase,
    status: battle.playerStatus ?? null,
    sleepTurns: battle.playerSleepTurns ?? 0,
    stages: playerStagesFromSession(battle),
    name: instance.nickname ?? instance.species.name,
    baseStats: playerBase,
    heldItem: playerHeldItem,
    isFullyEvolved: playerIsFullyEvolved,
    chargeMoveId: battle.playerChargeMoveId ?? null,
    semiInvuln: battle.playerChargeMoveId
      ? (twoTurnSpec(
          instance.moves.find((m) => m.moveId === battle.playerChargeMoveId)?.move.name ?? "",
        )?.invuln ?? null)
      : null,
  };
  let wildState: SideBattleState = {
    hp: battle.wildCurrentHp,
    maxHp: battle.wildMaxHp,
    status: battle.wildStatus ?? null,
    sleepTurns: battle.wildSleepTurns ?? 0,
    stages: wildStagesFromSession(battle),
    name: pvpActive?.name ?? battle.wildSpecies.name,
    baseStats: wildBase,
    heldItem: wildHeldItem,
    isFullyEvolved: wildIsFullyEvolved,
    chargeMoveId: battle.wildChargeMoveId ?? null,
    semiInvuln: battle.wildChargeMoveId
      ? (twoTurnSpec(
          wildMoveSnapshots.find((m) => m.id === battle.wildChargeMoveId)?.name ?? "",
        )?.invuln ?? null)
      : null,
  };

  const playerPpNow = effectivePp(chosenMove.currentPp, chosenMove.move.pp);
  const allPlayerMovesEmpty = instance.moves.every(
    (m) => effectivePp(m.currentPp, m.move.pp) <= 0,
  );

  if (playerPpNow <= 0 && !allPlayerMovesEmpty) return null;

  const playerMoveSnapshot: MoveSnapshot =
    playerPpNow <= 0 ? STRUGGLE_MOVE : chosenMove.move;

  const events: TurnEvent[] = [];
  const log: string[] = [];

  const chance = disobeyChance(instance.level, badgeCount);
  const disobeyed = chance > 0 && Math.random() < chance;

  // Carga de 2 turnos manda sobre Choice: el rival está obligado a terminar.
  const lockedWild =
    battle.wildChargeMoveId != null
      ? wildMoveSnapshots.find((m) => m.id === battle.wildChargeMoveId)
      : battle.wildChoiceLockMoveId != null
        ? wildMoveSnapshots.find((m) => m.id === battle.wildChoiceLockMoveId)
        : undefined;
  const wildPickRaw = lockedWild
    ? lockedWild
    : pickWildMove(
        wildMoveSnapshots.length > 0 ? wildMoveSnapshots : [STRUGGLE_MOVE],
        wildBase,
        playerBase,
        playerState.hp,
        wildMovePp,
        {
          attackerHp: wildState.hp,
          attackerMaxHp: wildState.maxHp,
        },
      );
  const wildNoPp = wildMovePp.length > 0 && wildMovePp.every((pp) => pp <= 0);
  const lockedPpIdx = lockedWild
    ? wildMoveSnapshots.findIndex((m) => m.id === lockedWild.id)
    : -1;
  const lockedOutOfPp = lockedPpIdx >= 0 && (wildMovePp[lockedPpIdx] ?? 0) <= 0;
  const wildMove =
    wildPickRaw.id < 0 ||
    wildNoPp ||
    wildMoveSnapshots.length === 0 ||
    (lockedWild && lockedOutOfPp)
      ? STRUGGLE_MOVE
      : wildPickRaw;
  const wi = wildMoveSnapshots.findIndex((m) => m.id === wildMove.id);
  // El PP del rival se descuenta solo si realmente actúa (no si está para/dormido).

  let playerItemConsumed = battle.playerItemConsumed;
  let flinchWild = false;
  let flinchPlayer = false;

  if (disobeyed) {
    events.push({
      side: "player",
      moveName: playerMoveSnapshot.name,
      moveType: playerMoveSnapshot.type,
      category: playerMoveSnapshot.category,
      hit: false,
      isStatus: false,
      damage: 0,
      effectiveness: 1,
      hpAfter: wildState.hp,
      skipped: "disobey",
    });
    log.push(`disobey:${playerState.name}`);
    if (playerState.hp > 0 && wildState.hp > 0) {
      const counter = resolveSingleAction("wild", wildMove, playerState, wildState, playerItemConsumed);
      events.push(...counter.events);
      playerState = counter.player;
      wildState = counter.wild;
      playerItemConsumed = counter.itemConsumed;
    }
  } else {
    const quickClawTriggered =
      playerHeldItem?.effect === "QUICK_CLAW" && Math.random() < (playerHeldItem.value ?? 0.2);
    const playerFirst = playerActsFirst(
      playerMoveSnapshot,
      wildMove,
      sideSpeed(playerState),
      sideSpeed(wildState),
      quickClawTriggered,
    );
    const order = playerFirst ? (["player", "wild"] as const) : (["wild", "player"] as const);

    for (const side of order) {
      if (playerState.hp <= 0 || wildState.hp <= 0) break;
      const move = side === "player" ? playerMoveSnapshot : wildMove;

      // El flinch sólo corta el turno de quien todavía no se movió.
      if (side === "wild" ? flinchWild : flinchPlayer) {
        events.push({
          side,
          moveName: move.name,
          moveType: move.type,
          category: move.category,
          hit: false,
          isStatus: false,
          damage: 0,
          effectiveness: 1,
          hpAfter: side === "wild" ? playerState.hp : wildState.hp,
          skipped: "flinch",
        });
        continue;
      }

      const outcome = resolveSingleAction(side, move, playerState, wildState, playerItemConsumed);
      events.push(...outcome.events);
      playerState = outcome.player;
      wildState = outcome.wild;
      playerItemConsumed = outcome.itemConsumed;

      // Flinch del propio movimiento (Bite, Rock Slide, Fake Out…).
      if (outcome.causedFlinch) {
        if (side === "player") flinchWild = true;
        else flinchPlayer = true;
      }
      if (side === "player" && playerHeldItem?.effect === "FLINCH_CHANCE") {
        const playerHitLanded = outcome.events.some((e) => e.hit && !e.isStatus);
        if (playerHitLanded && Math.random() < (playerHeldItem.value ?? 0.1)) {
          flinchWild = true;
        }
      }
    }
  }

  // Registrar en el log persistente lo mismo que ve el jugador en pantalla.
  for (const e of events) {
    const name = e.side === "player" ? playerState.name : wildState.name;
    const foeName = e.side === "player" ? wildState.name : playerState.name;
    if (e.statusNote === "woke") log.push(`woke:${name}`);
    if (e.statusNote === "thawed") log.push(`thawed:${name}`);
    if (e.skipped === "paralyzed") log.push(`paralyzed:${name}`);
    else if (e.skipped === "asleep") log.push(`asleep:${name}`);
    else if (e.skipped === "frozen") log.push(`frozen:${name}`);
    else if (e.skipped === "flinch") log.push(`flinch:${name}`);
    else if (e.skipped === "disobey") {
      // ya se pusheó arriba
    } else if (e.hit && e.isStatus) {
      log.push(`used:${name}:${e.moveName}`);
      if (e.statusApplied) log.push(`status:${foeName}:${e.statusApplied}`);
    } else if (e.hit && !e.isStatus) {
      log.push(`used:${name}:${e.moveName}`);
      log.push(`damage:${foeName}:${e.damage}`);
      if (e.statusApplied) log.push(`status:${foeName}:${e.statusApplied}`);
    } else if (!e.hit && !e.skipped) {
      log.push(`miss:${name}:${e.moveName}`);
    }
    if (e.noEffect) log.push("nothing");
    if (e.healAmount) log.push(`heal:${name}:${e.healAmount}`);
    if (e.recoilDamage) log.push(`recoil:${name}:${e.recoilDamage}`);
    if (e.residualDamage) {
      const kind = e.residualStatus === "BURN" ? "burn" : e.residualStatus === "POISON" ? "poison" : "status";
      log.push(`residual:${name}:${e.residualDamage}:${kind}`);
    }
  }

  const playerActed = events.some((e) => e.side === "player" && !e.skipped);
  const wildActed = events.some((e) => e.side === "wild" && !e.skipped);
  // El 2º turno de un charge no vuelve a gastar PP (se descontó al empezar).
  const playerFinishedCharge = events.some(
    (e) => e.side === "player" && e.chargePhase === "finish",
  );
  const wildFinishedCharge = events.some(
    (e) => e.side === "wild" && e.chargePhase === "finish",
  );
  if (wildActed && !wildFinishedCharge && wi >= 0 && (wildMovePp[wi] ?? 0) > 0) {
    wildMovePp[wi] -= 1;
  }

  if (playerActed && !playerFinishedCharge && playerMoveSnapshot.id !== STRUGGLE_MOVE.id) {
    const maxPp = chosenMove.move.pp ?? 20;
    const current = effectivePp(chosenMove.currentPp, maxPp);
    const nextPp = Math.max(0, current - 1);
    for (const e of events) {
      if (e.side === "player" && !e.skipped) e.playerPpAfter = nextPp;
    }
    await prisma.pokemonMove.update({
      where: {
        pokemonInstanceId_slot: { pokemonInstanceId: instance.id, slot: chosenMove.slot },
      },
      data: { currentPp: nextPp },
    });
  }

  // Choice Band/Specs/Scarf: queda atado al primer movimiento que usa con
  // el objeto puesto, hasta que cambie de Pokémon o termine la batalla.
  const newChoiceLockMoveId =
    battle.playerChoiceLockMoveId ??
    (!disobeyed &&
    playerActed &&
    playerHeldItem?.effect === "CHOICE_LOCK" &&
    playerMoveSnapshot.id !== STRUGGLE_MOVE.id
      ? effectiveMoveId
      : null);

  const spentMaxPp = chosenMove.move.pp ?? 20;
  const spentCurrent = effectivePp(chosenMove.currentPp, spentMaxPp);
  const spentPlayerPp =
    disobeyed ||
    !playerActed ||
    playerFinishedCharge ||
    playerMoveSnapshot.id === STRUGGLE_MOVE.id
      ? null
      : Math.max(0, spentCurrent - 1);

  const playerHp = playerState.hp;
  const wildHp = wildState.hp;

  const playerMovesPp = instance.moves.map((m) => ({
    moveId: m.moveId,
    pp:
      spentPlayerPp != null && m.moveId === effectiveMoveId
        ? spentPlayerPp
        : effectivePp(m.currentPp, m.move.pp),
  }));

  const newPlayerChargeMoveId = playerState.chargeMoveId ?? null;
  const newWildChargeMoveId = wildState.chargeMoveId ?? null;

  const wonBattle = wildHp <= 0 && playerHp > 0;
  const fainted = playerHp <= 0;
  const mustSwitch = fainted && (await hasHealthyBackup(userId, instance.id));
  const lostBattle = fainted && !mustSwitch;
  let playerMaxHp = playerMaxHpBase;
  let leveledUpTo: number | null = null;
  let xpGained: number | null = null;
  let badgeEarned = false;
  let tmRewardName: string | null = null;
  let heldRewardName: string | null = null;
  let gymFirstWin: UseMoveResult["gymFirstWin"] = null;
  let coinsAwarded = 0;
  let nextOpponent: UseMoveResult["nextOpponent"] = null;
  let pvpResult: UseMoveResult["pvpResult"] = null;
  const battleKind = battle.pvpMatchId || battle.clanWarBattleId
    ? ("PVP" as const)
    : battle.towerRunId
      ? ("PVE_TOWER" as const)
      : battle.gymId
        ? ("PVE_GYM" as const)
        : ("PVE_WILD" as const);
  const gym = battle.gymId ? await prisma.gym.findUnique({ where: { id: battle.gymId } }) : null;
  let xpSummary: XpSummaryEntry[] | null = null;

  const wildChoiceLockMoveId =
    battle.wildChoiceLockMoveId ??
    (wildHeldItem?.effect === "CHOICE_LOCK" && wildMove.id !== STRUGGLE_MOVE.id
      ? wildMove.id
      : null);

  const battleStateData = {
    wildCurrentHp: Math.max(0, wildHp),
    wildMovePp,
    playerStatus: playerState.status,
    wildStatus: wildState.status,
    playerSleepTurns: playerState.sleepTurns,
    wildSleepTurns: wildState.sleepTurns,
    ...playerStageColumns(playerState.stages),
    ...wildStageColumns(wildState.stages),
    playerChoiceLockMoveId: newChoiceLockMoveId,
    playerItemConsumed,
    wildItemConsumed: battle.wildItemConsumed,
    wildChoiceLockMoveId,
    playerChargeMoveId: newPlayerChargeMoveId,
    wildChargeMoveId: newWildChargeMoveId,
  };

  if (wonBattle) {
    log.push(`fainted:${pvpActive?.name ?? battle.wildSpecies.name}`);
    // Mastery: en gimnasios / PvP no aplica (no es farmeo de zona).
    const zone =
      battle.gymId || battle.routeTrainerId || battle.pvpMatchId || battle.clanWarBattleId || battle.towerRunId
        ? null
        : await getZoneContext(userId);
    const koXp = zone
      ? applyBonus(xpForVictory(battle.wildLevel), zone.bonuses.xp)
      : xpForVictory(battle.wildLevel);

    // --- PvP / guerra de clan: siguiente mon del snapshot ---
    if (
      (battle.pvpMatchId && battle.pvpMatch) ||
      (battle.clanWarBattleId && battle.clanWarBattle)
    ) {
      // Buscar el siguiente por orden de slot mayor al actual.
      const remaining = pvpOppTeam
        .filter((m) => m.slot > (battle.opponentSlot ?? 0))
        .sort((a, b) => a.slot - b.slot);
      const nextMon = remaining[0] ?? null;

      if (nextMon) {
        nextOpponent = {
          name: nextMon.name,
          speciesName: nextMon.speciesName,
          level: nextMon.level,
          spriteUrl: nextMon.spriteUrl,
          maxHp: nextMon.maxHp,
          types: nextMon.types,
          stats: {
            def: nextMon.stats.def,
            spDef: nextMon.stats.spDef,
            speed: nextMon.stats.speed,
          },
        };
        const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
        await prisma.$transaction([
          prisma.pokemonInstance.update({
            where: { id: instance.id },
            data: { currentHp: playerHp },
          }),
          prisma.battleSession.update({
            where: { id: battle.id },
            data: {
              ...battleStateData,
              wildSpeciesId: nextMon.speciesId,
              wildLevel: nextMon.level,
              wildCurrentHp: nextMon.maxHp,
              wildMaxHp: nextMon.maxHp,
              wildMoveIds: nextMon.moves.map((m) => m.id),
              wildMovePp: nextMon.moves.map((m) => m.maxPp),
              wildHeldItemId: nextMon.heldItemId,
              wildItemConsumed: false,
              wildChoiceLockMoveId: null,
              opponentSlot: nextMon.slot,
              wildStatus: null,
              wildSleepTurns: 0,
              ...RESET_WILD_STAGES,
              wildChargeMoveId: null,
              log: finalLog,
              turnDeadlineAt: turnDeadlineForBattle(battle),
            },
          }),
          ...(battle.pvpMatchId
            ? [
                prisma.pvpMatch.update({
                  where: { id: battle.pvpMatchId },
                  data: {
                    turnLog: { push: finalLog.slice(-3) },
                    turns: { increment: 1 },
                    koLog: {
                      push: `a:${playerState.name}>b:${pvpActive?.name ?? battle.wildSpecies.name}`,
                    },
                  },
                }),
              ]
            : []),
        ]);
        // Sin revalidatePath: la batalla sigue, `/team` es inalcanzable (redirige
        // acá) y revalidarla fuerza un re-render de esta misma ruta encima de la
        // animación del rival entrando. Ver switch-pokemon.ts.
        return {
          events,
          playerMaxHp,
          wildMaxHp: nextMon.maxHp,
          outcome: "gym_continues",
          leveledUpTo: null,
          xpGained: null,
          xpSummary: null,
          coinsGained: 0,
          badgeEarned: false,
          tmRewardName: null,
        heldRewardName: null,
          rematch: false,
          playerMovesPp,
          playerChoiceLockMoveId: newChoiceLockMoveId,
          playerChargeMoveId: newPlayerChargeMoveId,
          playerStatus: playerState.status,
          wildStatus: null,
          pvpResult: null,
          nextOpponent,
          turnDeadlineAt: turnDeadlineForBattle(battle)?.toISOString() ?? null,
        };
      }

      // Equipo rival vaciado — victoria.
      if (battle.pvpMatchId && battle.pvpMatch) {
      const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
      const match = battle.pvpMatch;
      await prisma.$transaction(
        async (tx) => {
          await lockUsers(tx, userId, match.opponentId);
          await tx.pokemonInstance.update({
            where: { id: instance.id },
            data: { currentHp: playerHp },
          });
          await tx.battleSession.update({
            where: { id: battle.id },
            data: { ...battleStateData, status: "WON", wildCurrentHp: 0, log: finalLog },
          });
          await tx.battleLog.create({
            data: {
              kind: "PVP",
              userId,
              opponentId: match.opponentId,
              userWon: true,
            },
          });
          const settled = await settlePvpMatch(tx, {
            matchId: match.id,
            challengerId: match.challengerId,
            opponentId: match.opponentId,
            challengerWon: true,
            mode: match.mode,
            seasonKey: match.seasonKey ?? "unknown",
            challengerRatingBefore: match.challengerRatingBefore,
            opponentRatingBefore: match.opponentRatingBefore,
            challengerTeam: match.challengerTeam,
            koLog: [
              ...match.koLog,
              `a:${playerState.name}>b:${pvpActive?.name ?? battle.wildSpecies.name}`,
            ],
            turnLog: finalLog,
            turns: match.turns + 1,
            restoreTeam: true,
          });
          pvpResult = {
            matchId: match.id,
            ratingBefore: match.challengerRatingBefore,
            ratingAfter: settled.challengerAfter,
            coinsAwarded: settled.coinsAwarded,
          };
          coinsAwarded = settled.coinsAwarded;
        },
        { timeout: 20_000 },
      );

      const oppUser = await prisma.user.findUnique({
        where: { id: match.opponentId },
        select: { username: true },
      });
      await notifySettledPvp({
        matchId: match.id,
        challengerId: match.challengerId,
        opponentId: match.opponentId,
        challengerName: session.user.name ?? "Trainer",
        opponentName: oppUser?.username ?? "Rival",
        challengerWon: true,
      });

      revalidatePath(`/${locale}/team`);
      revalidatePath(`/${locale}/pvp`);
      revalidatePath(`/${locale}/ranking`);
      revalidateCombatUi(locale);
      return {
        events,
        playerMaxHp,
        wildMaxHp: battle.wildMaxHp,
        outcome: "won",
        leveledUpTo: null,
        xpGained: null,
        xpSummary: null,
        coinsGained: coinsAwarded,
        badgeEarned: false,
        tmRewardName: null,
        heldRewardName: null,
        rematch: false,
        playerMovesPp,
        playerChoiceLockMoveId: newChoiceLockMoveId,
        playerChargeMoveId: newPlayerChargeMoveId,
        playerStatus: playerState.status,
        wildStatus: wildState.status,
        pvpResult,
        nextOpponent: null,
      };
      }

      if (battle.clanWarBattleId && battle.clanWarBattle) {
        const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
        const slot = battle.clanWarBattle;
        const membership = await prisma.clanMember.findUnique({ where: { userId } });
        const myClanId = membership?.clanId;
        if (!myClanId || !battle.opponentUserId) return null;
        const foeUserId = battle.opponentUserId;

        await prisma.$transaction(
          async (tx) => {
            await lockUsers(tx, userId, foeUserId);
            await tx.pokemonInstance.update({
              where: { id: instance.id },
              data: { currentHp: playerHp },
            });
            await tx.battleSession.update({
              where: { id: battle.id },
              data: { ...battleStateData, status: "WON", wildCurrentHp: 0, log: finalLog },
            });
            await settleClanWarSlot(tx, {
              battleId: slot.id,
              winnerClanId: myClanId,
              winnerUserId: userId,
              koLog: [
                ...(Array.isArray(slot.koLog) ? slot.koLog : []),
                `a:${playerState.name}>b:${pvpActive?.name ?? battle.wildSpecies.name}`,
              ],
              restoreChallengerTeam: slot.challengerTeam,
            });
          },
          { timeout: 20_000 },
        );

        revalidatePath(`/${locale}/team`);
        revalidatePath(`/${locale}/clans/${myClanId}`);
        revalidateCombatUi(locale);
        return {
          events,
          playerMaxHp,
          wildMaxHp: battle.wildMaxHp,
          outcome: "won",
          leveledUpTo: null,
          xpGained: null,
          xpSummary: null,
          coinsGained: 0,
          badgeEarned: false,
          tmRewardName: null,
        heldRewardName: null,
          rematch: false,
          playerMovesPp,
          playerChoiceLockMoveId: newChoiceLockMoveId,
          playerChargeMoveId: newPlayerChargeMoveId,
          playerStatus: playerState.status,
          wildStatus: wildState.status,
          pvpResult: null,
          nextOpponent: null,
        };
      }
    }

    const nextSlot = (battle.gymPokemonSlot ?? 1) + 1;
    const nextOpponentMon = battle.gymTrainerId
      ? await prisma.gymTrainerPokemon.findUnique({
          where: { gymTrainerId_slot: { gymTrainerId: battle.gymTrainerId, slot: nextSlot } },
          include: { species: true },
        })
      : battle.gymId
        ? await prisma.gymPokemon.findUnique({
            where: { gymId_slot: { gymId: battle.gymId, slot: nextSlot } },
            include: { species: true },
          })
        : null;

    if (nextOpponentMon) {
      const nextMaxHp = calculateMaxHp(nextOpponentMon.species.baseHp, nextOpponentMon.level);
      const nextMoveIds = await getMovesetForLevel(nextOpponentMon.speciesId, nextOpponentMon.level);
      const nextMoves = await prisma.move.findMany({ where: { id: { in: nextMoveIds } } });
      const nextPp = nextMoveIds.map((id) => nextMoves.find((m) => m.id === id)?.pp ?? 20);
      nextOpponent = {
        name: nextOpponentMon.species.name,
        speciesName: nextOpponentMon.species.name,
        level: nextOpponentMon.level,
        spriteUrl: nextOpponentMon.species.spriteUrl,
        maxHp: nextMaxHp,
        types: nextOpponentMon.species.types,
        stats: (() => {
          const s = wildCombatantStats(nextOpponentMon.species, nextOpponentMon.level);
          return { def: s.def, spDef: s.spDef, speed: s.speed };
        })(),
      };

      const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
      await prisma.$transaction([
        prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: playerHp } }),
        prisma.battleSession.update({
          where: { id: battle.id },
          data: {
            ...battleStateData,
            wildSpeciesId: nextOpponentMon.speciesId,
            wildLevel: nextOpponentMon.level,
            wildCurrentHp: nextMaxHp,
            wildMaxHp: nextMaxHp,
            wildMoveIds: nextMoveIds,
            wildMovePp: nextPp,
            gymPokemonSlot: nextOpponentMon.slot,
            pendingXp: { increment: koXp },
            wildStatus: null,
            wildSleepTurns: 0,
            ...RESET_WILD_STAGES,
            wildChargeMoveId: null,
            wildChoiceLockMoveId: null,
            log: finalLog,
          },
        }),
      ]);

      revalidatePath(`/${locale}/team`);
      return {
        events,
        playerMaxHp,
        wildMaxHp: nextMaxHp,
        outcome: "gym_continues",
        leveledUpTo: null,
        xpGained: koXp,
        xpSummary: null,
        coinsGained: coinsAwarded,
        badgeEarned: false,
        tmRewardName: null,
        heldRewardName: null,
        rematch: alreadyHasThisBadge,
        playerMovesPp,
        playerChoiceLockMoveId: newChoiceLockMoveId,
        playerChargeMoveId: newPlayerChargeMoveId,
        playerStatus: playerState.status,
        wildStatus: null,
        pvpResult: null,
        nextOpponent,
      };
    }

    const totalXp = battle.pendingXp + koXp;
    // FireRed / Gen III: solo cobran vivos. Debilitados quedan fuera del pozo.
    const participantIds = mergeBattleParticipantIds(
      battle.participantIds,
      battle.pokemonInstanceId,
      instance.id,
    );
    const allParticipants = await prisma.pokemonInstance.findMany({
      where: { id: { in: participantIds } },
      include: { species: true },
    });
    const livingParticipants = allParticipants.filter((p) => {
      const hpNow = p.id === instance.id ? playerHp : p.currentHp;
      return hpNow > 0;
    });
    // Holders vivos del equipo (pueden solaparse con participantes).
    const expShareHolders = await prisma.pokemonInstance.findMany({
      where: {
        ownerId: userId,
        teamSlot: { not: null },
        currentHp: { gt: 0 },
        heldItem: { heldEffect: "EXP_SHARE" },
      },
      include: { species: true },
    });
    // Si el activo lleva Exp. Share, su HP en DB puede estar desfasado: contarlo
    // como vivo con el HP del turno.
    const livingShareHolders = expShareHolders.filter((p) => {
      if (p.id === instance.id) return playerHp > 0;
      return p.currentHp > 0;
    });

    const shareById = distributeVictoryXpShares({
      totalXp,
      participantIds: livingParticipants.map((p) => p.id),
      expShareHolderIds: livingShareHolders.map((p) => p.id),
    });

    const byId = new Map(
      [...livingParticipants, ...livingShareHolders].map((p) => [p.id, p]),
    );

    xpSummary = [];
    const instanceUpdates = [];
    const levelMetas: {
      instanceId: string;
      speciesId: number;
      name: string;
      fromSpriteUrl: string;
      isShiny: boolean;
      fromLevel: number;
      toLevel: number;
      leveledUpTo: number | null;
      share: number;
      xpBefore: number;
      xpAfter: number;
    }[] = [];

    const activeShare = shareById.get(instance.id) ?? 0;
    xpGained = activeShare > 0 ? activeShare : null;

    for (const [id, share] of shareById) {
      if (share <= 0) continue;
      const p = byId.get(id);
      if (!p) continue;
      const isActive = p.id === instance.id;
      const hpBefore = isActive ? playerHp : Math.max(0, p.currentHp);
      const result = applyXpGain(
        p.xp,
        p.level,
        hpBefore,
        p.unspentPoints,
        p.species.baseHp,
        p.ptConstitution,
        share,
      );
      // Banca / Exp. Share debilitados: gana XP pero no revive por el +HP de level-up.
      const newCurrentHp = !isActive && p.currentHp <= 0 ? 0 : result.newCurrentHp;
      levelMetas.push({
        instanceId: p.id,
        speciesId: p.speciesId,
        name: p.nickname ?? p.species.name,
        fromSpriteUrl: p.species.spriteUrl,
        isShiny: p.isShiny,
        fromLevel: p.level,
        toLevel: result.newLevel,
        leveledUpTo: result.leveledUpTo,
        share,
        xpBefore: p.xp,
        xpAfter: result.newXpTotal,
      });
      instanceUpdates.push(
        prisma.pokemonInstance.update({
          where: { id: p.id },
          data: {
            xp: result.newXpTotal,
            level: result.newLevel,
            unspentPoints: result.newUnspentPoints,
            currentHp: newCurrentHp,
          },
        }),
      );
      if (isActive) {
        playerMaxHp = result.newMaxHp;
        leveledUpTo = result.leveledUpTo;
      }
    }

    async function buildXpSummary(): Promise<XpSummaryEntry[]> {
      const entries: XpSummaryEntry[] = [];
      for (const meta of levelMetas) {
        let autoTaught: LevelUpMoveInfo[] = [];
        let pendingMoves: LevelUpMoveInfo[] = [];
        let evolveOffer: EvolveOffer | null = null;
        let knownMoves: KnownMoveInfo[] = [];
        if (meta.leveledUpTo != null) {
          try {
            const effects = await resolveLevelUpEffects(
              meta.instanceId,
              meta.speciesId,
              meta.fromLevel,
              meta.toLevel,
            );
            autoTaught = effects.autoTaught;
            pendingMoves = effects.pendingMoves;
            evolveOffer = effects.evolveOffer;
            knownMoves = effects.knownMoves;
          } catch (err) {
            console.error("[battle-move] resolveLevelUpEffects", err);
          }
        }
        entries.push({
          instanceId: meta.instanceId,
          name: meta.name,
          fromSpriteUrl: meta.fromSpriteUrl,
          isShiny: meta.isShiny,
          xpGained: meta.share,
          leveledUpTo: meta.leveledUpTo,
          previousLevel: meta.fromLevel,
          xpBefore: meta.xpBefore,
          xpAfter: meta.xpAfter,
          autoTaught,
          pendingMoves,
          evolveOffer,
          knownMoves,
        });
      }
      return entries;
    }

    if (battle.gymTrainerId && battle.gymRunId) {
      const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
      await prisma.$transaction([
        ...instanceUpdates,
        prisma.battleSession.update({
          where: { id: battle.id },
          data: { status: "WON", wildCurrentHp: 0, pendingXp: 0, log: finalLog },
        }),
        prisma.battleLog.create({
          data: { kind: battleKind, userId, userWon: true, gymId: battle.gymId },
        }),
        prisma.gymRun.update({
          where: { id: battle.gymRunId },
          data: { clearedTrainerSlots: { increment: 1 } },
        }),
      ]);
      xpSummary = await buildXpSummary();
      revalidatePath(`/${locale}/team`);
      revalidateCombatUi(locale);
      return {
        events,
        playerMaxHp,
        wildMaxHp: battle.wildMaxHp,
        outcome: "trainer_cleared",
        leveledUpTo,
        xpGained: activeShare,
        xpSummary,
        coinsGained: coinsAwarded,
        badgeEarned: false,
        tmRewardName: null,
        heldRewardName: null,
        rematch: alreadyHasThisBadge,
        playerMovesPp,
        playerChoiceLockMoveId: newChoiceLockMoveId,
        playerChargeMoveId: newPlayerChargeMoveId,
        playerStatus: playerState.status,
        wildStatus: wildState.status,
        pvpResult: null,
        nextOpponent: null,
      };
    }

    // Torre de Combate: un piso = una batalla (MVP).
    if (battle.towerRunId) {
      const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
      const { settleTowerFloorWin } = await import("@/lib/tower/settle");
      const { parseTowerTeamSnapshot } = await import("@/lib/tower/team");
      const { lockUsers } = await import("@/lib/db-locks");

      await prisma.$transaction([
        ...instanceUpdates,
        prisma.battleSession.update({
          where: { id: battle.id },
          data: { status: "WON", wildCurrentHp: 0, pendingXp: 0, log: finalLog },
        }),
        prisma.battleLog.create({
          data: { kind: "PVE_TOWER", userId, userWon: true },
        }),
      ]);

      await prisma.$transaction(
        async (tx) => {
          await lockUsers(tx, userId);
          const run = await tx.towerRun.findFirstOrThrow({
            where: { id: battle.towerRunId! },
          });
          const snap = parseTowerTeamSnapshot(run.teamSnapshot);
          const instances = await tx.pokemonInstance.findMany({
            where: { id: { in: snap.map((m) => m.instanceId) } },
            select: { id: true, currentHp: true },
          });
          // Solo banca en pendingLoot — el grant ocurre al reclamar en /tower.
          await settleTowerFloorWin(tx, {
            userId,
            runId: battle.towerRunId!,
            instances,
          });
        },
        { timeout: 20_000 },
      );

      xpSummary = await buildXpSummary();
      coinsAwarded = 0;
      revalidatePath(`/${locale}/tower`);
      revalidatePath(`/${locale}/team`);
      revalidateCombatUi(locale);
      return {
        events,
        playerMaxHp,
        wildMaxHp: battle.wildMaxHp,
        outcome: "won",
        leveledUpTo,
        xpGained: activeShare,
        xpSummary,
        coinsGained: coinsAwarded,
        badgeEarned: false,
        tmRewardName: null,
        heldRewardName: null,
        rematch: false,
        playerMovesPp,
        playerChoiceLockMoveId: newChoiceLockMoveId,
        playerChargeMoveId: newPlayerChargeMoveId,
        playerStatus: playerState.status,
        wildStatus: wildState.status,
        pvpResult: null,
        nextOpponent: null,
      };
    }

    // Entrenador de ruta: no da stage ni mastery, da su recompensa una vez.
    const routeTrainer = battle.routeTrainerId ? getRouteTrainer(battle.routeTrainerId) : null;

    badgeEarned = battle.gymId !== null && !alreadyHasThisBadge;
    const coinsGained =
      battle.gymId || battle.routeTrainerId || battle.towerRunId
        ? null
        : applyBonus(coinsForVictory(battle.wildLevel), zone?.bonuses.coins ?? 0);
    const gymCoins = battle.gymId
      ? Math.floor((gym?.coinReward ?? 0) * gymRematchCoinMultiplier(alreadyHasThisBadge))
      : 0;
    // El líder regala una MT de su tipo la primera vez que se lo vence —
    // no en revanchas, mismo criterio que la medalla. Brock también da Exp. Share.
    const gymTmMoveName = badgeEarned && gym ? GYM_TM_REWARD_BY_TYPE[gym.type] : undefined;
    const gymTmItem = gymTmMoveName
      ? await prisma.item.findFirst({ where: { type: "MACHINE", move: { name: gymTmMoveName } } })
      : null;
    tmRewardName = gymTmItem?.name ?? null;
    const gymHeldItemName =
      badgeEarned && gym ? GYM_HELD_ITEM_REWARD_BY_TYPE[gym.type] : undefined;
    const gymHeldItem = gymHeldItemName
      ? await prisma.item.findFirst({ where: { name: gymHeldItemName } })
      : null;
    heldRewardName = gymHeldItem?.name ?? null;
    coinsAwarded = (coinsGained ?? 0) + gymCoins + (routeTrainer?.coinReward ?? 0);
    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
    await prisma.$transaction([
      ...instanceUpdates,
      ...(coinsGained !== null
        ? [prisma.user.update({ where: { id: userId }, data: { coins: { increment: coinsGained } } })]
        : []),
      ...(routeTrainer
        ? [
            prisma.user.update({
              where: { id: userId },
              data: { coins: { increment: routeTrainer.coinReward } },
            }),
            prisma.trainerDefeat.upsert({
              where: { userId_trainerId: { userId, trainerId: routeTrainer.id } },
              create: {
                userId,
                trainerId: routeTrainer.id,
                locationId: routeTrainer.locationId,
              },
              update: {},
            }),
          ]
        : []),
      prisma.battleSession.update({
        where: { id: battle.id },
        data: { status: "WON", wildCurrentHp: 0, pendingXp: 0, log: finalLog },
      }),
      prisma.battleLog.create({
        data: { kind: battleKind, userId, userWon: true, gymId: battle.gymId },
      }),
      ...(battle.gymId
        ? [
            prisma.badge.upsert({
              where: { userId_gymId: { userId, gymId: battle.gymId } },
              create: { userId, gymId: battle.gymId },
              update: {},
            }),
            prisma.gymAttempt.create({ data: { userId, gymId: battle.gymId, won: true } }),
            prisma.user.update({
              where: { id: userId },
              data: { coins: { increment: gymCoins } },
            }),
          ]
        : []),
      ...(gymTmItem
        ? [
            prisma.inventoryItem.upsert({
              where: { userId_itemId: { userId, itemId: gymTmItem.id } },
              create: { userId, itemId: gymTmItem.id, quantity: 1 },
              update: { quantity: { increment: 1 } },
            }),
          ]
        : []),
      ...(gymHeldItem
        ? [
            prisma.inventoryItem.upsert({
              where: { userId_itemId: { userId, itemId: gymHeldItem.id } },
              create: { userId, itemId: gymHeldItem.id, quantity: 1 },
              update: { quantity: { increment: 1 } },
            }),
          ]
        : []),
      ...(battle.gymRunId
        ? [prisma.gymRun.update({ where: { id: battle.gymRunId }, data: { status: "WON" } })]
        : []),
    ]);

    xpSummary = await buildXpSummary();

    if (!battle.gymId && !battle.routeTrainerId && !battle.towerRunId) {
      await completeFarmingStageOnWildWin(userId);
      if (zone) await grantZoneMastery(userId, zone.locationId);
    } else if (badgeEarned && gym) {
      await syncCampaignAfterGymBadge(userId, gym.order);
    }

    if (battle.gymId) {
      const { notifyGymResult, notifyGymTmReward } = await import("@/lib/notifications");
      const { avatarRewardsForGymOrder } = await import("@/lib/avatar-unlocks");
      const avatarSlugs =
        badgeEarned && gym ? [...avatarRewardsForGymOrder(gym.order)] : [];
      const avatarsUnlocked = avatarSlugs.length;
      // El mismo botín que ya se acreditó, empaquetado para la celebración:
      // sin esto la pantalla de medalla sólo nombraba la MT y el jugador no
      // llegaba a ver ni el oro ni los avatares que acababa de ganar.
      if (badgeEarned) {
        gymFirstWin = {
          coins: gymCoins,
          tmName: tmRewardName,
          heldName: heldRewardName,
          avatarSlugs,
        };
      }
      await notifyGymResult(userId, battle.gymId, true, {
        rematch: alreadyHasThisBadge,
        avatarsUnlocked: avatarsUnlocked > 0 ? avatarsUnlocked : undefined,
      });
      if (badgeEarned && tmRewardName) {
        await notifyGymTmReward(userId, battle.gymId, tmRewardName);
      }
    }
  } else if (lostBattle) {
    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);

    if (battle.pvpMatchId && battle.pvpMatch) {
      const match = battle.pvpMatch;
      await prisma.$transaction(
        async (tx) => {
          await lockUsers(tx, userId, match.opponentId);
          await tx.pokemonInstance.update({
            where: { id: instance.id },
            data: { currentHp: 0 },
          });
          await tx.battleSession.update({
            where: { id: battle.id },
            data: { status: "LOST", log: finalLog, ...battleStateData },
          });
          await tx.battleLog.create({
            data: {
              kind: "PVP",
              userId,
              opponentId: match.opponentId,
              userWon: false,
            },
          });
          const settled = await settlePvpMatch(tx, {
            matchId: match.id,
            challengerId: match.challengerId,
            opponentId: match.opponentId,
            challengerWon: false,
            mode: match.mode,
            seasonKey: match.seasonKey ?? "unknown",
            challengerRatingBefore: match.challengerRatingBefore,
            opponentRatingBefore: match.opponentRatingBefore,
            challengerTeam: match.challengerTeam,
            koLog: [
              ...match.koLog,
              `b:${pvpActive?.name ?? battle.wildSpecies.name}>a:${playerState.name}`,
            ],
            turnLog: finalLog,
            turns: match.turns + 1,
            restoreTeam: true,
          });
          pvpResult = {
            matchId: match.id,
            ratingBefore: match.challengerRatingBefore,
            ratingAfter: settled.challengerAfter,
            coinsAwarded: settled.coinsAwarded,
          };
          coinsAwarded = settled.coinsAwarded;
        },
        { timeout: 20_000 },
      );

      const oppUser = await prisma.user.findUnique({
        where: { id: match.opponentId },
        select: { username: true },
      });
      const meUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      await notifySettledPvp({
        matchId: match.id,
        challengerId: match.challengerId,
        opponentId: match.opponentId,
        challengerName: meUser?.username ?? "Trainer",
        opponentName: oppUser?.username ?? "Rival",
        challengerWon: false,
      });
      revalidatePath(`/${locale}/pvp`);
      revalidatePath(`/${locale}/ranking`);
    } else if (battle.clanWarBattleId && battle.clanWarBattle) {
      const slot = battle.clanWarBattle;
      const war = slot.war;
      const membership = await prisma.clanMember.findUnique({ where: { userId } });
      const myClanId = membership?.clanId;
      const foeUserId = battle.opponentUserId;
      const foeClanId =
        myClanId === war.clanAId
          ? war.clanBId
          : myClanId === war.clanBId
            ? war.clanAId
            : null;
      if (myClanId && foeUserId && foeClanId) {
        await prisma.$transaction(
          async (tx) => {
            await lockUsers(tx, userId, foeUserId);
            await tx.pokemonInstance.update({
              where: { id: instance.id },
              data: { currentHp: 0 },
            });
            await tx.battleSession.update({
              where: { id: battle.id },
              data: { status: "LOST", log: finalLog, ...battleStateData },
            });
            await settleClanWarSlot(tx, {
              battleId: slot.id,
              winnerClanId: foeClanId,
              winnerUserId: foeUserId,
              koLog: [
                ...(Array.isArray(slot.koLog) ? slot.koLog : []),
                `b:${pvpActive?.name ?? battle.wildSpecies.name}>a:${playerState.name}`,
              ],
              restoreChallengerTeam: slot.challengerTeam,
            });
          },
          { timeout: 20_000 },
        );
        revalidatePath(`/${locale}/clans/${myClanId}`);
        revalidateCombatUi(locale);
      }
    } else if (battle.towerRunId) {
      const { settleTowerFloorLoss } = await import("@/lib/tower/settle");
      const { parseTowerTeamSnapshot } = await import("@/lib/tower/team");
      const { lockUsers } = await import("@/lib/db-locks");
      await prisma.$transaction(
        async (tx) => {
          await lockUsers(tx, userId);
          await tx.pokemonInstance.update({
            where: { id: instance.id },
            data: { currentHp: 0 },
          });
          await tx.battleSession.update({
            where: { id: battle.id },
            data: { status: "LOST", log: finalLog, ...battleStateData },
          });
          await tx.battleLog.create({
            data: { kind: "PVE_TOWER", userId, userWon: false },
          });
          const run = await tx.towerRun.findFirstOrThrow({
            where: { id: battle.towerRunId! },
          });
          const snap = parseTowerTeamSnapshot(run.teamSnapshot);
          const instances = await tx.pokemonInstance.findMany({
            where: { id: { in: snap.map((m) => m.instanceId) } },
            select: { id: true, currentHp: true },
          });
          await settleTowerFloorLoss(tx, {
            userId,
            runId: battle.towerRunId!,
            instances: instances.map((i) =>
              i.id === instance.id ? { id: i.id, currentHp: 0 } : i,
            ),
          });
        },
        { timeout: 20_000 },
      );
      revalidatePath(`/${locale}/tower`);
    } else {
      await prisma.$transaction([
        prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: 0 } }),
        prisma.battleSession.update({
          where: { id: battle.id },
          data: { status: "LOST", log: finalLog, ...battleStateData },
        }),
        prisma.battleLog.create({
          data: { kind: battleKind, userId, userWon: false, gymId: battle.gymId },
        }),
        ...(battle.gymId
          ? [prisma.gymAttempt.create({ data: { userId, gymId: battle.gymId, won: false } })]
          : []),
        ...(battle.gymRunId
          ? [prisma.gymRun.update({ where: { id: battle.gymRunId }, data: { status: "ABANDONED" } })]
          : []),
      ]);

      if (battle.gymId) {
        const { notifyGymResult } = await import("@/lib/notifications");
        await notifyGymResult(userId, battle.gymId, false);
      }
    }
  } else if (mustSwitch) {
    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
    await prisma.$transaction([
      prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: 0 } }),
      prisma.battleSession.update({
        where: { id: battle.id },
        data: {
          ...battleStateData,
          log: finalLog,
          turnDeadlineAt: turnDeadlineForBattle(battle),
        },
      }),
    ]);
  } else {
    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
    await prisma.$transaction([
      prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: playerHp } }),
      prisma.battleSession.update({
        where: { id: battle.id },
        data: {
          ...battleStateData,
          log: finalLog,
          turnDeadlineAt: turnDeadlineForBattle(battle),
        },
      }),
    ]);
  }

  revalidatePath(`/${locale}/team`);
  if (wonBattle || lostBattle) {
    revalidateCombatUi(locale);
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/campaign`);
  }

  const outcome = wonBattle
    ? "won"
    : lostBattle
      ? "lost"
      : mustSwitch
        ? "fainted"
        : "ongoing";

  return {
    events,
    playerMaxHp,
    wildMaxHp: battle.wildMaxHp,
    outcome,
    leveledUpTo,
    xpGained,
    xpSummary,
    coinsGained: coinsAwarded,
    badgeEarned,
    tmRewardName,
    heldRewardName,
    gymFirstWin,
    rematch: alreadyHasThisBadge,
    playerMovesPp,
    playerChoiceLockMoveId: newChoiceLockMoveId,
    playerChargeMoveId: newPlayerChargeMoveId,
    playerStatus: playerState.status,
    wildStatus: wildState.status,
    pvpResult,
    nextOpponent,
    turnDeadlineAt:
      outcome === "ongoing" || outcome === "fainted"
        ? turnDeadlineForBattle(battle)?.toISOString() ?? null
        : null,
  };
}
