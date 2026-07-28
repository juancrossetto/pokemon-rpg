import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeGymStatuses } from "@/lib/gym-status";
import { toGymMissionItems } from "@/lib/gym-mission";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { GymMissionControl } from "@/components/gym-mission-control";

export default async function GymsPage({
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

  await redirectIfInBattle(session.user.id, locale);

  const [statuses, user] = await Promise.all([
    computeGymStatuses(session.user.id),
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { gems: true },
    }),
  ]);
  const items = toGymMissionItems(statuses);
  const badgeCount = items.filter((s) => s.badgeEarned).length;

  return <GymMissionControl items={items} badgeCount={badgeCount} gems={user.gems} />;
}
