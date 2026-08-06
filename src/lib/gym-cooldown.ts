/** Formato corto para UI: `3h 24m`, `12m 05s`, `45s`. */
export function formatGymCooldown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }
  if (m > 0) {
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }
  return `${s}s`;
}

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
