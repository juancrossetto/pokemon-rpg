/**
 * Beneficios por medallas (más allá de desbloquear el siguiente gimnasio).
 * - Obediencia: techo de nivel que el equipo sigue sin dudar.
 * - Mercado: descuento en la tarifa de publicación.
 * - Rematch: recompensa de monedas reducida al volver a retar.
 */

export function obedienceLevelCap(badgeCount: number): number {
  // Estilo clásico simplificado: 0→20, 1→30 … 7→90, 8→999
  if (badgeCount >= 8) return 999;
  return 20 + badgeCount * 10;
}

/** Probabilidad de desobedecer si el nivel supera el tope. */
export function disobeyChance(level: number, badgeCount: number): number {
  const cap = obedienceLevelCap(badgeCount);
  if (level <= cap) return 0;
  const over = level - cap;
  return Math.min(0.55, 0.15 + over * 0.03);
}

/** Descuento en fee de listing: 5% por medalla, tope 40%. */
export function marketFeeDiscount(badgeCount: number): number {
  return Math.min(0.4, badgeCount * 0.05);
}

export function applyMarketFeeDiscount(fee: number, badgeCount: number): number {
  const discounted = Math.floor(fee * (1 - marketFeeDiscount(badgeCount)));
  return Math.max(1, discounted);
}

/** Rematch de gimnasio (ya tenés la medalla): 50% de monedas. */
export function gymRematchCoinMultiplier(alreadyHasBadge: boolean): number {
  return alreadyHasBadge ? 0.5 : 1;
}
