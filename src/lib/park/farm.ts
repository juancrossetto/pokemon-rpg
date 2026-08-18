export const FARM_PLOT_COUNT = 4;
/** 2 h por parcela. */
export const FARM_GROW_MS = 2 * 60 * 60 * 1000;
export const FARM_YIELD_MIN = 2;
export const FARM_YIELD_MAX = 3;

export const FARM_BERRY_NAMES = ["Oran Berry", "Sitrus Berry", "Leppa Berry"] as const;

export function farmReady(plantedAt: Date | null, now: Date = new Date()): boolean {
  if (!plantedAt) return false;
  return now.getTime() - plantedAt.getTime() >= FARM_GROW_MS;
}

export function farmMsLeft(plantedAt: Date, now: Date = new Date()): number {
  return Math.max(0, plantedAt.getTime() + FARM_GROW_MS - now.getTime());
}

export function farmYield(roll: number): number {
  if (roll < 0.55) return FARM_YIELD_MIN;
  return FARM_YIELD_MAX;
}
