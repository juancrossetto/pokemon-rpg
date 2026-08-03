"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { revalidateCombatUi } from "@/lib/battle-lock";
import { settleClanWarSlot } from "@/lib/clan-war/settle-slot";

/** Rendirse en una pelea de guerra de clan → derrota del slot + restore. */
export async function forfeitClanWarBattle(locale: string) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  const battle = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE", clanWarBattleId: { not: null } },
    include: {
      clanWarBattle: { include: { war: true } },
    },
  });
  if (!battle?.clanWarBattle?.war) {
    redirect({ href: "/clans", locale });
    return;
  }

  const slot = battle.clanWarBattle;
  const war = slot.war;
  const membership = await prisma.clanMember.findUnique({ where: { userId } });
  const myClanId = membership?.clanId;
  const foeClanId =
    myClanId === war.clanAId ? war.clanBId : myClanId === war.clanBId ? war.clanAId : null;
  const foeUserId =
    slot.fighterAId === userId ? slot.fighterBId : slot.fighterBId === userId ? slot.fighterAId : null;

  if (!foeClanId || !foeUserId) {
    redirect({ href: "/clans", locale });
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      await lockUsers(tx, userId, foeUserId);
      await tx.battleSession.update({
        where: { id: battle.id },
        data: { status: "LOST" },
      });
      await settleClanWarSlot(tx, {
        battleId: slot.id,
        winnerClanId: foeClanId,
        winnerUserId: foeUserId,
        restoreChallengerTeam: slot.challengerTeam,
        status: "FORFEIT",
      });
    },
    { timeout: 20_000 },
  );

  revalidateCombatUi(locale);
  revalidatePath(`/${locale}/clans/${myClanId}`, "page");
  redirect({ href: `/clans/${myClanId}?tab=war`, locale });
}
