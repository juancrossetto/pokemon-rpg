import { prisma } from "@/lib/prisma";
import { COMBAT_TOWER_CONFIG } from "@/lib/tower/config";
import { currentTowerPeriodStart, towerPeriodKey } from "@/lib/tower/week";

/**
 * Resumen mínimo de la Torre para el carrusel del home.
 *
 * Deliberadamente chico, igual que `loadSafariHomeCard`: el home es la ruta más
 * caliente del juego y no necesita el estado completo de la torre —bendiciones,
 * botín pendiente, equipo— para pintar una card con piso alcanzado e intentos.
 */
export async function loadTowerHomeCard(userId: string) {
  const periodStart = currentTowerPeriodStart();
  const attemptsMax = COMBAT_TOWER_CONFIG.rules.dailyAttempts;

  const [progress, periodRuns, activeRun] = await Promise.all([
    prisma.towerProgress.findFirst({
      where: { userId },
      orderBy: { highestFloorAllTime: "desc" },
      select: { highestFloorAllTime: true, highestFloorSeason: true },
    }),
    prisma.towerRun.count({
      where: { userId, startedAt: { gte: periodStart }, attemptsConsumed: { gt: 0 } },
    }),
    prisma.towerRun.findFirst({
      where: { userId, status: { in: ["ACTIVE", "AWAITING_BLESSING", "RESTING"] } },
      orderBy: { startedAt: "desc" },
      select: { currentFloor: true },
    }),
  ]);

  const totalFloors = COMBAT_TOWER_CONFIG.totalFloors;
  const bestFloor = progress?.highestFloorAllTime ?? 0;
  const currentFloor = activeRun?.currentFloor ?? 0;

  return {
    periodKey: towerPeriodKey(),
    attemptsLeft: Math.max(0, attemptsMax - periodRuns),
    attemptsTotal: attemptsMax,
    active: activeRun !== null,
    currentFloor,
    bestFloor,
    totalFloors,
    /** Progreso de la barra: el ascenso en curso si lo hay, si no el récord. */
    percent: Math.min(
      100,
      Math.round(((activeRun ? currentFloor : bestFloor) / Math.max(1, totalFloors)) * 100),
    ),
  };
}
