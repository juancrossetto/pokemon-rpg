/**
 * Mastery de zona.
 *
 * El dossier pedía que volver a una zona ya completada siguiera teniendo
 * sentido. La progresión de campaña se agota (terminás los stages y no volvés);
 * el Mastery no: sube con cada victoria salvaje en esa zona y paga bonus
 * permanentes **en esa zona**, así que farmear donde ya "terminaste" rinde más
 * que farmear donde recién llegás.
 *
 * Los bonus son chicos a propósito: la gracia es que se acumulen, no que un
 * nivel 3 rompa la economía.
 */
export const MASTERY_XP_PER_WIN = 10;
export const MASTERY_MAX_LEVEL = 20;

/** XP acumulada necesaria para alcanzar un nivel. Curva cuadrática suave. */
export function masteryXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * (level - 1) * level;
}

export function masteryLevel(xp: number): number {
  let level = 1;
  while (level < MASTERY_MAX_LEVEL && xp >= masteryXpForLevel(level + 1)) level++;
  return level;
}

/** Progreso 0-100 dentro del nivel actual. */
export function masteryProgressPercent(xp: number): number {
  const level = masteryLevel(xp);
  if (level >= MASTERY_MAX_LEVEL) return 100;
  const floor = masteryXpForLevel(level);
  const next = masteryXpForLevel(level + 1);
  return Math.round(((xp - floor) / (next - floor)) * 100);
}

export type MasteryBonuses = {
  /** % extra de XP de combate en la zona. */
  xp: number;
  /** % extra a la probabilidad de captura. */
  capture: number;
  /** % extra de monedas. */
  coins: number;
};

/**
 * Bonus por nivel. Lineales y acotados: a nivel 20 son +38% XP, +19% captura y
 * +57% monedas — notable, pero lejos de trivializar nada.
 */
export function masteryBonuses(level: number): MasteryBonuses {
  const steps = Math.max(0, level - 1);
  return {
    xp: steps * 2,
    capture: steps,
    coins: steps * 3,
  };
}

export function applyBonus(base: number, percent: number): number {
  return Math.round(base * (1 + percent / 100));
}
