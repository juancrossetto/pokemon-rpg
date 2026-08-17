export const CORNER_SPIN_COST = 50;

export type CornerSymbol = "ball" | "berry" | "star" | "seven";

export const CORNER_REELS: readonly CornerSymbol[] = [
  "ball",
  "ball",
  "ball",
  "berry",
  "berry",
  "star",
  "seven",
];

export const CORNER_PAYOUT: Record<string, number> = {
  "ball,ball,ball": 80,
  "berry,berry,berry": 160,
  "star,star,star": 400,
  "seven,seven,seven": 2500,
};

export function spinCornerReel(roll: number): CornerSymbol {
  const index = Math.floor(Math.max(0, Math.min(0.999999, roll)) * CORNER_REELS.length);
  return CORNER_REELS[index]!;
}

export function cornerPayout(reels: readonly CornerSymbol[]): number {
  const key = reels.join(",");
  if (CORNER_PAYOUT[key]) return CORNER_PAYOUT[key];
  if (reels[0] === reels[1] && reels[0] === "star") return 90;
  if (reels.filter((s) => s === "seven").length === 2) return 200;
  return 0;
}

export function spinCorner(random: () => number = Math.random): {
  reels: [CornerSymbol, CornerSymbol, CornerSymbol];
  payout: number;
} {
  const reels: [CornerSymbol, CornerSymbol, CornerSymbol] = [
    spinCornerReel(random()),
    spinCornerReel(random()),
    spinCornerReel(random()),
  ];
  return { reels, payout: cornerPayout(reels) };
}
