import { WONDER_TRADE_ENERGY_COST } from "@/lib/energy";

/** Pokémon NPC de reserva si no hay otro jugador en cola. */
export const WONDER_NPC_POOL = [
  16, 19, 21, 23, 27, 29, 32, 41, 43, 46, 48, 52, 54, 56, 60, 69, 74, 81, 88, 92, 96, 98, 100,
  109, 116, 118, 129,
] as const;

/** Lo que el laboratorio muestra al cerrar un trueque. */
export type WonderReceipt = {
  name: string;
  speciesName: string;
  speciesId: number;
  level: number;
  isShiny: boolean;
};

export function wonderNpcSpecies(roll: number): number {
  const index = Math.floor(Math.max(0, Math.min(0.999999, roll)) * WONDER_NPC_POOL.length);
  return WONDER_NPC_POOL[index]!;
}

export function wonderNpcLevel(offeredLevel: number, roll: number): number {
  const jitter = Math.floor(roll * 5) - 2;
  return Math.max(5, Math.min(80, offeredLevel + jitter));
}

/**
 * Los primeros `WONDER_FREE_TRADES_PER_DAY` trueques del día son gratis.
 * El resto cobra `WONDER_TRADE_ENERGY_COST`, igual que pesca y casino.
 * Cola con jugadores y trueque con el científico comparten el mismo cupo.
 */
export const WONDER_FREE_TRADES_PER_DAY = 3;

export function wonderTradesUsedToday(
  row: { dayKey: string; trades: number } | null | undefined,
  today: string,
): number {
  if (!row || row.dayKey !== today) return 0;
  return Math.max(0, row.trades);
}

export function wonderEnergyCost(tradesUsedToday: number): number {
  return tradesUsedToday < WONDER_FREE_TRADES_PER_DAY ? 0 : WONDER_TRADE_ENERGY_COST;
}

export function wonderFreeLeft(tradesUsedToday: number): number {
  return Math.max(0, WONDER_FREE_TRADES_PER_DAY - tradesUsedToday);
}
