import { CLAN_WAR_BATTLE_SLOTS } from "@/lib/clan-war/rules";

export type MatchCandidate = {
  clanId: string;
  registrationId: string;
  rating: number;
};

/**
 * Empareja dos registros por cercanía de Elo (pool de 6, pick aleatorio del
 * más cercano). Devuelve null si no hay rival.
 */
export function pickWarOpponent(
  me: MatchCandidate,
  others: MatchCandidate[],
  rng: () => number = Math.random,
): MatchCandidate | null {
  const pool = others
    .filter((o) => o.clanId !== me.clanId)
    .sort((a, b) => Math.abs(a.rating - me.rating) - Math.abs(b.rating - me.rating))
    .slice(0, 6);
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)] ?? null;
}

export function buildWarBattleSlots(total = CLAN_WAR_BATTLE_SLOTS): number[] {
  return Array.from({ length: total }, (_, i) => i + 1);
}
