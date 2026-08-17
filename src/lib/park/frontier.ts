export const FRONTIER_FACILITIES = ["palace", "dome"] as const;
export type FrontierFacility = (typeof FRONTIER_FACILITIES)[number];

export const FRONTIER_PALACE_WIN_COINS = 80;
export const FRONTIER_DOME_ROUNDS = 3;
export const FRONTIER_DOME_CUP_COINS = 280;

export function isFrontierFacility(value: string): value is FrontierFacility {
  return (FRONTIER_FACILITIES as readonly string[]).includes(value);
}

export function palaceWinPayout(streakAfterWin: number): number {
  return FRONTIER_PALACE_WIN_COINS + Math.max(0, streakAfterWin - 1) * 15;
}
