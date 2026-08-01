"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { allowAction } from "@/lib/rate-limit";
import { blockIfInCombat } from "@/lib/battle-lock";
import { getCurrentEnergy, PVP_BATTLE_ENERGY_COST as PVP_ENERGY_COST } from "@/lib/energy";
import { simulatePvpBattle } from "@/lib/pvp-battle";
import { ensureSeason } from "@/lib/pvp/seasons";
import { notifySettledPvp, settlePvpMatch } from "@/lib/pvp/settle";
import {
  PVP_TEAM_INCLUDE,
  resolveTeamRows,
  snapToSimTeam,
  snapshotTeam,
  type TeamRowForSnap,
} from "@/lib/pvp/team";

// Combate rápido: simulación server-authoritative instantánea (modo QUICK).
// El ranked jugable está en start-pvp-battle.ts.

const RATE_LIMIT_WINDOW_MS = 60_000;
const PVP_LIMIT = 15;
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

async function loadTeamRows(userId: string): Promise<TeamRowForSnap[]> {
  const rows = await prisma.pokemonInstance.findMany({
    where: {
      ownerId: userId,
      OR: [{ pvpSlot: { not: null } }, { teamSlot: { not: null } }],
    },
    include: PVP_TEAM_INCLUDE,
  });
  return resolveTeamRows(rows as TeamRowForSnap[]);
}

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

  const myTeamRows = await loadTeamRows(userId);
  if (myTeamRows.length === 0) {
    backToPvp(locale, "no_team");
    return;
  }

  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { pvpRating: true, username: true },
  });
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: userId },
      OR: [
        { pokemon: { some: { pvpSlot: { not: null } } } },
        { pokemon: { some: { teamSlot: { not: null } } } },
      ],
    },
    select: { id: true, pvpRating: true, username: true },
  });
  if (candidates.length === 0) {
    backToPvp(locale, "no_opponents");
    return;
  }
  const pool = candidates
    .sort((a, b) => Math.abs(a.pvpRating - me.pvpRating) - Math.abs(b.pvpRating - me.pvpRating))
    .slice(0, MATCH_POOL);
  const opponent = pool[Math.floor(Math.random() * pool.length)];
  if (!opponent) {
    backToPvp(locale, "no_opponents");
    return;
  }

  const oppTeamRows = await loadTeamRows(opponent.id);
  if (oppTeamRows.length === 0) {
    backToPvp(locale, "no_opponents");
    return;
  }

  const challengerTeam = snapshotTeam(myTeamRows);
  const opponentTeam = snapshotTeam(oppTeamRows);
  const result = simulatePvpBattle(snapToSimTeam(challengerTeam), snapToSimTeam(opponentTeam));
  const challengerWon = result.winner === "a";

  let error: string | undefined;
  let matchId: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId, opponent.id);

      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          energy: true,
          energyMax: true,
          energyUpdatedAt: true,
          pvpRating: true,
        },
      });
      const currentEnergy = getCurrentEnergy(
        fresh.energy,
        fresh.energyMax,
        fresh.energyUpdatedAt,
      );
      if (currentEnergy < PVP_ENERGY_COST) throw new PvpError("no_energy");

      const season = await ensureSeason(tx, userId);
      await ensureSeason(tx, opponent.id);

      const opp = await tx.user.findUniqueOrThrow({
        where: { id: opponent.id },
        select: { pvpRating: true },
      });

      const match = await tx.pvpMatch.create({
        data: {
          challengerId: userId,
          opponentId: opponent.id,
          mode: "QUICK",
          status: "ACTIVE",
          seasonKey: season.seasonKey,
          challengerRatingBefore: season.resetApplied ? season.rating : fresh.pvpRating,
          opponentRatingBefore: opp.pvpRating,
          challengerTeam,
          opponentTeam,
        },
        select: { id: true },
      });
      matchId = match.id;

      await tx.user.update({
        where: { id: userId },
        data: {
          energy: currentEnergy - PVP_ENERGY_COST,
          energyUpdatedAt: new Date(),
        },
      });

      await settlePvpMatch(tx, {
        matchId: match.id,
        challengerId: userId,
        opponentId: opponent.id,
        challengerWon,
        mode: "QUICK",
        seasonKey: season.seasonKey,
        challengerRatingBefore: season.resetApplied ? season.rating : fresh.pvpRating,
        opponentRatingBefore: opp.pvpRating,
        koLog: result.koLog,
        turnLog: result.turnLog,
        turns: result.turns,
        restoreTeam: false,
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

  await notifySettledPvp({
    matchId,
    challengerId: userId,
    opponentId: opponent.id,
    challengerName: me.username,
    opponentName: opponent.username,
    challengerWon,
  });

  revalidatePath(`/${locale}/pvp`);
  revalidatePath(`/${locale}/ranking`);
  redirect({ href: `/pvp/${matchId}`, locale });
}
