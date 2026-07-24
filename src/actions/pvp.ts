"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { allowAction } from "@/lib/rate-limit";
import { blockIfInCombat } from "@/lib/battle-lock";
import { calculateMaxHp } from "@/lib/stats";
import { playerCombatantStats } from "@/lib/combatant";
import { getCurrentEnergy } from "@/lib/energy";
import { simulatePvpBattle, type PvpTeam } from "@/lib/pvp-battle";
import { ratingDeltas } from "@/lib/pvp-rating";
import type { MoveSnapshot } from "@/lib/battle";

// PvP asíncrono (dossier fase 4). El servidor arma los dos equipos, simula la
// batalla con el mismo motor que el PvE y persiste el resultado + el nuevo
// rating Elo de ambos. No hay turnos en vivo: eso llega con Supabase Realtime.
//
// Los equipos pelean a HP completo y la simulación NO toca el HP real de los
// Pokémon: PvP es una foto del equipo, no modifica tu colección.

const PVP_ENERGY_COST = 1;
const RATE_LIMIT_WINDOW_MS = 60_000;
const PVP_LIMIT = 15;
// De cuántos rivales cercanos en rating se elige al azar (evita siempre el mismo).
const MATCH_POOL = 8;

class PvpError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

function backToPvp(locale: string, error: string) {
  revalidatePath(`/${locale}/pvp`);
  redirect({ href: `/pvp?error=${error}`, locale });
}

type TeamRow = {
  nickname: string | null;
  level: number;
  ptStrength: number;
  ptDexterity: number;
  ptIntelligence: number;
  ptSpeed: number;
  species: {
    name: string;
    baseHp: number;
    baseAttack: number;
    baseDefense: number;
    baseSpAtk: number;
    baseSpDef: number;
    baseSpeed: number;
    types: string[];
  };
  moves: { move: { id: number; name: string; type: string; category: MoveSnapshot["category"]; power: number | null; accuracy: number | null; priority: number } }[];
};

function buildTeam(rows: TeamRow[]): PvpTeam {
  return rows.map((p) => ({
    name: p.nickname ?? p.species.name,
    maxHp: calculateMaxHp(p.species.baseHp, p.level),
    stats: playerCombatantStats(p.species, p.level, p),
    moves: p.moves.map((m) => ({
      id: m.move.id,
      name: m.move.name,
      type: m.move.type,
      category: m.move.category,
      power: m.move.power,
      accuracy: m.move.accuracy,
      priority: m.move.priority,
    })),
  }));
}

const TEAM_INCLUDE = {
  species: true,
  moves: { include: { move: true }, orderBy: { slot: "asc" } },
} as const;

export async function findMatch(locale: string) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) return;

  if (!allowAction(`pvp:match:${userId}`, PVP_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    backToPvp(locale, "rate_limited");
    return;
  }

  // Mi equipo (fuera de la transacción: es una lectura para simular).
  const myTeamRows = await prisma.pokemonInstance.findMany({
    where: { ownerId: userId, teamSlot: { not: null } },
    orderBy: { teamSlot: "asc" },
    include: TEAM_INCLUDE,
  });
  if (myTeamRows.length === 0) {
    backToPvp(locale, "no_team");
    return;
  }

  // Rival: entre los que tienen equipo, los de rating más cercano al mío.
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { pvpRating: true },
  });
  const candidates = await prisma.user.findMany({
    where: { id: { not: userId }, pokemon: { some: { teamSlot: { not: null } } } },
    select: { id: true, pvpRating: true },
  });
  if (candidates.length === 0) {
    backToPvp(locale, "no_opponents");
    return;
  }
  const pool = candidates
    .sort((a, b) => Math.abs(a.pvpRating - me.pvpRating) - Math.abs(b.pvpRating - me.pvpRating))
    .slice(0, MATCH_POOL);
  const opponent = pool[Math.floor(Math.random() * pool.length)];

  const oppTeamRows = await prisma.pokemonInstance.findMany({
    where: { ownerId: opponent.id, teamSlot: { not: null } },
    orderBy: { teamSlot: "asc" },
    include: TEAM_INCLUDE,
  });
  if (oppTeamRows.length === 0) {
    // El rival vació su equipo entre la búsqueda y ahora — reintentar.
    backToPvp(locale, "no_opponents");
    return;
  }

  // Simulación pura (sin DB). El challenger es el lado "a".
  const result = simulatePvpBattle(buildTeam(myTeamRows), buildTeam(oppTeamRows));
  const challengerWon = result.winner === "a";

  let error: string | undefined;
  let matchId: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      // Lock de ambos jugadores, orden por id (anti-deadlock, ver db-locks).
      await lockUsers(tx, userId, opponent.id);

      // Cobra energía con el patrón de regeneración perezosa del proyecto.
      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { energy: true, energyMax: true, energyUpdatedAt: true, pvpRating: true },
      });
      const currentEnergy = getCurrentEnergy(fresh.energy, fresh.energyMax, fresh.energyUpdatedAt);
      if (currentEnergy < PVP_ENERGY_COST) throw new PvpError("no_energy");

      const opp = await tx.user.findUniqueOrThrow({
        where: { id: opponent.id },
        select: { pvpRating: true },
      });

      const { challengerAfter, opponentAfter } = ratingDeltas(
        fresh.pvpRating,
        opp.pvpRating,
        challengerWon,
      );

      const match = await tx.pvpMatch.create({
        data: {
          challengerId: userId,
          opponentId: opponent.id,
          winnerId: challengerWon ? userId : opponent.id,
          challengerRatingBefore: fresh.pvpRating,
          challengerRatingAfter: challengerAfter,
          opponentRatingBefore: opp.pvpRating,
          opponentRatingAfter: opponentAfter,
          koLog: result.koLog,
          turns: result.turns,
        },
        select: { id: true },
      });
      matchId = match.id;

      await tx.user.update({
        where: { id: userId },
        data: {
          energy: currentEnergy - PVP_ENERGY_COST,
          energyUpdatedAt: new Date(),
          pvpRating: challengerAfter,
          ...(challengerWon ? { pvpWins: { increment: 1 } } : { pvpLosses: { increment: 1 } }),
        },
      });
      await tx.user.update({
        where: { id: opponent.id },
        data: {
          pvpRating: opponentAfter,
          ...(challengerWon ? { pvpLosses: { increment: 1 } } : { pvpWins: { increment: 1 } }),
        },
      });
    });
  } catch (e) {
    if (e instanceof PvpError) error = e.code;
    else throw e;
  }

  if (error || !matchId) {
    backToPvp(locale, error ?? "no_opponents");
    return;
  }

  revalidatePath(`/${locale}/pvp`);
  revalidatePath(`/${locale}/ranking`);
  redirect({ href: `/pvp/${matchId}`, locale });
}
