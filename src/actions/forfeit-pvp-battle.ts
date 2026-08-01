"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { revalidateCombatUi } from "@/lib/battle-lock";
import { notifySettledPvp, settlePvpMatch } from "@/lib/pvp/settle";

/** Rendirse en un combate PvP ranked → derrota + restore del equipo. */
export async function forfeitPvpBattle(locale: string) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  const battle = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE", pvpMatchId: { not: null } },
    include: { pvpMatch: true },
  });
  if (!battle?.pvpMatch) {
    redirect({ href: "/pvp", locale });
    return;
  }
  const match = battle.pvpMatch;

  await prisma.$transaction(
    async (tx) => {
      await lockUsers(tx, userId, match.opponentId);
      await tx.battleSession.update({
        where: { id: battle.id },
        data: { status: "LOST" },
      });
      await tx.battleLog.create({
        data: {
          kind: "PVP",
          userId,
          opponentId: match.opponentId,
          userWon: false,
        },
      });
      await settlePvpMatch(tx, {
        matchId: match.id,
        challengerId: match.challengerId,
        opponentId: match.opponentId,
        challengerWon: false,
        mode: match.mode,
        seasonKey: match.seasonKey ?? "unknown",
        challengerRatingBefore: match.challengerRatingBefore,
        opponentRatingBefore: match.opponentRatingBefore,
        challengerTeam: match.challengerTeam,
        status: "FORFEIT",
        restoreTeam: true,
      });
    },
    { timeout: 20_000 },
  );

  const [me, opp] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { username: true } }),
    prisma.user.findUnique({ where: { id: match.opponentId }, select: { username: true } }),
  ]);
  await notifySettledPvp({
    matchId: match.id,
    challengerId: match.challengerId,
    opponentId: match.opponentId,
    challengerName: me?.username ?? "Trainer",
    opponentName: opp?.username ?? "Rival",
    challengerWon: false,
  });

  revalidateCombatUi(locale);
  revalidatePath(`/${locale}/pvp`);
  revalidatePath(`/${locale}/ranking`);
  redirect({ href: `/pvp/${match.id}`, locale });
}
