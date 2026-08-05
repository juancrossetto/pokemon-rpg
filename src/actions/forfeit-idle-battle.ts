"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTurnExpired } from "@/lib/battle-turn-timer";
import {
  revalidateAfterIdleLoss,
  settleIdleBattleLoss,
} from "@/lib/settle-idle-battle";

export type ForfeitIdleBattleResult =
  | { ok: true; outcome: "lost" }
  | { ok: false; error: "unauthorized" | "not_found" | "not_expired" | "already_closed" };

/**
 * Cierra la batalla si el reloj de decisión ya venció.
 * El cliente lo llama al llegar a 0; el servidor también lo chequea en cada acción.
 */
export async function forfeitIdleBattle(
  sessionId: string,
  locale: string,
): Promise<ForfeitIdleBattleResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const battle = await prisma.battleSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      userId: true,
      pokemonInstanceId: true,
      status: true,
      gymId: true,
      gymRunId: true,
      towerRunId: true,
      pvpMatchId: true,
      clanWarBattleId: true,
      opponentUserId: true,
      log: true,
      turnDeadlineAt: true,
    },
  });
  if (!battle) return { ok: false, error: "not_found" };
  if (battle.status !== "ACTIVE") return { ok: false, error: "already_closed" };
  if (!isTurnExpired(battle.turnDeadlineAt)) {
    return { ok: false, error: "not_expired" };
  }

  const settled = await prisma.$transaction(
    async (tx) => settleIdleBattleLoss(tx, battle),
    { timeout: 20_000 },
  );

  if (!settled) return { ok: false, error: "already_closed" };

  if (battle.gymId) {
    const { notifyGymResult } = await import("@/lib/notifications");
    await notifyGymResult(userId, battle.gymId, false);
  }
  if (battle.pvpMatchId) {
    const match = await prisma.pvpMatch.findFirst({
      where: { id: battle.pvpMatchId },
      select: {
        id: true,
        challengerId: true,
        opponentId: true,
      },
    });
    if (match) {
      const { notifySettledPvp } = await import("@/lib/pvp/settle");
      const [me, opp] = await Promise.all([
        prisma.user.findUnique({
          where: { id: match.challengerId },
          select: { username: true },
        }),
        prisma.user.findUnique({
          where: { id: match.opponentId },
          select: { username: true },
        }),
      ]);
      await notifySettledPvp({
        matchId: match.id,
        challengerId: match.challengerId,
        opponentId: match.opponentId,
        challengerName: me?.username ?? "Trainer",
        opponentName: opp?.username ?? "Rival",
        challengerWon: false,
      });
    }
  }

  await revalidateAfterIdleLoss(locale, battle);
  return { ok: true, outcome: "lost" };
}
