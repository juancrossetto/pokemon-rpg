import type { Prisma } from "@/generated/prisma/client";
import { grantRewards, writeLedger } from "@/lib/events/grant";
import { PVP_STARTING_RATING } from "@/lib/pvp-rating";
import { seasonEndRewards } from "@/lib/pvp/rewards";
import { tierForRating } from "@/lib/pvp/tiers";

/** Temporada mensual UTC: `2026-07`. */
export function currentSeasonKey(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function previousSeasonKey(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return currentSeasonKey(d);
}

/** Inicio del mes UTC siguiente (próximo reset de temporada). */
export function nextSeasonReset(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * Soft reset: mezcla el rating actual con el de partida (70% actual + 30% start).
 * Evita castigar hard resets a jugadores altos y da un empujón a los bajos.
 */
export function softResetRating(current: number): number {
  return Math.round(current * 0.7 + PVP_STARTING_RATING * 0.3);
}

/**
 * Si el jugador aún no tiene stats de la temporada actual, archiva la anterior
 * (si había rating) y aplica soft reset. Idempotente.
 */
export async function ensureSeason(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<{ seasonKey: string; rating: number; resetApplied: boolean }> {
  const seasonKey = currentSeasonKey();
  const existing = await tx.pvpSeasonStats.findUnique({
    where: { userId_seasonKey: { userId, seasonKey } },
  });
  if (existing) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { pvpRating: true },
    });
    return { seasonKey, rating: user.pvpRating, resetApplied: false };
  }

  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { pvpRating: true, pvpWins: true, pvpLosses: true },
  });

  const prevKey = previousSeasonKey();
  const prevStats = await tx.pvpSeasonStats.findUnique({
    where: { userId_seasonKey: { userId, seasonKey: prevKey } },
  });
  // Archiva la temporada anterior solo si no estaba archivada y el jugador
  // ya peleo alguna vez (rating distinto o W/L > 0).
  const shouldArchive =
    !prevStats &&
    (user.pvpWins > 0 || user.pvpLosses > 0 || user.pvpRating !== PVP_STARTING_RATING);
  if (shouldArchive) {
    const prevTier = tierForRating(user.pvpRating);
    await tx.pvpSeasonStats.create({
      data: {
        userId,
        seasonKey: prevKey,
        rating: user.pvpRating,
        wins: user.pvpWins,
        losses: user.pvpLosses,
        tier: prevTier,
      },
    });
    const seasonBundle = seasonEndRewards(prevTier);
    const seasonGrant = await grantRewards(tx, userId, seasonBundle);
    await writeLedger(tx, {
      userId,
      source: "pvp",
      sourceRef: `season:${prevKey}`,
      result: seasonGrant,
    });
  }

  const nextRating = softResetRating(user.pvpRating);
  await tx.user.update({
    where: { id: userId },
    data: { pvpRating: nextRating, pvpWins: 0, pvpLosses: 0 },
  });
  await tx.pvpSeasonStats.create({
    data: {
      userId,
      seasonKey,
      rating: nextRating,
      wins: 0,
      losses: 0,
      tier: tierForRating(nextRating),
    },
  });

  return { seasonKey, rating: nextRating, resetApplied: true };
}

/** Actualiza el snapshot de la temporada actual tras un partido. */
export async function bumpSeasonStats(
  tx: Prisma.TransactionClient,
  userId: string,
  seasonKey: string,
  rating: number,
  won: boolean,
) {
  await tx.pvpSeasonStats.upsert({
    where: { userId_seasonKey: { userId, seasonKey } },
    create: {
      userId,
      seasonKey,
      rating,
      wins: won ? 1 : 0,
      losses: won ? 0 : 1,
      tier: tierForRating(rating),
    },
    update: {
      rating,
      tier: tierForRating(rating),
      ...(won ? { wins: { increment: 1 } } : { losses: { increment: 1 } }),
    },
  });
}
