import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { avatarById } from "@/lib/avatars";
import { dayKey, nextDailyReset } from "@/lib/events/time";
import { toFactoryRunView } from "@/lib/factory-data";
import type { FactoryRankingEntry } from "@/lib/factory";
import { BattleFactory } from "@/components/factory/battle-factory";

export default async function FactoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;
  const key = dayKey();

  const [run, user, leaders] = await Promise.all([
    prisma.factoryRun.findUnique({ where: { userId_dayKey: { userId, dayKey: key } } }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { factoryPoints: true },
    }),
    prisma.factoryRun.findMany({
      where: { dayKey: key, status: { in: ["WON", "LOST"] } },
      orderBy: [{ round: "desc" }, { totalTurns: "asc" }, { endedAt: "asc" }],
      take: 10,
      include: { user: { select: { id: true, username: true, avatarId: true } } },
    }),
  ]);

  const ranking: FactoryRankingEntry[] = leaders.map((entry, index) => ({
    position: index + 1,
    username: entry.user.username,
    avatarId: avatarById(entry.user.avatarId)?.id ?? entry.user.avatarId,
    wins: entry.round,
    turns: entry.totalTurns,
    completed: entry.status === "WON",
    isCurrentUser: entry.user.id === userId,
  }));

  return (
    <BattleFactory
      locale={locale}
      run={run ? toFactoryRunView(run) : null}
      factoryPoints={user.factoryPoints}
      ranking={ranking}
      resetsAt={nextDailyReset().toISOString()}
    />
  );
}
