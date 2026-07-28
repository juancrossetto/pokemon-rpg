/** Ligas PvP por Elo. Umbrales fijos; se muestran en hub, resultado y ranking. */

export type PvpTier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";

export type PvpTierDef = {
  id: PvpTier;
  minRating: number;
  /** Multiplicador de monedas al ganar ranked. */
  coinMult: number;
};

export const PVP_TIERS: readonly PvpTierDef[] = [
  { id: "bronze", minRating: 0, coinMult: 1 },
  { id: "silver", minRating: 1100, coinMult: 1.15 },
  { id: "gold", minRating: 1250, coinMult: 1.3 },
  { id: "platinum", minRating: 1400, coinMult: 1.5 },
  { id: "diamond", minRating: 1600, coinMult: 1.75 },
  { id: "master", minRating: 1800, coinMult: 2 },
] as const;

export function tierForRating(rating: number): PvpTier {
  let current: PvpTier = "bronze";
  for (const t of PVP_TIERS) {
    if (rating >= t.minRating) current = t.id;
  }
  return current;
}

export function tierDef(tier: PvpTier): PvpTierDef {
  return PVP_TIERS.find((t) => t.id === tier) ?? PVP_TIERS[0];
}

/** Color accent Tailwind-ish class fragment for UI chips. */
export function tierAccentClass(tier: PvpTier): string {
  switch (tier) {
    case "bronze":
      return "border-orange-700/50 bg-orange-900/30 text-orange-300";
    case "silver":
      return "border-slate-400/40 bg-slate-500/20 text-slate-200";
    case "gold":
      return "border-tertiary/50 bg-tertiary/15 text-tertiary";
    case "platinum":
      return "border-cyan-400/40 bg-cyan-900/25 text-cyan-200";
    case "diamond":
      return "border-sky-300/50 bg-sky-800/30 text-sky-200";
    case "master":
      return "border-fuchsia-400/50 bg-fuchsia-900/30 text-fuchsia-200";
  }
}
