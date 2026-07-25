"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateCombatUi } from "@/lib/battle-lock";
import { calculateMaxHp, xpForLevel, UNSPENT_POINTS_PER_LEVEL } from "@/lib/stats";
import {
  effectivePp,
  playerActsFirst,
  STRUGGLE_MOVE,
  xpForVictory,
  type MoveSnapshot,
  type TurnEvent,
} from "@/lib/battle";
import { pickWildMove } from "@/lib/battle-ai";
import { disobeyChance, gymRematchCoinMultiplier } from "@/lib/badge-perks";
import { GYM_TM_REWARD_BY_TYPE } from "@/lib/gym-tm-rewards";
import { playerCombatantStats, wildCombatantStats } from "@/lib/combatant";
import { resolveSingleAction, type SideBattleState } from "@/lib/resolve-action";
import { applyHeldItemToStats, heldItemSnapshotFromItem } from "@/lib/held-items";
import { applyStagesToStats, type StatusCondition } from "@/lib/status";
import { hasHealthyBackup } from "@/lib/team";
import { getMovesetForLevel } from "@/lib/moveset";
import {
  completeFarmingStageOnWildWin,
  syncCampaignAfterGymBadge,
} from "@/lib/campaign/sync";
import type { EvolveOffer, LevelUpMoveInfo } from "@/lib/level-up";
import { resolveLevelUpEffects } from "@/lib/level-up";

const MAX_LOG_LINES = 20;

export interface XpSummaryEntry {
  instanceId: string;
  name: string;
  fromSpriteUrl: string;
  xpGained: number;
  leveledUpTo: number | null;
  previousLevel: number;
  autoTaught: LevelUpMoveInfo[];
  pendingMoves: LevelUpMoveInfo[];
  evolveOffer: EvolveOffer | null;
  /** Movimientos actuales (para elegir cuál olvidar). */
  knownMoves: { slot: number; name: string }[];
}

function coinsForVictory(wildLevel: number): number {
  return 10 + wildLevel * 2;
}

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
  rematch: boolean;
  playerMovesPp: { moveId: number; pp: number }[];
  playerStatus: StatusCondition | null;
  wildStatus: StatusCondition | null;
  /** Si porta un objeto Choice, el movimiento al que quedó atado (o null). */
  playerChoiceLockMoveId: number | null;
  nextOpponent: {
    name: string;
    speciesName: string;
    level: number;
    spriteUrl: string;
    maxHp: number;
    types: string[];
  } | null;
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
          moves: { include: { move: true } },
          heldItem: true,
        },
      },
      wildSpecies: true,
    },
  });
  if (!battle) return null;

  // Choice Band/Specs/Scarf: si ya quedó atado a un movimiento esta batalla,
  // se ignora lo pedido y se fuerza ese movimiento (mismo criterio que los
  // juegos reales — el menú debería ya venir deshabilitado del lado del cliente).
  const effectiveMoveId = battle.playerChoiceLockMoveId ?? moveId;
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
  const wildBase = wildCombatantStats(battle.wildSpecies, battle.wildLevel);
  const playerHeldItem = heldItemSnapshotFromItem(instance.heldItem);
  const playerIsFullyEvolved = instance.species.evolvesTo.length === 0;

  let playerState: SideBattleState = {
    hp: instance.currentHp,
    maxHp: playerMaxHpBase,
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

  const wildPickRaw = pickWildMove(
    wildMoveSnapshots.length > 0 ? wildMoveSnapshots : [STRUGGLE_MOVE],
    wildBase,
    playerBase,
    playerState.hp,
    wildMovePp,
  );
  const wildNoPp = wildMovePp.length > 0 && wildMovePp.every((pp) => pp <= 0);
  const wildMove =
    wildPickRaw.id < 0 || wildNoPp || wildMoveSnapshots.length === 0
      ? STRUGGLE_MOVE
      : wildPickRaw;
  const wi = wildMoveSnapshots.findIndex((m) => m.id === wildMove.id);
  if (wi >= 0 && wildMovePp[wi] > 0) wildMovePp[wi] -= 1;

  let playerItemConsumed = battle.playerItemConsumed;
  let flinchWild = false;

  if (disobeyed) {
    events.push({
      side: "player",
      moveName: playerMoveSnapshot.name,
      moveType: playerMoveSnapshot.type,
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
      if (side === "wild" && flinchWild) {
        events.push({
          side: "wild",
          moveName: wildMove.name,
          moveType: wildMove.type,
          hit: false,
          isStatus: false,
          damage: 0,
          effectiveness: 1,
          hpAfter: playerState.hp,
          skipped: "flinch",
        });
        continue;
      }
      const move = side === "player" ? playerMoveSnapshot : wildMove;
      const outcome = resolveSingleAction(side, move, playerState, wildState, playerItemConsumed);
      events.push(...outcome.events);
      playerState = outcome.player;
      wildState = outcome.wild;
      playerItemConsumed = outcome.itemConsumed;

      if (side === "player" && playerHeldItem?.effect === "FLINCH_CHANCE") {
        const playerHitLanded = outcome.events.some((e) => e.hit && !e.isStatus);
        if (playerHitLanded && Math.random() < (playerHeldItem.value ?? 0.1)) {
          flinchWild = true;
        }
      }
    }

    if (playerMoveSnapshot.id !== STRUGGLE_MOVE.id) {
      const maxPp = chosenMove.move.pp ?? 20;
      const current =
        typeof chosenMove.currentPp === "number" && chosenMove.currentPp > 0
          ? chosenMove.currentPp
          : maxPp;
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
  }

  // Choice Band/Specs/Scarf: queda atado al primer movimiento que usa con
  // el objeto puesto, hasta que cambie de Pokémon o termine la batalla.
  const newChoiceLockMoveId =
    battle.playerChoiceLockMoveId ??
    (!disobeyed && playerHeldItem?.effect === "CHOICE_LOCK" && playerMoveSnapshot.id !== STRUGGLE_MOVE.id
      ? effectiveMoveId
      : null);

  const spentMaxPp = chosenMove.move.pp ?? 20;
  const spentCurrent =
    typeof chosenMove.currentPp === "number" && chosenMove.currentPp > 0
      ? chosenMove.currentPp
      : spentMaxPp;
  const spentPlayerPp =
    disobeyed || playerMoveSnapshot.id === STRUGGLE_MOVE.id
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

  const wonBattle = wildHp <= 0 && playerHp > 0;
  const fainted = playerHp <= 0;
  const mustSwitch = fainted && (await hasHealthyBackup(userId, instance.id));
  const lostBattle = fainted && !mustSwitch;
  let playerMaxHp = playerMaxHpBase;
  let leveledUpTo: number | null = null;
  let xpGained: number | null = null;
  let badgeEarned = false;
  let tmRewardName: string | null = null;
  let coinsAwarded = 0;
  let nextOpponent: UseMoveResult["nextOpponent"] = null;
  const battleKind = battle.gymId ? ("PVE_GYM" as const) : ("PVE_WILD" as const);
  const gym = battle.gymId ? await prisma.gym.findUnique({ where: { id: battle.gymId } }) : null;
  let xpSummary: XpSummaryEntry[] | null = null;

  const battleStateData = {
    wildCurrentHp: Math.max(0, wildHp),
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
    playerChoiceLockMoveId: newChoiceLockMoveId,
    playerItemConsumed,
  };

  if (wonBattle) {
    log.push(`fainted:${battle.wildSpecies.name}`);
    const koXp = xpForVictory(battle.wildLevel);
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
            wildAtkStage: 0,
            wildDefStage: 0,
            wildSpeStage: 0,
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
        rematch: alreadyHasThisBadge,
        playerMovesPp,
        playerChoiceLockMoveId: newChoiceLockMoveId,
        playerStatus: playerState.status,
        wildStatus: null,
        nextOpponent,
      };
    }

    const totalXp = battle.pendingXp + koXp;
    const participantIds = battle.participantIds.includes(instance.id)
      ? battle.participantIds
      : [...battle.participantIds, instance.id];
    const participants = await prisma.pokemonInstance.findMany({
      where: { id: { in: participantIds } },
      include: { species: true },
    });
    const survivors = participants.filter((p) => (p.id === instance.id ? playerHp > 0 : p.currentHp > 0));
    const share = Math.max(1, Math.floor(totalXp / Math.max(1, survivors.length)));
    xpGained = share;

    xpSummary = [];
    const instanceUpdates = [];
    const levelMetas: {
      instanceId: string;
      speciesId: number;
      name: string;
      fromSpriteUrl: string;
      fromLevel: number;
      toLevel: number;
      leveledUpTo: number | null;
      share: number;
    }[] = [];

    for (const p of survivors) {
      const isActive = p.id === instance.id;
      const result = applyXpGain(
        p.xp,
        p.level,
        isActive ? playerHp : p.currentHp,
        p.unspentPoints,
        p.species.baseHp,
        p.ptConstitution,
        share,
      );
      levelMetas.push({
        instanceId: p.id,
        speciesId: p.speciesId,
        name: p.nickname ?? p.species.name,
        fromSpriteUrl: p.species.spriteUrl,
        fromLevel: p.level,
        toLevel: result.newLevel,
        leveledUpTo: result.leveledUpTo,
        share,
      });
      instanceUpdates.push(
        prisma.pokemonInstance.update({
          where: { id: p.id },
          data: {
            xp: result.newXpTotal,
            level: result.newLevel,
            unspentPoints: result.newUnspentPoints,
            currentHp: result.newCurrentHp,
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
          } catch (err) {
            console.error("[battle-move] resolveLevelUpEffects", err);
          }
        }
        const known = await prisma.pokemonMove.findMany({
          where: { pokemonInstanceId: meta.instanceId },
          include: { move: { select: { name: true } } },
          orderBy: { slot: "asc" },
        });
        entries.push({
          instanceId: meta.instanceId,
          name: meta.name,
          fromSpriteUrl: meta.fromSpriteUrl,
          xpGained: meta.share,
          leveledUpTo: meta.leveledUpTo,
          previousLevel: meta.fromLevel,
          autoTaught,
          pendingMoves,
          evolveOffer,
          knownMoves: known.map((m) => ({ slot: m.slot, name: m.move.name })),
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
        xpGained: share,
        xpSummary,
        coinsGained: coinsAwarded,
        badgeEarned: false,
        tmRewardName: null,
        rematch: alreadyHasThisBadge,
        playerMovesPp,
        playerChoiceLockMoveId: newChoiceLockMoveId,
        playerStatus: playerState.status,
        wildStatus: wildState.status,
        nextOpponent: null,
      };
    }

    badgeEarned = battle.gymId !== null && !alreadyHasThisBadge;
    const coinsGained = battle.gymId ? null : coinsForVictory(battle.wildLevel);
    const gymCoins = battle.gymId
      ? Math.floor((gym?.coinReward ?? 0) * gymRematchCoinMultiplier(alreadyHasThisBadge))
      : 0;
    // El líder regala una MT de su tipo la primera vez que se lo vence —
    // no en revanchas, mismo criterio que la medalla.
    const gymTmMoveName = badgeEarned && gym ? GYM_TM_REWARD_BY_TYPE[gym.type] : undefined;
    const gymTmItem = gymTmMoveName
      ? await prisma.item.findFirst({ where: { type: "MACHINE", move: { name: gymTmMoveName } } })
      : null;
    tmRewardName = gymTmItem?.name ?? null;
    coinsAwarded = (coinsGained ?? 0) + gymCoins;
    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
    await prisma.$transaction([
      ...instanceUpdates,
      ...(coinsGained !== null
        ? [prisma.user.update({ where: { id: userId }, data: { coins: { increment: coinsGained } } })]
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
      ...(battle.gymRunId
        ? [prisma.gymRun.update({ where: { id: battle.gymRunId }, data: { status: "WON" } })]
        : []),
    ]);

    xpSummary = await buildXpSummary();

    if (!battle.gymId) {
      await completeFarmingStageOnWildWin(userId);
    } else if (badgeEarned && gym) {
      await syncCampaignAfterGymBadge(userId, gym.order);
    }

    if (battle.gymId) {
      const { notifyGymResult } = await import("@/lib/notifications");
      await notifyGymResult(userId, battle.gymId, true, { rematch: alreadyHasThisBadge });
    }
  } else if (lostBattle) {
    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
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
  } else if (mustSwitch) {
    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
    await prisma.$transaction([
      prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: 0 } }),
      prisma.battleSession.update({
        where: { id: battle.id },
        data: { ...battleStateData, log: finalLog },
      }),
    ]);
  } else {
    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
    await prisma.$transaction([
      prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: playerHp } }),
      prisma.battleSession.update({
        where: { id: battle.id },
        data: { ...battleStateData, log: finalLog },
      }),
    ]);
  }

  revalidatePath(`/${locale}/team`);
  if (wonBattle || lostBattle) {
    revalidateCombatUi(locale);
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/campaign`);
  }

  return {
    events,
    playerMaxHp,
    wildMaxHp: battle.wildMaxHp,
    outcome: wonBattle ? "won" : lostBattle ? "lost" : mustSwitch ? "fainted" : "ongoing",
    leveledUpTo,
    xpGained,
    xpSummary,
    coinsGained: coinsAwarded,
    badgeEarned,
    tmRewardName,
    rematch: alreadyHasThisBadge,
    playerMovesPp,
    playerChoiceLockMoveId: newChoiceLockMoveId,
    playerStatus: playerState.status,
    wildStatus: wildState.status,
    nextOpponent,
  };
}
