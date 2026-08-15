import type { MoveSnapshot } from "@/lib/battle";
import type { PvpBattleResult, PvpTeam } from "@/lib/pvp-battle";

export const FACTORY_TEAM_SIZE = 3;
export const FACTORY_DRAFT_SIZE = 6;
export const FACTORY_MAX_WINS = 7;
export const FACTORY_LEVEL = 50;

export type FactoryRental = {
  speciesId: number;
  name: string;
  spriteUrl: string;
  types: string[];
  level: number;
  maxHp: number;
  stats: {
    level: number;
    types: string[];
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };
  moves: MoveSnapshot[];
};

export type FactoryBattleRound = {
  round: number;
  won: boolean;
  turns: number;
  koLog: string[];
  opponentSpeciesIds: number[];
};

export type FactoryRunView = {
  id: string;
  dayKey: string;
  status: "DRAFTING" | "ACTIVE" | "AWAITING_SWAP" | "WON" | "LOST";
  round: number;
  draftPool: FactoryRental[];
  team: FactoryRental[];
  lastOpponent: FactoryRental[];
  battleHistory: FactoryBattleRound[];
  totalTurns: number;
  pointsAwarded: number;
  rewardClaimed: boolean;
};

export type FactoryRankingEntry = {
  position: number;
  username: string;
  avatarId: string | null;
  wins: number;
  turns: number;
  completed: boolean;
  isCurrentUser: boolean;
};

export function parseRentals(value: unknown): FactoryRental[] {
  return Array.isArray(value) ? (value as FactoryRental[]) : [];
}

export function parseBattleHistory(value: unknown): FactoryBattleRound[] {
  return Array.isArray(value) ? (value as FactoryBattleRound[]) : [];
}

function seedHash(seed: string): number {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function deterministicShuffle<T>(values: readonly T[], seed: string): T[] {
  const result = [...values];
  const random = mulberry32(seedHash(seed));
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function factoryDraft(catalog: readonly FactoryRental[], day: string): FactoryRental[] {
  return deterministicShuffle(catalog, `factory:${day}:draft`).slice(0, FACTORY_DRAFT_SIZE);
}

export function factoryOpponent(
  catalog: readonly FactoryRental[],
  day: string,
  round: number,
): FactoryRental[] {
  return deterministicShuffle(catalog, `factory:${day}:opponent:${round}`).slice(
    0,
    FACTORY_TEAM_SIZE,
  );
}

/** Curva suave: el séptimo rival tiene ~9% más stats, no niveles inflados. */
export function opponentDifficulty(round: number): number {
  return [0.9, 0.93, 0.96, 0.99, 1.02, 1.055, 1.09][Math.max(0, Math.min(6, round - 1))];
}

export function rentalsToBattleTeam(
  rentals: readonly FactoryRental[],
  multiplier = 1,
): PvpTeam {
  return rentals.map((rental) => ({
    name: rental.name,
    maxHp: Math.max(1, Math.round(rental.maxHp * multiplier)),
    stats: {
      ...rental.stats,
      atk: Math.max(1, Math.round(rental.stats.atk * multiplier)),
      def: Math.max(1, Math.round(rental.stats.def * multiplier)),
      spAtk: Math.max(1, Math.round(rental.stats.spAtk * multiplier)),
      spDef: Math.max(1, Math.round(rental.stats.spDef * multiplier)),
      speed: Math.max(1, Math.round(rental.stats.speed * multiplier)),
    },
    moves: rental.moves,
  }));
}

export function factoryRoundRecord(
  round: number,
  opponent: readonly FactoryRental[],
  result: PvpBattleResult,
): FactoryBattleRound {
  return {
    round,
    won: result.winner === "a",
    turns: result.turns,
    koLog: result.koLog,
    opponentSpeciesIds: opponent.map((rental) => rental.speciesId),
  };
}

export function factoryPointsForWins(wins: number): number {
  const safeWins = Math.max(0, Math.min(FACTORY_MAX_WINS, Math.floor(wins)));
  return safeWins * 12 + (safeWins >= FACTORY_MAX_WINS ? 36 : 0);
}

/**
 * Canje de Puntos Fábrica.
 *
 * Los puntos se ganaban y no se gastaban en ningún lado: `ShopCurrency` sólo
 * conoce monedas y gemas, así que la moneda del modo era un contador muerto y
 * la corrida diaria no tenía para qué repetirse una vez vista.
 *
 * El canje vive acá y no en la tienda a propósito: sumar una tercera moneda al
 * catálogo obligaba a tocar precios, filtros y el panel de compra enteros para
 * cinco productos. Acá es una lista cerrada, al lado de donde se ganan.
 *
 * Los nombres coinciden con `Item.name` sembrado — verificado contra la base;
 * si se agrega uno que no exista, la entrega lo omite en vez de romper.
 */
export type FactoryExchangeEntry = {
  itemName: string;
  cost: number;
  quantity: number;
};

export const FACTORY_EXCHANGE: readonly FactoryExchangeEntry[] = [
  { itemName: "Ultra Ball", cost: 30, quantity: 5 },
  { itemName: "Max Revive", cost: 60, quantity: 2 },
  { itemName: "Full Restore", cost: 80, quantity: 3 },
  { itemName: "Max Elixir", cost: 100, quantity: 2 },
  { itemName: "Rare Candy", cost: 150, quantity: 1 },
] as const;

export function factoryExchangeEntry(itemName: string): FactoryExchangeEntry | null {
  return FACTORY_EXCHANGE.find((entry) => entry.itemName === itemName) ?? null;
}

/** Con cuántos puntos alcanza para al menos un canje — habilita el panel. */
export function canAffordAnyExchange(points: number): boolean {
  return FACTORY_EXCHANGE.some((entry) => points >= entry.cost);
}
