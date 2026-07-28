import type { Prisma } from "@/generated/prisma/client";
import { grantRewards, writeLedger } from "@/lib/events/grant";
import { notifyPvpResult } from "@/lib/notifications";
import { ratingDeltas } from "@/lib/pvp-rating";
import { pvpMatchRewards } from "@/lib/pvp/rewards";
import { bumpSeasonStats } from "@/lib/pvp/seasons";
import { restoreChallengerTeam } from "@/lib/pvp/restore";

/**
 * Cierra un PvpMatch ACTIVE/FORFEIT: Elo, monedas, season stats, restore HP.
 * Asume que el caller ya tomó lockUsers de ambos.
 */
export async function settlePvpMatch(
  tx: Prisma.TransactionClient,
  input: {
    matchId: string;
    challengerId: string;
    opponentId: string;
    challengerWon: boolean;
    mode: "RANKED" | "QUICK";
    seasonKey: string;
    challengerRatingBefore: number;
    opponentRatingBefore: number;
    challengerTeam?: unknown;
    koLog?: string[];
    turnLog?: string[];
    turns?: number;
    status?: "COMPLETED" | "FORFEIT";
    /** Si true, restaura HP/PP del challenger desde el snapshot. */
    restoreTeam?: boolean;
  },
): Promise<{
  challengerAfter: number;
  opponentAfter: number;
  coinsAwarded: number;
}> {
  const { challengerAfter, opponentAfter } = ratingDeltas(
    input.challengerRatingBefore,
    input.opponentRatingBefore,
    input.challengerWon,
  );

  const winnerId = input.challengerWon ? input.challengerId : input.opponentId;
  const loserId = input.challengerWon ? input.opponentId : input.challengerId;
  const winnerRating = input.challengerWon ? challengerAfter : opponentAfter;

  const winBundle = pvpMatchRewards({
    won: true,
    rating: winnerRating,
    mode: input.mode,
  });
  const lossBundle = pvpMatchRewards({
    won: false,
    rating: input.challengerWon ? opponentAfter : challengerAfter,
    mode: input.mode,
  });

  const winGrant = await grantRewards(tx, winnerId, winBundle);
  const lossGrant = await grantRewards(tx, loserId, lossBundle);
  await writeLedger(tx, {
    userId: winnerId,
    source: "pvp",
    sourceRef: `${input.matchId}:win`,
    result: winGrant,
  });
  await writeLedger(tx, {
    userId: loserId,
    source: "pvp",
    sourceRef: `${input.matchId}:loss`,
    result: lossGrant,
  });

  await tx.user.update({
    where: { id: input.challengerId },
    data: {
      pvpRating: challengerAfter,
      ...(input.challengerWon
        ? { pvpWins: { increment: 1 } }
        : { pvpLosses: { increment: 1 } }),
    },
  });
  await tx.user.update({
    where: { id: input.opponentId },
    data: {
      pvpRating: opponentAfter,
      ...(input.challengerWon
        ? { pvpLosses: { increment: 1 } }
        : { pvpWins: { increment: 1 } }),
    },
  });

  await bumpSeasonStats(
    tx,
    input.challengerId,
    input.seasonKey,
    challengerAfter,
    input.challengerWon,
  );
  await bumpSeasonStats(
    tx,
    input.opponentId,
    input.seasonKey,
    opponentAfter,
    !input.challengerWon,
  );

  if (input.restoreTeam && input.challengerTeam != null) {
    await restoreChallengerTeam(tx, input.challengerTeam);
  }

  await tx.pvpMatch.update({
    where: { id: input.matchId },
    data: {
      status: input.status ?? "COMPLETED",
      winnerId,
      challengerRatingAfter: challengerAfter,
      opponentRatingAfter: opponentAfter,
      koLog: input.koLog ?? [],
      turnLog: input.turnLog ?? [],
      turns: input.turns ?? 0,
      coinsAwarded: winGrant.coinsDelta,
      completedAt: new Date(),
    },
  });

  return {
    challengerAfter,
    opponentAfter,
    coinsAwarded: winGrant.coinsDelta,
  };
}

/** Notifica fuera de la transacción (best-effort). */
export async function notifySettledPvp(input: {
  matchId: string;
  challengerId: string;
  opponentId: string;
  challengerName: string;
  opponentName: string;
  challengerWon: boolean;
}) {
  await notifyPvpResult({
    winnerId: input.challengerWon ? input.challengerId : input.opponentId,
    loserId: input.challengerWon ? input.opponentId : input.challengerId,
    winnerName: input.challengerWon ? input.challengerName : input.opponentName,
    loserName: input.challengerWon ? input.opponentName : input.challengerName,
    matchId: input.matchId,
  });
}
