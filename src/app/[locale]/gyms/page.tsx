import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeGymStatuses } from "@/lib/gym-status";
import { toGymMissionItems } from "@/lib/gym-mission";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { GymMissionControl } from "@/components/gym-mission-control";
import {
  DEFAULT_GYM_REGION_ID,
  listGymRegions,
  type GymRegionId,
} from "@/lib/gym-regions";

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

  const regionTabs = listGymRegions();
  const catalogRegions = regionTabs.filter((region) => region.available);

  const [user, badgeCountsByRegion, ...regionStatuses] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { gems: true },
    }),
    prisma.badge.groupBy({
      by: ["gymId"],
      where: {
        userId: session.user.id,
        gym: { isElite: false },
      },
      _count: true,
    }),
    ...catalogRegions.map((region) =>
      computeGymStatuses(session.user.id, true, region.id),
    ),
  ]);

  const badgedGymIds = new Set(badgeCountsByRegion.map((b) => b.gymId));
  const gymsMeta = await prisma.gym.findMany({
    where: { isElite: false },
    select: { id: true, regionId: true },
  });
  const countByRegion = new Map<string, number>();
  for (const gym of gymsMeta) {
    if (!badgedGymIds.has(gym.id)) continue;
    countByRegion.set(gym.regionId, (countByRegion.get(gym.regionId) ?? 0) + 1);
  }

  const itemsByRegion: Partial<Record<GymRegionId, ReturnType<typeof toGymMissionItems>>> =
    {};
  const eliteHrefByRegion: Partial<Record<GymRegionId, string | null>> = {};

  catalogRegions.forEach((region, index) => {
    const allStatuses = regionStatuses[index] ?? [];
    const items = toGymMissionItems(allStatuses.filter((status) => !status.gym.isElite));
    itemsByRegion[region.id] = items;

    const badgeCount = items.filter((s) => s.badgeEarned).length;
    const allBadgesEarned = items.length > 0 && badgeCount === items.length;
    const nextElite = allBadgesEarned
      ? allStatuses.find((status) => status.gym.isElite && !status.badgeEarned)
      : undefined;
    eliteHrefByRegion[region.id] = nextElite ? `/gyms/${nextElite.gym.id}` : null;
  });

  const regions = regionTabs.map((region) => ({
    id: region.id,
    available: region.available,
    playable: region.playable,
    badgeTarget: region.badgeTarget,
    badgeCount: countByRegion.get(region.id) ?? 0,
  }));

  return (
    <GymMissionControl
      itemsByRegion={itemsByRegion}
      gems={user.gems}
      eliteHrefByRegion={eliteHrefByRegion}
      regions={regions}
      initialRegionId={DEFAULT_GYM_REGION_ID}
    />
  );
}
