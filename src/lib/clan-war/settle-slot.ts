import type { Prisma } from "@/generated/prisma/client";
import { settleClanWarRatings } from "@/lib/clan-war/settle";
import { warIsComplete, warScoreAfterBattle } from "@/lib/clan-war/rules";
import { restoreChallengerTeam } from "@/lib/pvp/restore";

/**
 * Cierra un slot de guerra (victoria/derrota del startedBy o sim).
 * Actualiza score y, si terminaron todos los slots, Elo del clan.
 */
export async function settleClanWarSlot(
  tx: Prisma.TransactionClient,
  input: {
    battleId: string;
    /** true si ganó el clan del startedBy / challenger humano; en sim, el lado A del sim. */
    winnerClanId: string;
    winnerUserId: string;
    koLog?: unknown;
    /** Snapshot del challenger a restaurar (pelea interactiva). */
    restoreChallengerTeam?: unknown;
    status?: "COMPLETED" | "FORFEIT";
  },
): Promise<{ warCompleted: boolean }> {
  const battle = await tx.clanWarBattle.findUnique({
    where: { id: input.battleId },
    include: { war: true },
  });
  if (!battle || battle.status === "COMPLETED" || battle.status === "FORFEIT") {
    return { warCompleted: false };
  }

  const war = battle.war;
  const winnerSide: "A" | "B" =
    input.winnerClanId === war.clanAId ? "A" : "B";
  const nextScore = warScoreAfterBattle(war.scoreA, war.scoreB, winnerSide);

  await tx.clanWarBattle.update({
    where: { id: battle.id },
    data: {
      status: input.status ?? "COMPLETED",
      winnerClanId: input.winnerClanId,
      winnerUserId: input.winnerUserId,
      koLog: (input.koLog as Prisma.InputJsonValue) ?? (battle.koLog as Prisma.InputJsonValue),
      completedAt: new Date(),
    },
  });

  if (input.restoreChallengerTeam) {
    await restoreChallengerTeam(tx, input.restoreChallengerTeam);
  }

  const completedCount = await tx.clanWarBattle.count({
    where: {
      warId: war.id,
      status: { in: ["COMPLETED", "FORFEIT"] },
    },
  });

  if (warIsComplete(completedCount)) {
    const settled = settleClanWarRatings({
      ratingA: war.ratingABefore,
      ratingB: war.ratingBBefore,
      scoreA: nextScore.scoreA,
      scoreB: nextScore.scoreB,
    });
    await tx.clanWar.update({
      where: { id: war.id },
      data: {
        scoreA: nextScore.scoreA,
        scoreB: nextScore.scoreB,
        status: "COMPLETED",
        completedAt: new Date(),
        ratingAAfter: settled.ratingAAfter,
        ratingBAfter: settled.ratingBAfter,
      },
    });
    await tx.clanWarRegistration.updateMany({
      where: { seasonId: war.seasonId, clanId: war.clanAId },
      data: { rating: settled.ratingAAfter },
    });
    await tx.clanWarRegistration.updateMany({
      where: { seasonId: war.seasonId, clanId: war.clanBId },
      data: { rating: settled.ratingBAfter },
    });
    return { warCompleted: true };
  }

  await tx.clanWar.update({
    where: { id: war.id },
    data: { scoreA: nextScore.scoreA, scoreB: nextScore.scoreB },
  });
  return { warCompleted: false };
}
