import { seasonEndRewards } from "@/lib/pvp/rewards";
import {
  PVP_TIERS,
  nextRankProgress,
  tierForRating,
  type PvpTier,
} from "@/lib/pvp/tiers";
import type { RewardBundle } from "@/lib/events/rewards";

export { nextRankProgress };

/** Racha de victorias actuales (partidos más recientes primero). */
export function currentWinStreak(
  matches: { winnerId: string | null; status: string }[],
  userId: string,
): number {
  let streak = 0;
  for (const m of matches) {
    if (m.status !== "COMPLETED" && m.status !== "FORFEIT") break;
    if (m.winnerId === userId) streak += 1;
    else break;
  }
  return streak;
}

export type SeasonTrackNode = {
  tier: PvpTier;
  minRating: number;
  rewards: RewardBundle;
  state: "locked" | "current" | "cleared";
};

/** Pista tipo pase: recompensas de fin de temporada por liga. */
export function buildSeasonTrack(rating: number): SeasonTrackNode[] {
  const current = tierForRating(rating);
  const currentIdx = PVP_TIERS.findIndex((t) => t.id === current);
  return PVP_TIERS.map((t, i) => ({
    tier: t.id,
    minRating: t.minRating,
    rewards: seasonEndRewards(t.id),
    state: i < currentIdx ? "cleared" : i === currentIdx ? "current" : "locked",
  }));
}

export function nextTierProgress(rating: number): {
  current: PvpTier;
  next: PvpTier | null;
  currentMin: number;
  nextMin: number | null;
  pct: number;
} {
  const progress = nextRankProgress(rating);
  return {
    current: progress.current.tier,
    next: progress.next?.tier ?? null,
    currentMin: progress.currentFloor,
    nextMin: progress.nextFloor,
    pct: progress.pct,
  };
}

export function formatSeasonCountdown(ms: number): {
  days: number;
  hours: number;
  minutes: number;
} {
  const clamped = Math.max(0, ms);
  const days = Math.floor(clamped / 86_400_000);
  const hours = Math.floor((clamped % 86_400_000) / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  return { days, hours, minutes };
}
