import { showdownStaticSpriteUrl } from "@/lib/showdown-sprites";
import { spriteFor } from "@/lib/shiny";

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
 * Sprite HOME por dex/form id de PokeAPI (sin fila en nuestra DB).
 * Sirve para previews de formas regionales u especies aún no sembradas.
 */
export function homeSpriteById(id: number, shiny = false): string {
  if (!Number.isFinite(id) || id <= 0) return `${HOME_BASE}/0.png`;
  return shiny ? `${HOME_BASE}/shiny/${id}.png` : `${HOME_BASE}/${id}.png`;
}

/**
 * Sprite para superficies de UI (cards, ranking, PC…). Preferí HOME.
 */
export function uiSpriteUrl(spriteUrl: string, isShiny = false): string {
  return homeSpriteUrl(spriteUrl, isShiny);
}

const DEFAULT_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const OFFICIAL_ARTWORK_BASE =
  `${DEFAULT_BASE}/other/official-artwork`;

/**
 * Sprite "común" de PokeAPI (`sprites/pokemon/{id}.png`): el clásico, plano y
 * chico. Para listas donde el render HOME —volumétrico, con luz de estudio— pesa
 * demasiado y cada miembro compite con el héroe de la pantalla.
 */
export function defaultSpriteUrl(spriteUrl: string, shiny = false): string {
  const id = speciesIdFromSpriteUrl(spriteUrl);
  if (id == null) return spriteUrl;
  const useShiny = shiny || isShinySpriteUrl(spriteUrl);
  return useShiny ? `${DEFAULT_BASE}/shiny/${id}.png` : `${DEFAULT_BASE}/${id}.png`;
}

/** Agrega un marcador estable para forzar un segundo intento HTTP. */
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

/**
 * Fuentes ordenadas para un sprite de UI robusto:
 * fuente original → reintento → artwork → sprite clásico → CDN Showdown.
 *
 * La fuente original siempre conserva su familia visual. Los fallbacks sólo
 * entran en juego después de que esa imagen falle realmente.
 *
 * La función es pura para poder reutilizarla desde componentes cliente sin
 * arrastrar Prisma al bundle y para verificar el orden con tests unitarios.
 */
export function pokemonSpriteCandidates({
  src,
  speciesId,
  speciesName,
  isShiny = false,
}: {
  src?: string | null;
  speciesId?: number | null;
  speciesName?: string | null;
  isShiny?: boolean;
}): string[] {
  const inferredId = speciesId ?? (src ? speciesIdFromSpriteUrl(src) : null);
  const candidates: string[] = [];
  const add = (value: string | null | undefined) => {
    if (value && !candidates.includes(value)) candidates.push(value);
  };

  const preferred = src
    ? spriteFor(src, isShiny)
    : inferredId
      ? isShiny
        ? `${OFFICIAL_ARTWORK_BASE}/shiny/${inferredId}.png`
        : `${OFFICIAL_ARTWORK_BASE}/${inferredId}.png`
      : null;

  add(preferred);
  if (preferred) add(retrySpriteUrl(preferred));

  if (inferredId) {
    add(isShiny
      ? `${OFFICIAL_ARTWORK_BASE}/shiny/${inferredId}.png`
      : `${OFFICIAL_ARTWORK_BASE}/${inferredId}.png`);
    add(isShiny
      ? `${DEFAULT_BASE}/shiny/${inferredId}.png`
      : `${DEFAULT_BASE}/${inferredId}.png`);
  }

  if (src && !inferredId) add(src);
  if (speciesName) add(showdownStaticSpriteUrl(speciesName, isShiny));

  return candidates;
}
