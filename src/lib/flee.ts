/**
 * Chance de huida Gen III/IV:
 * odds = floor(playerSpeed × 128 / wildSpeed) + 30 × fleeAttempts
 * Si odds ≥ 256 → siempre escapa. Si no, random 0–255 < odds.
 */
export function fleeOdds(playerSpeed: number, wildSpeed: number, fleeAttempts: number): number {
  const a = Math.max(1, Math.floor(playerSpeed));
  const b = Math.max(1, Math.floor(wildSpeed));
  const attempts = Math.max(0, Math.floor(fleeAttempts));
  return Math.floor((a * 128) / b) + 30 * attempts;
}

export function rollFlee(
  playerSpeed: number,
  wildSpeed: number,
  fleeAttempts: number,
  rng: () => number = Math.random,
): boolean {
  const odds = fleeOdds(playerSpeed, wildSpeed, fleeAttempts);
  if (odds >= 256) return true;
  return Math.floor(rng() * 256) < odds;
}
