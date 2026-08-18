export const FRONTIER_FACILITIES = ["palace", "dome"] as const;
export type FrontierFacility = (typeof FRONTIER_FACILITIES)[number];

/*
  El pack de energía sale 300 ● / 10 = 30 ● por punto.

  Si el Recinto paga más que eso por energía gastada, comprar packs y spamear
  Palacio es un loop infinito de oro. Los premios tienen que quedar *por debajo*
  de ese piso incluso ganando siempre: 3 energía × 30 ● = 90 ● de costo
  equivalente; el tope de Palacio (42) y la copa del Dome (48) no lo cubren.
*/
export const FRONTIER_PALACE_WIN_COINS = 22;
export const FRONTIER_PALACE_STREAK_BONUS = 5;
export const FRONTIER_PALACE_PAYOUT_CAP = 42;
export const FRONTIER_DOME_ROUNDS = 3;
export const FRONTIER_DOME_CUP_COINS = 48;
export const FRONTIER_DOME_ROUND_COINS = 10;

export function isFrontierFacility(value: string): value is FrontierFacility {
  return (FRONTIER_FACILITIES as readonly string[]).includes(value);
}

export function palaceWinPayout(streakAfterWin: number): number {
  const scaled =
    FRONTIER_PALACE_WIN_COINS + Math.max(0, streakAfterWin - 1) * FRONTIER_PALACE_STREAK_BONUS;
  return Math.min(FRONTIER_PALACE_PAYOUT_CAP, scaled);
}
