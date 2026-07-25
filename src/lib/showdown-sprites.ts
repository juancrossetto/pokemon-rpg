/**
 * Sprites de batalla de Pokémon Showdown.
 *
 * Por defecto apunta al CDN público. Para espejar en prod sin tocar callers:
 *   NEXT_PUBLIC_SHOWDOWN_SPRITES_BASE=/showdown-sprites
 * y copiá ani/ + ani-back/ a public/showdown-sprites/.
 *
 * Usamos ani / ani-back (GIFs HD del cliente moderno de Showdown).
 * @see https://play.pokemonshowdown.com/sprites/ani/
 */

const DEFAULT_BASE = "https://play.pokemonshowdown.com/sprites";

/** Nombres PokeAPI → slug Showdown (solo excepciones Gen I). */
const SLUG_ALIASES: Record<string, string> = {
  "nidoran-f": "nidoranf",
  "nidoran-m": "nidoranm",
  "mr-mime": "mrmime",
  "farfetchd": "farfetchd",
  "farfetch'd": "farfetchd",
};

export type SpriteFacing = "front" | "back";

export function showdownSpritesBase(): string {
  return (process.env.NEXT_PUBLIC_SHOWDOWN_SPRITES_BASE ?? DEFAULT_BASE).replace(/\/$/, "");
}

/** Normaliza el nombre de especie (PokeAPI / DB) al slug de Showdown. */
export function showdownSpeciesSlug(speciesName: string): string {
  const key = speciesName.trim().toLowerCase();
  if (SLUG_ALIASES[key]) return SLUG_ALIASES[key];
  return key.replace(/[^a-z0-9-]/g, "").replace(/-/g, "");
}

/**
 * GIF animado para el arena de batalla.
 * - front: rival / salvaje (ani)
 * - back: Pokémon del jugador (ani-back)
 */
export function battleAnimatedSpriteUrl(
  speciesName: string,
  facing: SpriteFacing,
  isShiny = false,
): string {
  const slug = showdownSpeciesSlug(speciesName);
  // Showdown separa las variocolor en ani-shiny / ani-back-shiny.
  const base = facing === "back" ? "ani-back" : "ani";
  const folder = isShiny ? `${base}-shiny` : base;
  return `${showdownSpritesBase()}/${folder}/${slug}.gif`;
}
