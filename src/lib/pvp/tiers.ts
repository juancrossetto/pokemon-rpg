/** Ligas clasificatorias PvP por Elo (solo Ranked mueve rating). */

export type PvpTier =
  | "beginner"
  | "rising"
  | "advanced"
  | "elite"
  | "bronzeMaster"
  | "crystalMaster"
  | "champion"
  | "legendary";

/** 3 = base (III), 2 = media (II), 1 = tope de liga (I). */
export type PvpDivision = 1 | 2 | 3;

export type PvpRankStanding = {
  tier: PvpTier;
  division: PvpDivision;
};

export type PvpTierDef = {
  id: PvpTier;
  minRating: number;
  /** Multiplicador de monedas al ganar. */
  coinMult: number;
  /** Asset en `/public/pvp/ranks/`. */
  badgeFile: string;
};

export const PVP_TIERS: readonly PvpTierDef[] = [
  { id: "beginner", minRating: 0, coinMult: 1, badgeFile: "beginnerrank.png" },
  { id: "rising", minRating: 1100, coinMult: 1.15, badgeFile: "risingrank.png" },
  { id: "advanced", minRating: 1200, coinMult: 1.3, badgeFile: "advancedrank.png" },
  { id: "elite", minRating: 1325, coinMult: 1.45, badgeFile: "eliterank.png" },
  { id: "bronzeMaster", minRating: 1450, coinMult: 1.6, badgeFile: "bronzemasterrank.png" },
  { id: "crystalMaster", minRating: 1600, coinMult: 1.8, badgeFile: "crystalmasterrank.png" },
  { id: "champion", minRating: 1800, coinMult: 2.1, badgeFile: "championrank.png" },
  { id: "legendary", minRating: 2000, coinMult: 2.4, badgeFile: "legendaryrank.png" },
] as const;

/** Bandas abiertas dentro de Legendario (III / II / I). */
const LEGENDARY_DIVISION_SPAN = 100;

export function tierForRating(rating: number): PvpTier {
  let current: PvpTier = "beginner";
  for (const t of PVP_TIERS) {
    if (rating >= t.minRating) current = t.id;
  }
  return current;
}

export function tierDef(tier: PvpTier): PvpTierDef {
  return PVP_TIERS.find((t) => t.id === tier) ?? PVP_TIERS[0];
}

export function tierBadgeSrc(tier: PvpTier): string {
  return `/pvp/ranks/${tierDef(tier).badgeFile}`;
}

export function divisionRoman(division: PvpDivision): "I" | "II" | "III" {
  return division === 1 ? "I" : division === 2 ? "II" : "III";
}

export function rankForRating(rating: number): PvpRankStanding {
  return { tier: tierForRating(rating), division: divisionForRating(rating) };
}

export function divisionForRating(rating: number): PvpDivision {
  const tier = tierForRating(rating);
  const idx = PVP_TIERS.findIndex((t) => t.id === tier);
  const min = PVP_TIERS[idx]?.minRating ?? 0;
  const nextMin = PVP_TIERS[idx + 1]?.minRating;

  if (nextMin == null) {
    const offset = Math.max(0, rating - min);
    if (offset < LEGENDARY_DIVISION_SPAN) return 3;
    if (offset < LEGENDARY_DIVISION_SPAN * 2) return 2;
    return 1;
  }

  const span = nextMin - min;
  const pos = Math.max(0, rating - min);
  const third = span / 3;
  if (pos < third) return 3;
  if (pos < third * 2) return 2;
  return 1;
}

/** Elo mínimo inclusivo de esta liga+división. */
export function rankFloor(standing: PvpRankStanding): number {
  const idx = PVP_TIERS.findIndex((t) => t.id === standing.tier);
  const min = PVP_TIERS[idx]?.minRating ?? 0;
  const nextMin = PVP_TIERS[idx + 1]?.minRating;

  if (nextMin == null) {
    if (standing.division === 3) return min;
    if (standing.division === 2) return min + LEGENDARY_DIVISION_SPAN;
    return min + LEGENDARY_DIVISION_SPAN * 2;
  }

  const third = (nextMin - min) / 3;
  if (standing.division === 3) return min;
  if (standing.division === 2) return min + third;
  return min + third * 2;
}

export function nextRank(standing: PvpRankStanding): PvpRankStanding | null {
  if (standing.division > 1) {
    return {
      tier: standing.tier,
      division: (standing.division - 1) as PvpDivision,
    };
  }
  const idx = PVP_TIERS.findIndex((t) => t.id === standing.tier);
  const next = PVP_TIERS[idx + 1];
  if (!next) return null;
  return { tier: next.id, division: 3 };
}

/** Progreso hacia la siguiente división (o liga). */
export function nextRankProgress(rating: number): {
  current: PvpRankStanding;
  next: PvpRankStanding | null;
  pct: number;
  currentFloor: number;
  nextFloor: number | null;
} {
  const current = rankForRating(rating);
  const next = nextRank(current);
  const currentFloor = rankFloor(current);
  if (!next) {
    return { current, next: null, pct: 100, currentFloor, nextFloor: null };
  }
  const nextFloor = rankFloor(next);
  const span = Math.max(1, nextFloor - currentFloor);
  const pct = Math.min(
    100,
    Math.max(0, Math.round(((rating - currentFloor) / span) * 100)),
  );
  return { current, next, pct, currentFloor, nextFloor };
}

/** @deprecated Prefer `nextRankProgress` (incluye divisiones). */
export function nextTierProgress(rating: number): {
  current: PvpTier;
  next: PvpTier | null;
  currentMin: number;
  nextMin: number | null;
  pct: number;
} {
  const current = tierForRating(rating);
  const idx = PVP_TIERS.findIndex((t) => t.id === current);
  const next = PVP_TIERS[idx + 1] ?? null;
  const currentMin = PVP_TIERS[idx]?.minRating ?? 0;
  const nextMin = next?.minRating ?? null;
  if (nextMin == null) {
    return { current, next: null, currentMin, nextMin: null, pct: 100 };
  }
  const span = Math.max(1, nextMin - currentMin);
  const pct = Math.min(
    100,
    Math.max(0, Math.round(((rating - currentMin) / span) * 100)),
  );
  return { current, next: next.id, currentMin, nextMin, pct };
}

/** Color accent Tailwind-ish class fragment for UI chips. */
export function tierAccentClass(tier: PvpTier): string {
  switch (tier) {
    case "beginner":
      return "border-lime-500/40 bg-lime-900/25 text-lime-200";
    case "rising":
      return "border-sky-400/40 bg-sky-900/25 text-sky-200";
    case "advanced":
      return "border-violet-400/40 bg-violet-900/25 text-violet-200";
    case "elite":
      return "border-amber-400/45 bg-amber-900/25 text-amber-200";
    case "bronzeMaster":
      return "border-orange-700/50 bg-orange-900/30 text-orange-300";
    case "crystalMaster":
      return "border-cyan-300/50 bg-cyan-900/30 text-cyan-100";
    case "champion":
      return "border-tertiary/50 bg-tertiary/15 text-tertiary";
    case "legendary":
      return "border-gem/50 bg-gem-container/80 text-gem";
  }
}
