import { prisma } from "@/lib/prisma";
import { nowMs } from "@/lib/time";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { areChapterStagesCompleteForGym } from "@/lib/campaign";
import { DEFAULT_REGION_ID } from "@/lib/regions";

export interface GymStatus {
  gym: Awaited<ReturnType<typeof fetchGyms>>[number];
  badgeEarned: boolean;
  locked: boolean;
  /** Faltan stages del capítulo de campaña: no se puede desafiar (sí revancha). */
  stagesIncomplete: boolean;
  onCooldown: boolean;
  hoursLeft: number;
  /** Ms restantes de cooldown (0 si no aplica). */
  remainingMs: number;
  /** Fuera del horario de atención del gimnasio (dossier: "gimnasios con horarios"). */
  closed: boolean;
  opensHour: number;
  closesHour: number;
}

/**
 * ¿El gimnasio está abierto a esta hora? `opens === closes` (o 0/24) = 24hs.
 * Si `closes <= opens` el horario cruza la medianoche (ej. 20 a 4).
 */
export function isGymOpenAt(opensHour: number, closesHour: number, hour: number): boolean {
  if (opensHour === closesHour) return true;
  if (closesHour === 24 && opensHour === 0) return true;
  if (opensHour < closesHour) return hour >= opensHour && hour < closesHour;
  return hour >= opensHour || hour < closesHour;
}

function fetchGyms(regionId: string) {
  return prisma.gym.findMany({
    where: { regionId },
    orderBy: { order: "asc" },
    include: { team: { orderBy: { slot: "asc" }, include: { species: true } }, trainers: true },
  });
}

/**
 * Estado de los gimnasios de una liga. Por defecto solo los de medalla: el
 * Alto Mando se pide aparte (`includeElite`) porque no da medalla y solo se
 * abre con las N de esa región.
 */
export async function computeGymStatuses(
  userId: string,
  includeElite = false,
  regionId: string = DEFAULT_REGION_ID,
): Promise<GymStatus[]> {
  const [gyms, badges, attempts, progress] = await Promise.all([
    fetchGyms(regionId),
    prisma.badge.findMany({
      where: { userId, gym: { regionId } },
      select: { gymId: true },
    }),
    prisma.gymAttempt.findMany({
      where: { userId, gym: { regionId } },
      orderBy: { attemptedAt: "desc" },
    }),
    ensureCampaignProgress(userId),
  ]);

  const badgedGymIds = new Set(badges.map((b) => b.gymId));
  const gymByOrder = new Map(gyms.map((g) => [g.order, g]));

  const lastAttemptByGym = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    if (!lastAttemptByGym.has(attempt.gymId)) lastAttemptByGym.set(attempt.gymId, attempt);
  }

  const now = nowMs();

  return gyms
    .filter((gym) => includeElite || !gym.isElite)
    .map((gym) => {
      const badgeEarned = badgedGymIds.has(gym.id);
      const previousGym = gym.order > 1 ? gymByOrder.get(gym.order - 1) : undefined;
      const locked = previousGym ? !badgedGymIds.has(previousGym.id) : false;
      const stagesIncomplete =
        !badgeEarned &&
        !areChapterStagesCompleteForGym(
          gym.order,
          progress.completedStageIds,
          gym.regionId,
        );
      const lastAttempt = lastAttemptByGym.get(gym.id);
      const cooldownMs = gym.cooldownHours * 60 * 60 * 1000;
      const elapsedMs = lastAttempt ? now - lastAttempt.attemptedAt.getTime() : Infinity;
      const onCooldown =
        !badgeEarned && !!lastAttempt && !lastAttempt.won && elapsedMs < cooldownMs;
      const remainingMs = onCooldown ? Math.max(0, cooldownMs - elapsedMs) : 0;
      const hoursLeft = onCooldown ? Math.ceil(remainingMs / (60 * 60 * 1000)) : 0;
      const closed =
        !badgeEarned && !isGymOpenAt(gym.opensHour, gym.closesHour, new Date(now).getHours());

      return {
        gym,
        badgeEarned,
        locked,
        stagesIncomplete,
        onCooldown,
        hoursLeft,
        remainingMs,
        closed,
        opensHour: gym.opensHour,
        closesHour: gym.closesHour,
      };
    });
}
