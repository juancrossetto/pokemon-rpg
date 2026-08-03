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
    case "beginner":
      return [
        { kind: "coins", amount: 200 },
        { kind: "energy", amount: 5 },
      ];
    case "rising":
      return [
        { kind: "coins", amount: 400 },
        { kind: "energy", amount: 8 },
      ];
    case "advanced":
      return [
        { kind: "coins", amount: 650 },
        { kind: "energy", amount: 10 },
        { kind: "gems", amount: 1 },
      ];
    case "elite":
      return [
        { kind: "coins", amount: 900 },
        { kind: "gems", amount: 2 },
        { kind: "energy", amount: 12 },
      ];
    case "bronzeMaster":
      return [
        { kind: "coins", amount: 1300 },
        { kind: "gems", amount: 3 },
        { kind: "energy", amount: 15 },
      ];
    case "crystalMaster":
      return [
        { kind: "coins", amount: 1800 },
        { kind: "gems", amount: 5 },
        { kind: "energy", amount: 18 },
      ];
    case "champion":
      return [
        { kind: "coins", amount: 2500 },
        { kind: "gems", amount: 8 },
        { kind: "energy", amount: 22 },
      ];
    case "legendary":
      return [
        { kind: "coins", amount: 4000 },
        { kind: "gems", amount: 12 },
        { kind: "energy", amount: 30 },
      ];
  }
}
