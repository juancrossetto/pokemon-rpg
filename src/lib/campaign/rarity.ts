/**
 * Rareza de especie en estado salvaje.
 *
 * El pedido original era una rareza por especie **y por zona** (~200 entradas a
 * mano). Modelarla como propiedad de la especie da el mismo resultado visible
 * con 1/5 del contenido: un Pikachu es raro donde sea que aparezca, y una zona
 * "tiene rarezas" si su tabla de spawns incluye especies raras. Si algún día
 * una especie necesita ser común en una zona y rara en otra, se agrega una
 * excepción por zona sin cambiar nada de lo demás.
 *
 * Los pesos alimentan `resolveSpawn`: cuanto más raro, menos aparece.
 */
export type Rarity = "common" | "uncommon" | "rare" | "veryRare" | "elite";

export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 100,
  uncommon: 45,
  rare: 14,
  veryRare: 4,
  elite: 1,
};

/** Orden para mostrar y para saber cuál es "la joya" de una zona. */
export const RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  veryRare: 3,
  elite: 4,
};

/**
 * Solo se listan las que no son comunes: el default es `common`, así que la
 * tabla queda corta y mantenible.
 */
const SPECIES_RARITY: Record<number, Rarity> = {
  // Poco comunes: evoluciones intermedias y bichos de zona específica
  12: "uncommon", // Butterfree
  15: "uncommon", // Beedrill
  17: "uncommon", // Pidgeotto
  20: "uncommon", // Raticate
  22: "uncommon", // Fearow
  24: "uncommon", // Arbok
  28: "uncommon", // Sandslash
  44: "uncommon", // Gloom
  47: "uncommon", // Parasect
  49: "uncommon", // Venomoth
  64: "uncommon", // Kadabra
  67: "uncommon", // Machoke
  75: "uncommon", // Graveler
  93: "uncommon", // Haunter
  105: "uncommon", // Marowak

  // Raras: las que el jugador cuenta como hallazgo
  25: "rare", // Pikachu
  35: "rare", // Clefairy
  37: "rare", // Vulpix
  58: "rare", // Growlithe
  63: "rare", // Abra
  95: "rare", // Onix
  111: "rare", // Rhyhorn
  114: "rare", // Tangela
  122: "rare", // Mr. Mime
  123: "rare", // Scyther
  127: "rare", // Pinsir

  // Muy raras
  26: "veryRare", // Raichu
  59: "veryRare", // Arcanine
  65: "veryRare", // Alakazam
  68: "veryRare", // Machamp
  113: "veryRare", // Chansey
  131: "veryRare", // Lapras
  132: "veryRare", // Ditto
  143: "veryRare", // Snorlax

  // Élite: legendarios
  144: "elite",
  145: "elite",
  146: "elite",
  150: "elite",
  151: "elite",
};

export function speciesRarity(speciesId: number): Rarity {
  return SPECIES_RARITY[speciesId] ?? "common";
}

export function speciesWeight(speciesId: number): number {
  return RARITY_WEIGHT[speciesRarity(speciesId)];
}

/** La rareza más alta de una lista — sirve para etiquetar una zona entera. */
export function topRarity(speciesIds: number[]): Rarity {
  return speciesIds.reduce<Rarity>((best, id) => {
    const r = speciesRarity(id);
    return RARITY_ORDER[r] > RARITY_ORDER[best] ? r : best;
  }, "common");
}

/** Elige una especie respetando los pesos de rareza. */
export function pickWeightedSpecies(speciesIds: number[]): number | null {
  if (speciesIds.length === 0) return null;
  const total = speciesIds.reduce((sum, id) => sum + speciesWeight(id), 0);
  let roll = Math.random() * total;
  for (const id of speciesIds) {
    roll -= speciesWeight(id);
    if (roll <= 0) return id;
  }
  return speciesIds[speciesIds.length - 1];
}
