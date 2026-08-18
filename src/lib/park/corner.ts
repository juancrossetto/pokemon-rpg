import { CORNER_SPIN_ENERGY_COST } from "@/lib/energy";

export const CORNER_FREE_SPINS_PER_DAY = 3;

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

/*
  El giro no cobra monedas: los primeros `CORNER_FREE_SPINS_PER_DAY` del día
  son gratis y el resto gasta 1 de energía. Los premios están por debajo del
  pack de la tienda (30 ●/energía): ni el jackpot compra un pack, y el valor
  esperado de un giro pago queda lejos de imprimir oro.
*/
export const CORNER_PAYOUT: Record<string, number> = {
  "ball,ball,ball": 24,
  "berry,berry,berry": 40,
  "star,star,star": 55,
  "seven,seven,seven": 90,
};

export function spinCornerReel(roll: number): CornerSymbol {
  const index = Math.floor(Math.max(0, Math.min(0.999999, roll)) * CORNER_REELS.length);
  return CORNER_REELS[index]!;
}

/** Premios por combinación parcial (dos símbolos iguales). */
export const CORNER_PAIR_PAYOUT = {
  star: 10,
  seven: 16,
} as const;

export function cornerPayout(reels: readonly CornerSymbol[]): number {
  const key = reels.join(",");
  if (CORNER_PAYOUT[key]) return CORNER_PAYOUT[key];
  /*
    Las parejas pagan sin importar en qué rodillos caen.
    La estrella antes exigía que fueran los dos primeros
    (`reels[0] === reels[1] && reels[0] === "star"`), así que `★-x-★` no pagaba
    mientras que la misma jugada con sietes sí: una asimetría que no estaba en
    ninguna regla y que la tabla de premios en pantalla no podía explicar.
  */
  if (reels.filter((s) => s === "seven").length === 2) return CORNER_PAIR_PAYOUT.seven;
  if (reels.filter((s) => s === "star").length === 2) return CORNER_PAIR_PAYOUT.star;
  return 0;
}

export type CornerPaytableRow = {
  symbol: CornerSymbol;
  /** Cuántos iguales hacen falta. */
  count: 2 | 3;
  payout: number;
  jackpot: boolean;
};

/**
 * Tabla de premios para mostrar en pantalla.
 *
 * Se deriva de las mismas constantes que usa `cornerPayout`, no es una lista
 * escrita a mano: si cambia un premio, cambia lo que ve el jugador. Una tabla
 * duplicada que se desincroniza del pago real es peor que no tener tabla.
 */
export function cornerPaytable(): CornerPaytableRow[] {
  const triples: CornerPaytableRow[] = (["ball", "berry", "star", "seven"] as const).map(
    (symbol) => ({
      symbol,
      count: 3,
      payout: CORNER_PAYOUT[[symbol, symbol, symbol].join(",")] ?? 0,
      jackpot: symbol === "seven",
    }),
  );
  const pairs: CornerPaytableRow[] = (["star", "seven"] as const).map((symbol) => ({
    symbol,
    count: 2,
    payout: CORNER_PAIR_PAYOUT[symbol],
    jackpot: false,
  }));
  // De mayor a menor: el premio gordo va primero. Al revés, lo primero que ve
  // el jugador es el premio más chico, que es lo contrario de invitar a jugar.
  return [...triples, ...pairs].sort((a, b) => b.payout - a.payout);
}

/** Premio medio por tirada: 7³ combinaciones equiprobables del bolsín. */
export function cornerExpectedPayout(): number {
  let total = 0;
  for (const a of CORNER_REELS) {
    for (const b of CORNER_REELS) {
      for (const c of CORNER_REELS) {
        total += cornerPayout([a, b, c]);
      }
    }
  }
  return total / CORNER_REELS.length ** 3;
}

/** Giros ya usados hoy. Un `dayKey` viejo (el de ayer) cuenta como cero. */
export function cornerSpinsUsedToday(
  row: { dayKey: string; spins: number } | null | undefined,
  today: string,
): number {
  if (!row || row.dayKey !== today) return 0;
  return Math.max(0, row.spins);
}

export function cornerEnergyCost(spinsUsedToday: number): number {
  return spinsUsedToday < CORNER_FREE_SPINS_PER_DAY ? 0 : CORNER_SPIN_ENERGY_COST;
}

export function cornerFreeLeft(spinsUsedToday: number): number {
  return Math.max(0, CORNER_FREE_SPINS_PER_DAY - spinsUsedToday);
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
