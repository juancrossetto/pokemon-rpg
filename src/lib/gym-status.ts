import { prisma } from "@/lib/prisma";
import { nowMs } from "@/lib/time";

export interface GymStatus {
  gym: Awaited<ReturnType<typeof fetchGyms>>[number];
  badgeEarned: boolean;
  locked: boolean;
  onCooldown: boolean;
  hoursLeft: number;
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

function fetchGyms() {
  return prisma.gym.findMany({
    orderBy: { order: "asc" },
    include: { team: { orderBy: { slot: "asc" }, include: { species: true } }, trainers: true },
  });
}

// Estado de cada gimnasio para un usuario: medalla obtenida, bloqueado
// (falta la medalla anterior), o en cooldown tras haber perdido. Compartido
// entre la lista (/gyms) y el mapa (/gyms/map) para no duplicar la lógica.
export async function computeGymStatuses(userId: string): Promise<GymStatus[]> {
  const [gyms, badges, attempts] = await Promise.all([
    fetchGyms(),
    prisma.badge.findMany({ where: { userId } }),
    prisma.gymAttempt.findMany({ where: { userId }, orderBy: { attemptedAt: "desc" } }),
  ]);

  const badgedGymIds = new Set(badges.map((b) => b.gymId));
  const gymByOrder = new Map(gyms.map((g) => [g.order, g]));

  const lastAttemptByGym = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    if (!lastAttemptByGym.has(attempt.gymId)) lastAttemptByGym.set(attempt.gymId, attempt);
  }

  const now = nowMs();

  return gyms.map((gym) => {
    const badgeEarned = badgedGymIds.has(gym.id);
    const previousGym = gym.order > 1 ? gymByOrder.get(gym.order - 1) : undefined;
    const locked = previousGym ? !badgedGymIds.has(previousGym.id) : false;
    const lastAttempt = lastAttemptByGym.get(gym.id);
    const cooldownMs = gym.cooldownHours * 60 * 60 * 1000;
    const elapsedMs = lastAttempt ? now - lastAttempt.attemptedAt.getTime() : Infinity;
    const onCooldown = !badgeEarned && !!lastAttempt && !lastAttempt.won && elapsedMs < cooldownMs;
    const hoursLeft = onCooldown ? Math.ceil((cooldownMs - elapsedMs) / (60 * 60 * 1000)) : 0;
    const closed =
      !badgeEarned && !isGymOpenAt(gym.opensHour, gym.closesHour, new Date(now).getHours());

    return {
      gym,
      badgeEarned,
      locked,
      onCooldown,
      hoursLeft,
      closed,
      opensHour: gym.opensHour,
      closesHour: gym.closesHour,
    };
  });
}
