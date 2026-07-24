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

const MAX_LOG_LINES = 20;
const UNSPENT_POINTS_PER_LEVEL = 3;

// Ingreso de moneda de la economía (dossier: la energía limita el caudal que
// entra; el mercado y sus comisiones lo drenan).
function coinsForVictory(wildLevel: number): number {
  return 10 + wildLevel * 2;
}

export interface UseMoveResult {
  events: TurnEvent[];
  playerMaxHp: number;
  wildMaxHp: number;
  outcome: "ongoing" | "won" | "lost" | "fainted";
  leveledUpTo: number | null;
  xpGained: number | null;
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

  if (wonBattle) {
    log.push(`¡${battle.wildSpecies.name} salvaje debilitado!`);

    const coinsGained = coinsForVictory(battle.wildLevel);
    log.push(`Ganaste ${coinsGained} monedas.`);

    xpGained = xpForVictory(battle.wildLevel);
    const newXp = instance.xp + xpGained;
    let newLevel = instance.level;
    let newUnspentPoints = instance.unspentPoints;
    let newMaxHp = playerMaxHp;

    while (newXp >= xpForLevel(newLevel + 1)) {
      newLevel += 1;
      newUnspentPoints += UNSPENT_POINTS_PER_LEVEL;
      const previousMaxHp = newMaxHp;
      newMaxHp = calculateMaxHp(instance.species.baseHp, newLevel);
      playerHp += newMaxHp - previousMaxHp;
    }
    if (newLevel > instance.level) {
      leveledUpTo = newLevel;
      playerMaxHp = newMaxHp;
      log.push(`¡${instance.species.name} subió a Nv. ${newLevel}!`);
    }

    const finalLog = [...battle.log, ...log].slice(-MAX_LOG_LINES);
    await prisma.$transaction([
      prisma.pokemonInstance.update({
        where: { id: instance.id },
        data: { currentHp: playerHp, xp: newXp, level: newLevel, unspentPoints: newUnspentPoints },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { coins: { increment: coinsGained } },
      }),
      prisma.battleSession.update({
        where: { id: battle.id },
        data: { status: "WON", wildCurrentHp: 0, log: finalLog },
      }),
      prisma.battleLog.create({
        data: { kind: "PVE_WILD", userId, userWon: true },
      }),
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
        data: { kind: "PVE_WILD", userId, userWon: false },
      }),
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
  };
}
