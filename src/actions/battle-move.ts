"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp, xpForLevel } from "@/lib/stats";
import {
  resolveMoveUse,
  xpForVictory,
  playerActsFirst,
  type MoveSnapshot,
  type TurnEvent,
} from "@/lib/battle";
import { playerCombatantStats, wildCombatantStats } from "@/lib/combatant";
import { hasHealthyBackup } from "@/lib/team";
import { getMovesetForLevel } from "@/lib/moveset";

const MAX_LOG_LINES = 20;
const UNSPENT_POINTS_PER_LEVEL = 3;

export interface XpSummaryEntry {
  instanceId: string;
  name: string;
  xpGained: number;
  leveledUpTo: number | null;
}

export interface UseMoveResult {
  events: TurnEvent[];
  playerMaxHp: number;
  wildMaxHp: number;
  outcome: "ongoing" | "won" | "lost" | "fainted" | "gym_continues" | "trainer_cleared";
  leveledUpTo: number | null;
  xpGained: number | null;
  xpSummary: XpSummaryEntry[] | null;
  badgeEarned: boolean;
  nextOpponent: { name: string; level: number; spriteUrl: string; maxHp: number; types: string[] } | null;
}

// Aplica XP ganada a un Pokémon puntual, subiendo de nivel las veces que
// corresponda (mismo criterio que antes, ahora reusable por cada
// participante que recibe su parte del reparto al terminar la batalla).
function applyXpGain(
  currentXp: number,
  currentLevel: number,
  currentHp: number,
  unspentPoints: number,
  baseHp: number,
  xpEarned: number,
) {
  const newXpTotal = currentXp + xpEarned;
  let newLevel = currentLevel;
  let newUnspentPoints = unspentPoints;
  let newMaxHp = calculateMaxHp(baseHp, newLevel);
  let newCurrentHp = currentHp;

  while (newXpTotal >= xpForLevel(newLevel + 1)) {
    newLevel += 1;
    newUnspentPoints += UNSPENT_POINTS_PER_LEVEL;
    const previousMaxHp = newMaxHp;
    newMaxHp = calculateMaxHp(baseHp, newLevel);
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
      pokemonInstance: { include: { species: true, moves: { include: { move: true } } } },
      wildSpecies: true,
    },
  });
  if (!battle) return null;

  const chosenMove = battle.pokemonInstance.moves.find((m) => m.moveId === moveId);
  if (!chosenMove) return null;

  const wildMoves = await prisma.move.findMany({ where: { id: { in: battle.wildMoveIds } } });
  const wildMove = wildMoves[Math.floor(Math.random() * wildMoves.length)];

  const instance = battle.pokemonInstance;
  const playerStats = playerCombatantStats(instance.species, instance.level, instance);
  const wildStats = wildCombatantStats(battle.wildSpecies, battle.wildLevel);

  const playerMoveSnapshot: MoveSnapshot = chosenMove.move;
  const wildMoveSnapshot: MoveSnapshot = wildMove;

  let playerHp = instance.currentHp;
  let wildHp = battle.wildCurrentHp;
  const log: string[] = [];
  const events: TurnEvent[] = [];

  const playerFirst = playerActsFirst(
    playerMoveSnapshot,
    wildMoveSnapshot,
    playerStats.speed,
    wildStats.speed,
  );
  const order = playerFirst
    ? [
        { side: "player" as const, name: instance.nickname ?? instance.species.name, attacker: playerStats, defender: wildStats, move: playerMoveSnapshot },
        { side: "wild" as const, name: battle.wildSpecies.name, attacker: wildStats, defender: playerStats, move: wildMoveSnapshot },
      ]
    : [
        { side: "wild" as const, name: battle.wildSpecies.name, attacker: wildStats, defender: playerStats, move: wildMoveSnapshot },
        { side: "player" as const, name: instance.nickname ?? instance.species.name, attacker: playerStats, defender: wildStats, move: playerMoveSnapshot },
      ];

  for (const turn of order) {
    if (playerHp <= 0 || wildHp <= 0) break;

    const result = resolveMoveUse(turn.attacker, turn.defender, turn.move);
    const defenderSide = turn.side === "player" ? "wild" : "player";

    if (!result.hit) {
      log.push(`${turn.name} usó ${turn.move.name} pero falló.`);
      events.push({
        side: turn.side,
        moveName: turn.move.name,
        hit: false,
        isStatus: false,
        damage: 0,
        effectiveness: 1,
        hpAfter: defenderSide === "wild" ? wildHp : playerHp,
      });
      continue;
    }

    if (turn.move.category === "STATUS") {
      log.push(`${turn.name} usó ${turn.move.name}.`);
      events.push({
        side: turn.side,
        moveName: turn.move.name,
        hit: true,
        isStatus: true,
        damage: 0,
        effectiveness: 1,
        hpAfter: defenderSide === "wild" ? wildHp : playerHp,
      });
      continue;
    }

    if (turn.side === "player") {
      wildHp = Math.max(0, wildHp - result.damage);
    } else {
      playerHp = Math.max(0, playerHp - result.damage);
    }

    log.push(`${turn.name} usó ${turn.move.name} e hizo ${result.damage} de daño.`);
    if (result.effectiveness > 1) log.push("¡Es súper efectivo!");
    if (result.effectiveness > 0 && result.effectiveness < 1) log.push("No es muy efectivo...");
    if (result.effectiveness === 0) log.push("No tuvo efecto...");

    events.push({
      side: turn.side,
      moveName: turn.move.name,
      hit: true,
      isStatus: false,
      damage: result.damage,
      effectiveness: result.effectiveness,
      hpAfter: defenderSide === "wild" ? wildHp : playerHp,
    });
  }

  const wonBattle = wildHp <= 0 && playerHp > 0;
  const fainted = playerHp <= 0;
  const mustSwitch = fainted && (await hasHealthyBackup(userId, instance.id));
  const lostBattle = fainted && !mustSwitch;
  let playerMaxHp = calculateMaxHp(instance.species.baseHp, instance.level);
  let leveledUpTo: number | null = null;
  let xpGained: number | null = null;
  let badgeEarned = false;
  let nextOpponent: UseMoveResult["nextOpponent"] = null;
  const battleKind = battle.gymId ? ("PVE_GYM" as const) : ("PVE_WILD" as const);
  const gym = battle.gymId ? await prisma.gym.findUnique({ where: { id: battle.gymId } }) : null;

  let xpSummary: XpSummaryEntry[] | null = null;

  if (wonBattle) {
    log.push(`¡${battle.wildSpecies.name} debilitado!`);

    const koXp = xpForVictory(battle.wildLevel);

    // Sigue habiendo Pokémon en el equipo del oponente ACTUAL (entrenador o
    // líder): el combate continúa, no se corta acá. La XP se acumula en la
    // sesión pero NO se reparte todavía — recién se reparte y se aplican
    // niveles cuando la sesión termina de verdad (más abajo), entre todos
    // los Pokémon que pelearon y siguen con vida.
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
      log.push(
        `¡${battle.gymTrainerId ? "El entrenador" : "El líder"} manda a ${nextOpponentMon.species.name}!`,
      );
      nextOpponent = {
        name: nextOpponentMon.species.name,
        level: nextOpponentMon.level,
        spriteUrl: nextOpponentMon.species.spriteUrl,
        maxHp: nextMaxHp,
        types: nextOpponentMon.species.types,
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
            wildSpeciesId: nextOpponentMon.speciesId,
            wildLevel: nextOpponentMon.level,
            wildCurrentHp: nextMaxHp,
            wildMaxHp: nextMaxHp,
            wildMoveIds: nextMoveIds,
            gymPokemonSlot: nextOpponentMon.slot,
            pendingXp: { increment: koXp },
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
        badgeEarned: false,
        nextOpponent,
      };
    }

    // Se acabó el equipo del oponente actual — la sesión TERMINA acá (le
    // ganó al entrenador o al líder). Reparto la XP total acumulada en la
    // sesión entre todos los participantes que siguen con vida.
    const totalXp = battle.pendingXp + koXp;
    const participantIds = battle.participantIds.includes(instance.id)
      ? battle.participantIds
      : [...battle.participantIds, instance.id];
    const participants = await prisma.pokemonInstance.findMany({
      where: { id: { in: participantIds } },
      include: { species: true },
    });
    const survivors = participants.filter((p) => (p.id === instance.id ? playerHp > 0 : p.currentHp > 0));
    const share = Math.max(1, Math.floor(totalXp / survivors.length));
    xpGained = share;

    xpSummary = [];
    const instanceUpdates = [];
    for (const p of survivors) {
      const isActive = p.id === instance.id;
      const result = applyXpGain(
        p.xp,
        p.level,
        isActive ? playerHp : p.currentHp,
        p.unspentPoints,
        p.species.baseHp,
        share,
      );
      xpSummary.push({
        instanceId: p.id,
        name: p.nickname ?? p.species.name,
        xpGained: share,
        leveledUpTo: result.leveledUpTo,
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

    // Si era un entrenador subordinado, la corrida avanza pero el gimnasio
    // todavía no se ganó — se vuelve al pasillo. Si era el líder, recién ahí
    // es "WON" de verdad.
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

      revalidatePath(`/${locale}/team`);

      return {
        events,
        playerMaxHp,
        wildMaxHp: battle.wildMaxHp,
        outcome: "trainer_cleared",
        leveledUpTo,
        xpGained: share,
        xpSummary,
        badgeEarned: false,
        nextOpponent: null,
      };
    }

    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
    badgeEarned = battle.gymId !== null;
    await prisma.$transaction([
      ...instanceUpdates,
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
              data: { coins: { increment: gym?.coinReward ?? 0 } },
            }),
          ]
        : []),
      ...(battle.gymRunId ? [prisma.gymRun.update({ where: { id: battle.gymRunId }, data: { status: "WON" } })] : []),
    ]);
  } else if (lostBattle) {
    log.push(`${instance.nickname ?? instance.species.name} se debilitó.`);

    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
    await prisma.$transaction([
      prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: 0 } }),
      prisma.battleSession.update({
        where: { id: battle.id },
        data: { status: "LOST", log: finalLog },
      }),
      prisma.battleLog.create({
        data: { kind: battleKind, userId, userWon: false, gymId: battle.gymId },
      }),
      ...(battle.gymId ? [prisma.gymAttempt.create({ data: { userId, gymId: battle.gymId, won: false } })] : []),
      ...(battle.gymRunId
        ? [prisma.gymRun.update({ where: { id: battle.gymRunId }, data: { status: "ABANDONED" } })]
        : []),
    ]);
  } else if (mustSwitch) {
    log.push(`${instance.nickname ?? instance.species.name} se debilitó.`);

    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
    await prisma.$transaction([
      prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: 0 } }),
      prisma.battleSession.update({
        where: { id: battle.id },
        data: { wildCurrentHp: wildHp, log: finalLog },
      }),
    ]);
  } else {
    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
    await prisma.$transaction([
      prisma.pokemonInstance.update({ where: { id: instance.id }, data: { currentHp: playerHp } }),
      prisma.battleSession.update({
        where: { id: battle.id },
        data: { wildCurrentHp: wildHp, log: finalLog },
      }),
    ]);
  }

  revalidatePath(`/${locale}/team`);

  return {
    events,
    playerMaxHp,
    wildMaxHp: battle.wildMaxHp,
    outcome: wonBattle ? "won" : lostBattle ? "lost" : mustSwitch ? "fainted" : "ongoing",
    leveledUpTo,
    xpGained,
    xpSummary,
    badgeEarned,
    nextOpponent,
  };
}
