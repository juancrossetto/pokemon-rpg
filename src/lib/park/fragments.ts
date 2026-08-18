/**
 * Fragmentos de especie para recompensas del Parque.
 *
 * Un minijuego que entrega Pokémon completo (pesca, fósil) salta el lazo de
 * captura. Para que no sea un atajo, cada hallazgo suma fragmentos; a los
 * `FRAGMENTS_TO_ASSEMBLE` se arma una instancia de verdad.
 *
 * La captura salvaje, el safari y el trueque no pasan por acá: ahí el Pokémon
 * ya es una unidad de colección/combate, no un premio de arcade.
 */

import { FISHING_TABLE } from "@/lib/park/fishing";

export const FRAGMENTS_TO_ASSEMBLE = 10;

export const FISHING_FRAGMENT_YIELD = {
  common: 1,
  uncommon: 2,
  rare: 5,
} as const;

export type FragmentRarity = keyof typeof FISHING_FRAGMENT_YIELD;

/**
 * Nivel del Pokémon recién armado. Los fragmentos no tienen nivel: al juntar
 * 10 sale uno chico, no uno a la altura del lead (~50) que convertiría el
 * minijuego en un atajo.
 */
export const ASSEMBLED_LEVEL = {
  common: 5,
  uncommon: 8,
  rare: 12,
  fossil: 10,
} as const;

export type AssembleKind = keyof typeof ASSEMBLED_LEVEL;

export function assembledPokemonLevel(kind: AssembleKind): number {
  return ASSEMBLED_LEVEL[kind];
}

const FOSSIL_FRAGMENT_SPECIES = new Set([138, 140, 142]);

/** Nivel al armar, según la tabla de pesca o si es fósil de la mina. */
export function assembledPokemonLevelForSpecies(speciesId: number): number {
  const fish = FISHING_TABLE.find((row) => row.speciesId === speciesId);
  if (fish) return assembledPokemonLevel(fish.rarity);
  if (FOSSIL_FRAGMENT_SPECIES.has(speciesId)) return assembledPokemonLevel("fossil");
  return assembledPokemonLevel("common");
}

/**
 * Suma fragmentos y, si `assemble` es true, convierte cada múltiplo de
 * `need` en un Pokémon listo. La mina no ensambla sola: el jugador revive.
 */
export function addTowardAssemble(
  current: number,
  gained: number,
  need: number = FRAGMENTS_TO_ASSEMBLE,
  assemble = true,
): { quantity: number; assembled: number } {
  const safeCurrent = Math.max(0, Math.floor(current));
  const safeGained = Math.max(0, Math.floor(gained));
  const total = safeCurrent + safeGained;
  if (!assemble || need <= 0) return { quantity: total, assembled: 0 };
  const assembled = Math.floor(total / need);
  return { quantity: total - assembled * need, assembled };
}
