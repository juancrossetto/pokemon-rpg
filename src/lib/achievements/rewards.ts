import type { AchievementRarity } from "@/lib/trainer-profile";
import type { RewardBundle } from "@/lib/events/rewards";

/** Recompensas one-shot por rareza del logro. El cliente nunca las elige. */
export const ACHIEVEMENT_REWARDS: Record<AchievementRarity, RewardBundle> = {
  common: [{ kind: "coins", amount: 150 }],
  rare: [
    { kind: "coins", amount: 400 },
    { kind: "energy", amount: 2 },
  ],
  epic: [
    { kind: "coins", amount: 800 },
    { kind: "gems", amount: 1 },
  ],
  legendary: [
    { kind: "coins", amount: 1500 },
    { kind: "gems", amount: 2 },
  ],
};

export function rewardsForAchievementRarity(rarity: AchievementRarity): RewardBundle {
  return ACHIEVEMENT_REWARDS[rarity];
}
