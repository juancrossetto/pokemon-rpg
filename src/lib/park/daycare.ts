import { MAX_POKEMON_LEVEL, xpForLevel } from "@/lib/stats";

/** Slots de la pensión. Dos es el máximo de la guardería clásica. */
export const DAYCARE_SLOTS = 2;
export const DAYCARE_DEPOSIT_COST = 300;
/** 4 h reales por nivel ganado. Complemento lento, no reemplazo de Aventura. */
export const DAYCARE_MS_PER_LEVEL = 4 * 60 * 60 * 1000;
/** Tope por estadía: hay que cobrar y volver a dejar para seguir. */
export const DAYCARE_MAX_LEVELS_PER_STAY = 3;
export const DAYCARE_FEE_PER_LEVEL = 60;

/** Tope de nivel según medallas: sin historia no se farmea de más acá. */
export function daycareLevelCeiling(badgeCount: number): number {
  return Math.min(MAX_POKEMON_LEVEL, 15 + Math.max(0, badgeCount) * 4);
}

/** Más alto = más lento. Desincentiva mandar el equipo principal viejo. */
export function daycareMsPerLevel(currentLevel: number): number {
  if (currentLevel >= 45) return DAYCARE_MS_PER_LEVEL * 2;
  if (currentLevel >= 30) return Math.floor(DAYCARE_MS_PER_LEVEL * 1.5);
  return DAYCARE_MS_PER_LEVEL;
}

export function pendingDaycareLevels(
  currentLevel: number,
  lastCollectedAt: Date,
  badgeCount: number,
  now: Date = new Date(),
): number {
  const ceiling = daycareLevelCeiling(badgeCount);
  const room = Math.max(0, Math.min(MAX_POKEMON_LEVEL - currentLevel, ceiling - currentLevel));
  if (room === 0) return 0;
  const elapsed = Math.max(0, now.getTime() - lastCollectedAt.getTime());
  const msPer = daycareMsPerLevel(currentLevel);
  const earned = Math.floor(elapsed / msPer);
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

/** Ms hasta el próximo nivel, o 0 si ya no puede ganar más en esta estadía. */
export function daycareMsUntilNext(
  currentLevel: number,
  lastCollectedAt: Date,
  badgeCount: number,
  now: Date = new Date(),
): number {
  const pending = pendingDaycareLevels(currentLevel, lastCollectedAt, badgeCount, now);
  if (pending >= DAYCARE_MAX_LEVELS_PER_STAY) return 0;
  const ceiling = daycareLevelCeiling(badgeCount);
  if (currentLevel + pending >= ceiling || currentLevel + pending >= MAX_POKEMON_LEVEL) return 0;
  const msPer = daycareMsPerLevel(currentLevel);
  const elapsed = Math.max(0, now.getTime() - lastCollectedAt.getTime());
  const into = elapsed % msPer;
  if (into === 0 && elapsed > 0 && pending > 0) return 0;
  return into === 0 ? msPer : msPer - into;
}

/** Progreso 0–1 hacia el próximo nivel pendiente de cobrar. */
export function daycareProgressToNext(
  currentLevel: number,
  lastCollectedAt: Date,
  badgeCount: number,
  now: Date = new Date(),
): number {
  const pending = pendingDaycareLevels(currentLevel, lastCollectedAt, badgeCount, now);
  if (pending >= DAYCARE_MAX_LEVELS_PER_STAY) return 1;
  const ceiling = daycareLevelCeiling(badgeCount);
  if (currentLevel + pending >= ceiling || currentLevel >= MAX_POKEMON_LEVEL) return 1;
  const msPer = daycareMsPerLevel(currentLevel);
  const msLeft = daycareMsUntilNext(currentLevel, lastCollectedAt, badgeCount, now);
  if (msLeft <= 0 && pending > 0) return 1;
  return Math.min(1, Math.max(0, 1 - msLeft / msPer));
}
