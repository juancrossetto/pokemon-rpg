import type { RewardBundle } from "@/lib/events/rewards";
import { tierDef, tierForRating, type PvpTier } from "@/lib/pvp/tiers";

const BASE_WIN_COINS = 40;
const BASE_LOSS_COINS = 12;

/** Monedas al terminar un ranked (o quick). Escala con la liga del ganador. */
export function pvpMatchRewards(input: {
  won: boolean;
  rating: number;
  mode: "RANKED" | "QUICK";
}): RewardBundle {
  const tier = tierForRating(input.rating);
  const mult = tierDef(tier).coinMult;
  // Quick paga un poco menos: no jugaste los turnos.
  const modeMult = input.mode === "QUICK" ? 0.6 : 1;
  if (input.won) {
    const amount = Math.max(1, Math.round(BASE_WIN_COINS * mult * modeMult));
    return [{ kind: "coins", amount }];
  }
  const amount = Math.max(1, Math.round(BASE_LOSS_COINS * modeMult));
  return [{ kind: "coins", amount }];
}

/** Premio al cerrar temporada según la liga alcanzada. */
export function seasonEndRewards(tier: PvpTier): RewardBundle {
  switch (tier) {
    case "bronze":
      return [{ kind: "coins", amount: 100 }];
    case "silver":
      return [
        { kind: "coins", amount: 200 },
        { kind: "energy", amount: 5 },
      ];
    case "gold":
      return [
        { kind: "coins", amount: 350 },
        { kind: "gems", amount: 1 },
      ];
    case "platinum":
      return [
        { kind: "coins", amount: 500 },
        { kind: "gems", amount: 2 },
      ];
    case "diamond":
      return [
        { kind: "coins", amount: 750 },
        { kind: "gems", amount: 3 },
      ];
    case "master":
      return [
        { kind: "coins", amount: 1200 },
        { kind: "gems", amount: 5 },
      ];
  }
}
