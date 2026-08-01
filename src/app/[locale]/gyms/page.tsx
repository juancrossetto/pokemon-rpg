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

  // Se pide todo de una y se parte acá: el Alto Mando no va en la grilla de
  // medallas, pero sí decide si aparece el banner de continuidad.
  const [allStatuses, user] = await Promise.all([
    computeGymStatuses(session.user.id, true),
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { gems: true },
    }),
  ]);
  // Hoy todos los gyms sembrados son Kanto. Cuando entren otras ligas,
  // filtrar acá por región (campo en Gym o por rango de `order`).
  const items = toGymMissionItems(allStatuses.filter((status) => !status.gym.isElite));
  const badgeCount = items.filter((s) => s.badgeEarned).length;

  /**
   * Con las 8 medallas el hub queda todo en verde y no dice que la aventura
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
    badgeCount: region.id === DEFAULT_GYM_REGION_ID ? badgeCount : 0,
  }));

  return (
    <GymMissionControl
      items={items}
      badgeCount={badgeCount}
      gems={user.gems}
      eliteHref={nextElite ? `/gyms/${nextElite.gym.id}` : null}
      regions={regions}
      initialRegionId={DEFAULT_GYM_REGION_ID}
    />
  );
}
