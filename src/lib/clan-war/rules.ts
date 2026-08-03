/** Reglas puras de guerra de clanes (sin Prisma). */

export const CLAN_WAR_MIN_MEMBERS = 10;
export const CLAN_WAR_MIN_LEVEL = 5;
export const CLAN_WAR_BATTLE_SLOTS = 5;
export const CLAN_WAR_STARTING_RATING = 1000;
/** Costo de energía por pelear un slot (mismo ritmo que PvP rápido). */
export const CLAN_WAR_ENERGY_COST = 5;

/** Nivel derivado: floor(totalBadges / 5) + 1 */
export function clanLevelFromBadges(totalBadges: number): number {
  return Math.max(1, Math.floor(totalBadges / 5) + 1);
}

export function canRegisterForWar(input: {
  memberCount: number;
  totalBadges: number;
}): { ok: true } | { ok: false; reason: "members" | "level" } {
  if (input.memberCount < CLAN_WAR_MIN_MEMBERS) return { ok: false, reason: "members" };
  if (clanLevelFromBadges(input.totalBadges) < CLAN_WAR_MIN_LEVEL) {
    return { ok: false, reason: "level" };
  }
  return { ok: true };
}

export function warScoreAfterBattle(
  scoreA: number,
  scoreB: number,
  winnerSide: "A" | "B",
): { scoreA: number; scoreB: number } {
  return winnerSide === "A"
    ? { scoreA: scoreA + 1, scoreB }
    : { scoreA, scoreB: scoreB + 1 };
}

export function warIsComplete(completedSlots: number, totalSlots = CLAN_WAR_BATTLE_SLOTS): boolean {
  return completedSlots >= totalSlots;
}

export function warWinnerSide(
  scoreA: number,
  scoreB: number,
): "A" | "B" | "draw" {
  if (scoreA > scoreB) return "A";
  if (scoreB > scoreA) return "B";
  return "draw";
}
