import { WONDER_TRADE_ENERGY_COST } from "@/lib/energy";
import { speciesRarity } from "@/lib/campaign/rarity";
import { isLegendarySpecies, PSEUDO_IDS, STARTER_IDS } from "@/lib/pokedex";

/**
 * El trueque abre después de la primera medalla: antes es un atajo a
 * especies que la campaña todavía no soltó.
 */
export const WONDER_MIN_BADGES = 1;

export function isWonderUnlocked(badgeCount: number): boolean {
  return badgeCount >= WONDER_MIN_BADGES;
}

/** 0 basura · 1 media / poco común · 2 final de línea · 3 shiny, starter final, pseudo, legendario. */
export type WonderTier = 0 | 1 | 2 | 3;

export type WonderSpeciesSnap = {
  speciesId: number;
  evolvesFromId: number | null;
  evolvesToCount: number;
  isShiny?: boolean;
};

export function toWonderSnap(row: {
  isShiny: boolean;
  species: { id: number; evolvesFromId: number | null; evolvesTo: { id: number }[] };
}): WonderSpeciesSnap {
  return {
    speciesId: row.species.id,
    evolvesFromId: row.species.evolvesFromId,
    evolvesToCount: row.species.evolvesTo.length,
    isShiny: row.isShiny,
  };
}

export function wonderEvoStage(snap: WonderSpeciesSnap): 0 | 1 | 2 {
  if (snap.evolvesFromId == null) return 0;
  if (snap.evolvesToCount > 0) return 1;
  return 2;
}

/**
 * Lo que vale un ejemplar en el portal. Magikarp y Charizard no se cruzan:
 * el científico y la cola sólo emparejan el mismo peldaño.
 */
export function wonderTradeTier(snap: WonderSpeciesSnap): WonderTier {
  if (snap.isShiny || isLegendarySpecies(snap.speciesId) || PSEUDO_IDS.has(snap.speciesId)) {
    return 3;
  }
  const rarity = speciesRarity(snap.speciesId);
  if (rarity === "elite" || rarity === "veryRare") return 3;
  const stage = wonderEvoStage(snap);
  if (STARTER_IDS.has(snap.speciesId)) {
    if (stage >= 2) return 3;
    if (stage === 1) return 2;
    return 1;
  }
  if (rarity === "rare") return stage >= 2 ? 2 : 1;
  if (stage >= 2) return 2;
  if (stage === 1 || rarity === "uncommon") return 1;
  return 0;
}

export function wonderTiersMatch(offered: WonderTier, incoming: WonderTier): boolean {
  return offered === incoming;
}

export function wonderNpcAllowed(tier: WonderTier): boolean {
  return tier < 3;
}

/**
 * Reserva del científico, por peldaño. Nunca legendarios, starters finales
 * ni pseudos: un catch de ruta no puede devolver uno de esos.
 */
export const WONDER_NPC_POOL_BY_TIER: Record<0 | 1 | 2, readonly number[]> = {
  0: [10, 13, 16, 19, 21, 23, 27, 29, 32, 41, 43, 46, 48, 50, 52, 60, 69, 74, 79, 98, 116, 118, 129],
  1: [11, 14, 17, 20, 22, 42, 44, 47, 49, 51, 53, 61, 70, 75, 80],
  2: [12, 15, 18, 24, 28, 73, 85, 99, 119, 121],
};

/** @deprecated usar WONDER_NPC_POOL_BY_TIER; se deja como alias del peldaño 0. */
export const WONDER_NPC_POOL = WONDER_NPC_POOL_BY_TIER[0];

/** Lo que el laboratorio muestra al cerrar un trueque. */
export type WonderReceipt = {
  name: string;
  speciesName: string;
  speciesId: number;
  level: number;
  isShiny: boolean;
};

export function wonderNpcSpecies(tier: WonderTier, roll: number): number {
  const poolTier: 0 | 1 | 2 = tier === 0 || tier === 1 ? tier : 2;
  const pool = WONDER_NPC_POOL_BY_TIER[poolTier];
  const index = Math.floor(Math.max(0, Math.min(0.999999, roll)) * pool.length);
  return pool[index]!;
}

/** El laboratorio nunca sube de nivel: como mucho iguala lo que mandaste. */
export function wonderNpcLevel(offeredLevel: number, roll: number): number {
  const jitter = Math.floor(roll * 3) - 2;
  return Math.max(5, Math.min(offeredLevel, offeredLevel + jitter));
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
