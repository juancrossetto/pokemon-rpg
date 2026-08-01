"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { allowAction } from "@/lib/rate-limit";
import { blockIfInCombat, revalidateCombatUi } from "@/lib/battle-lock";
import { getCurrentEnergy, PVP_BATTLE_ENERGY_COST as PVP_ENERGY_COST } from "@/lib/energy";
import { ensureSeason } from "@/lib/pvp/seasons";
import {
  PVP_TEAM_INCLUDE,
  resolveTeamRows,
  snapshotTeam,
  type TeamRowForSnap,
} from "@/lib/pvp/team";
import { primeChallengerTeamForBattle } from "@/lib/pvp/restore";

const RATE_LIMIT_WINDOW_MS = 60_000;
const PVP_LIMIT = 15;
const MATCH_POOL = 8;
/** Mínimo entre desafíos al mismo rival (evita farmear Elo). */
const PVP_CHALLENGE_COOLDOWN_MS = 10 * 60 * 1000;

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

async function pickLadderOpponent(userId: string, myRating: number) {
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: userId },
      OR: [
        { pokemon: { some: { pvpSlot: { not: null } } } },
        { pokemon: { some: { teamSlot: { not: null } } } },
      ],
    },
    select: { id: true, pvpRating: true, username: true, avatarId: true },
  });
  if (candidates.length === 0) return null;
  const pool = candidates
    .sort((a, b) => Math.abs(a.pvpRating - myRating) - Math.abs(b.pvpRating - myRating))
    .slice(0, MATCH_POOL);
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/**
 * Arranca un combate PvP RANKED interactivo contra un rival (ladder o desafío).
 * Crea PvpMatch ACTIVE + BattleSession y manda a /battle.
 */
export async function startPvpBattle(
  locale: string,
  opts?: { opponentUsername?: string; rematchUserId?: string },
) {
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

  let opponent: { id: string; username: string; pvpRating: number; avatarId: string | null } | null =
    null;

  if (opts?.opponentUsername) {
    const found = await prisma.user.findUnique({
      where: { username: opts.opponentUsername.trim() },
      select: { id: true, username: true, pvpRating: true, avatarId: true },
    });
    if (!found || found.id === userId) {
      backToPvp(locale, "no_opponents");
      return;
    }
    opponent = found;
  } else if (opts?.rematchUserId) {
    const found = await prisma.user.findUnique({
      where: { id: opts.rematchUserId },
      select: { id: true, username: true, pvpRating: true, avatarId: true },
    });
    if (!found || found.id === userId) {
      backToPvp(locale, "no_opponents");
      return;
    }
    opponent = found;
  } else {
    opponent = await pickLadderOpponent(userId, me.pvpRating);
  }

  if (!opponent) {
    backToPvp(locale, "no_opponents");
    return;
  }

  // Cooldown por par de jugadores (desafío / rematch / ladder al mismo).
  const recent = await prisma.pvpMatch.findFirst({
    where: {
      OR: [
        { challengerId: userId, opponentId: opponent.id },
        { challengerId: opponent.id, opponentId: userId },
      ],
      createdAt: { gte: new Date(Date.now() - PVP_CHALLENGE_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  if (recent && (opts?.opponentUsername || opts?.rematchUserId)) {
    backToPvp(locale, "cooldown");
    return;
  }

  const oppTeamRows = await loadTeamRows(opponent.id);
  if (oppTeamRows.length === 0) {
    backToPvp(locale, "no_opponents");
    return;
  }

  const challengerTeam = snapshotTeam(myTeamRows);
  const opponentTeam = snapshotTeam(oppTeamRows);
  const lead = challengerTeam[0];
  const firstOpp = opponentTeam[0];
  if (!lead || !firstOpp) {
    backToPvp(locale, "no_team");
    return;
  }

  let matchId: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId, opponent!.id);

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
      if (currentEnergy < PVP_ENERGY_COST) {
        throw new Error("no_energy");
      }

      const season = await ensureSeason(tx, userId);
      await ensureSeason(tx, opponent!.id);

      const oppFresh = await tx.user.findUniqueOrThrow({
        where: { id: opponent!.id },
        select: { pvpRating: true },
      });

      const match = await tx.pvpMatch.create({
        data: {
          challengerId: userId,
          opponentId: opponent!.id,
          mode: "RANKED",
          status: "ACTIVE",
          seasonKey: season.seasonKey,
          challengerRatingBefore: season.resetApplied ? season.rating : fresh.pvpRating,
          opponentRatingBefore: oppFresh.pvpRating,
          challengerTeam,
          opponentTeam,
        },
        select: { id: true },
      });
      matchId = match.id;

      await primeChallengerTeamForBattle(tx, challengerTeam);

      await tx.user.update({
        where: { id: userId },
        data: {
          energy: currentEnergy - PVP_ENERGY_COST,
          energyUpdatedAt: new Date(),
        },
      });

      await tx.battleSession.create({
        data: {
          userId,
          pokemonInstanceId: lead.instanceId,
          wildSpeciesId: firstOpp.speciesId,
          wildLevel: firstOpp.level,
          wildCurrentHp: firstOpp.maxHp,
          wildMaxHp: firstOpp.maxHp,
          wildMoveIds: firstOpp.moves.map((m) => m.id),
          wildMovePp: firstOpp.moves.map((m) => m.maxPp),
          wildHeldItemId: firstOpp.heldItemId,
          wildItemConsumed: false,
          pvpMatchId: match.id,
          opponentUserId: opponent!.id,
          opponentSlot: firstOpp.slot,
          log: [`challengePvp:${opponent!.username}`, `sendOut:${firstOpp.speciesName}`],
          participantIds: [lead.instanceId],
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "no_energy") {
      backToPvp(locale, "no_energy");
      return;
    }
    throw e;
  }

  if (!matchId) {
    backToPvp(locale, "no_opponents");
    return;
  }

  revalidateCombatUi(locale);
  revalidatePath(`/${locale}/pvp`);
  redirect({ href: "/battle", locale });
}

export async function startPvpChallenge(locale: string, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  await startPvpBattle(locale, { opponentUsername: username || undefined });
}

export async function startPvpRematch(locale: string, opponentId: string) {
  await startPvpBattle(locale, { rematchUserId: opponentId });
}

export async function startPvpRanked(locale: string) {
  await startPvpBattle(locale);
}
