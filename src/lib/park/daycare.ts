import { MAX_POKEMON_LEVEL, xpForLevel } from "@/lib/stats";

/** Slots de la pensión. Dos es el máximo de la guardería clásica. */
export const DAYCARE_SLOTS = 2;
export const DAYCARE_DEPOSIT_COST = 200;
/** 2 h reales por nivel ganado. Lazy, como la energía: no hay cron. */
export const DAYCARE_MS_PER_LEVEL = 2 * 60 * 60 * 1000;
/** Tope por estadía para que no dejen un Magikarp un mes. */
export const DAYCARE_MAX_LEVELS_PER_STAY = 8;
export const DAYCARE_FEE_PER_LEVEL = 40;

export function pendingDaycareLevels(
  currentLevel: number,
  lastCollectedAt: Date,
  now: Date = new Date(),
): number {
  const room = Math.max(0, MAX_POKEMON_LEVEL - currentLevel);
  if (room === 0) return 0;
  const elapsed = Math.max(0, now.getTime() - lastCollectedAt.getTime());
  const earned = Math.floor(elapsed / DAYCARE_MS_PER_LEVEL);
  return Math.min(DAYCARE_MAX_LEVELS_PER_STAY, room, earned);
}

/** XP acumulada necesaria para llegar a `currentLevel + levels`. */
export function xpForDaycareLevels(currentXp: number, currentLevel: number, levels: number): number {
  const safe = Math.max(0, Math.floor(levels));
  if (safe === 0) return 0;
  const targetLevel = Math.min(MAX_POKEMON_LEVEL, currentLevel + safe);
  return Math.max(0, xpForLevel(targetLevel) - currentXp);
}

export function daycareCollectFee(levels: number): number {
  return Math.max(0, Math.floor(levels)) * DAYCARE_FEE_PER_LEVEL;
}
