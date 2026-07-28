/**
 * Saltar el cooldown de un gimnasio (tras derrota) con gemas.
 * Escala con el tiempo restante: más caro cuanto más queda.
 */
export function gymCooldownSkipCost(remainingMs: number): number {
  if (remainingMs <= 0) return 0;
  const hours = remainingMs / (60 * 60 * 1000);
  if (hours <= 6) return 1;
  if (hours <= 12) return 2;
  return 3;
}

export function gymCooldownRemainingMs(opts: {
  cooldownHours: number;
  attemptedAt: Date;
  now?: number;
}): number {
  const now = opts.now ?? Date.now();
  const cooldownMs = opts.cooldownHours * 60 * 60 * 1000;
  return Math.max(0, cooldownMs - (now - opts.attemptedAt.getTime()));
}
