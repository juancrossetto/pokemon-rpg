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

  const regionId = DEFAULT_GYM_REGION_ID;

  // Se pide todo de una y se parte acá: el Alto Mando no va en la grilla de
  // medallas, pero sí decide si aparece el banner de continuidad.
  const [allStatuses, user, badgeCountsByRegion] = await Promise.all([
    computeGymStatuses(session.user.id, true, regionId),
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

  const items = toGymMissionItems(allStatuses.filter((status) => !status.gym.isElite));
  const badgeCount = items.filter((s) => s.badgeEarned).length;

  /**
   * Con las N medallas el hub queda todo en verde y no dice que la aventura
   * sigue en el Alto Mando. Se ofrece el primer nodo élite sin sello; si ya
   * están todos, no hay banner y la pantalla efectivamente está terminada.
   */
  const allBadgesEarned = items.length > 0 && badgeCount === items.length;
  const nextElite = allBadgesEarned
    ? allStatuses.find((status) => status.gym.isElite && !status.badgeEarned)
    : undefined;

  const regions = listGymRegions().map((region) => ({
    id: region.id,
    available: region.available,
    badgeTarget: region.badgeTarget,
    badgeCount: countByRegion.get(region.id) ?? 0,
  }));

  return (
    <GymMissionControl
      items={items}
      badgeCount={badgeCount}
      gems={user.gems}
      eliteHref={nextElite ? `/gyms/${nextElite.gym.id}` : null}
      regions={regions}
      initialRegionId={regionId}
    />
  );
}
