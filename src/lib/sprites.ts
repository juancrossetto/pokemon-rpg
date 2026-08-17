import { spriteFor } from "@/lib/shiny";

/**
 * Sprites de UI vs batalla.
 *
 * UI (home squad, ranking, parque…): official-artwork de PokeAPI — el mismo
 * CDN que producción. Común: `.../official-artwork/{id}.png`. Shiny:
 * `.../official-artwork/shiny/{id}.png`. Next las sirve con `/_next/image`.
 * Batalla: GIFs Showdown `ani`.
 */

const OFFICIAL_ARTWORK_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";

/** Extrae el dex # de una URL de sprite PokeAPI / safari conocida. */
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

export function officialArtworkUrl(speciesId: number, shiny = false): string {
  return shiny
    ? `${OFFICIAL_ARTWORK_BASE}/shiny/${speciesId}.png`
    : `${OFFICIAL_ARTWORK_BASE}/${speciesId}.png`;
}

/** Sprite de UI 2D por dex id (mismo CDN que prod). */
export function uiSpriteById(speciesId: number, shiny = false): string {
  if (!Number.isFinite(speciesId) || speciesId <= 0) {
    return officialArtworkUrl(0, shiny);
  }
  return officialArtworkUrl(speciesId, shiny);
}

/**
 * Sprite de UI a partir de la URL guardada en DB.
 * Reescribe HOME / pixel a official-artwork, y aplica `/shiny/` si corresponde.
 */
export function uiSpriteUrl(spriteUrl: string, isShiny = false): string {
  const id = speciesIdFromSpriteUrl(spriteUrl);
  const shiny = isShiny || isShinySpriteUrl(spriteUrl);
  if (id == null) return spriteFor(spriteUrl, shiny);
  return officialArtworkUrl(id, shiny);
}

export function homeSpriteById(id: number, shiny = false): string {
  return officialArtworkUrl(id, shiny);
}

function retrySpriteUrl(spriteUrl: string): string {
  if (!/^https?:\/\//i.test(spriteUrl)) return spriteUrl;
  try {
    const url = new URL(spriteUrl);
    url.searchParams.set("retry", "1");
    return url.toString();
  } catch {
    return spriteUrl;
  }
}

function isLocalSrc(src: string): boolean {
  return !/^https?:\/\//i.test(src);
}

/**
 * Fuentes de UI: official-artwork (común y shiny, mismo CDN que prod).
 * Sin pixel clásico, HOME 3D, pokemon.com ni GIF de Showdown.
 */
export function pokemonSpriteCandidates({
  src,
  speciesId,
  isShiny = false,
}: {
  src?: string | null;
  speciesId?: number | null;
  speciesName?: string | null;
  isShiny?: boolean;
}): string[] {
  const inferredId = speciesId ?? (src ? speciesIdFromSpriteUrl(src) : null);
  const shiny = isShiny || (!!src && isShinySpriteUrl(src));
  const candidates: string[] = [];
  const add = (value: string | null | undefined) => {
    if (value && !candidates.includes(value)) candidates.push(value);
  };

  if (src && isLocalSrc(src)) add(src);

  const preferred = src && !isLocalSrc(src)
    ? spriteFor(src, shiny)
    : inferredId && inferredId > 0
      ? officialArtworkUrl(inferredId, shiny)
      : null;

  add(preferred);
  if (preferred) add(retrySpriteUrl(preferred));

  if (inferredId && inferredId > 0) {
    add(officialArtworkUrl(inferredId, shiny));
  }

  return candidates;
}
