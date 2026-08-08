import { formatGymCooldown } from "@/lib/gym-cooldown";

/** Mínimo entre desafíos / rematch al mismo rival (evita farmear Elo). */
export const PVP_CHALLENGE_COOLDOWN_MS = 10 * 60 * 1000;

/** Ms restantes del cooldown PvP desde el `createdAt` del último match del par. */
export function pvpChallengeCooldownRemainingMs(
  lastMatchAt: Date | null | undefined,
  now = Date.now(),
): number {
  if (!lastMatchAt) return 0;
  return Math.max(0, PVP_CHALLENGE_COOLDOWN_MS - (now - lastMatchAt.getTime()));
}

/** Mismo formato corto que gimnasios: `9m 42s`, `45s`. */
export function formatPvpCooldown(remainingMs: number): string {
  return formatGymCooldown(remainingMs);
}
