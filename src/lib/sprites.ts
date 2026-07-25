/**
 * Sprites de UI vs batalla.
 *
 * - UI (Pokédex, equipo, mercado…): renders 3D de Pokémon HOME — tienen
 *   volumen, rim light y sombras. Se ven “dentro” de un ambiente.
 * - Batalla: GIFs Showdown (ver `showdown-sprites.ts`).
 * - Persistimos `official-artwork` en DB por compatibilidad; al mostrar en UI
 *   resolvemos a HOME.
 */

const HOME_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home";

/** Extrae el dex # de una URL de sprite PokeAPI conocida. */
export function speciesIdFromSpriteUrl(spriteUrl: string): number | null {
  if (!spriteUrl) return null;
  const m = spriteUrl.match(/\/(\d+)\.png(?:\?.*)?$/i);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function isShinySpriteUrl(spriteUrl: string): boolean {
  return /\/shiny\//i.test(spriteUrl);
}

/**
 * Render HOME (3D). Si no se puede inferir el id, devuelve la URL original.
 */
export function homeSpriteUrl(spriteUrl: string, shiny = false): string {
  const id = speciesIdFromSpriteUrl(spriteUrl);
  if (id == null) return spriteUrl;
  const useShiny = shiny || isShinySpriteUrl(spriteUrl);
  return useShiny ? `${HOME_BASE}/shiny/${id}.png` : `${HOME_BASE}/${id}.png`;
}

/**
 * Sprite para superficies de UI (cards, ranking, PC…). Preferí HOME.
 */
export function uiSpriteUrl(spriteUrl: string, isShiny = false): string {
  return homeSpriteUrl(spriteUrl, isShiny);
}
