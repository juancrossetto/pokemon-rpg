const ITEM_SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items";

/** Convierte el nombre del ítem (seed) al slug kebab-case del CDN de PokeAPI. */
export function itemSpriteSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

/** URL del sprite de ítem en el CDN de PokeAPI/sprites. */
export function itemSpriteUrl(name: string): string {
  return `${ITEM_SPRITE_BASE}/${itemSpriteSlug(name)}.png`;
}
