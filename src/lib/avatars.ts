import { showdownSpritesBase } from "@/lib/showdown-sprites";

export interface AvatarOption {
  id: string;
  /** Identificador de arte local en `/avatars/{slug}{1|2}.png`. */
  slug: string;
  /** Retrato compacto para picker, menú, ranking, amigos (`*1`). */
  src: string;
  /** Cuerpo completo para el hero del perfil (`*2`). */
  profileSrc: string;
  /**
   * Mismo cuerpo completo pero recortado al bounding box opaco, para la escena
   * del perfil. El arte original mezcla encuadres —unos ajustados, otros
   * centrados en un lienzo cuadrado con 60–70% de transparencia— y la escena
   * dimensiona por altura, así que sin recortar el personaje queda diminuto y
   * flotando sobre la línea de piso. Lo genera `scripts/build-avatar-stage.mjs`.
   */
  stageSrc: string;
}

/**
 * Catálogo curado de avatares propios.
 *
 * - `*1` → selección / chips / header
 * - `*2` → escena del perfil (antes CDN Showdown trainers)
 *
 * El `id` coincide con el slug (estable). Los ids viejos `trainer-N` del
 * catálogo Showdown se resuelven en `avatarById` vía mapa legacy.
 */
const AVATAR_SLUGS = [
  "aristocrata",
  "campista",
  "cazabichos",
  "chica",
  "chicaa",
  "chicamala",
  "cientifico",
  "criadora",
  "damisela",
  "domadragon",
  "entrenadoraguay",
  "entrenadorguay",
  "escolar",
  "escolara",
  "evemaster",
  "gemelas",
  "joven",
  "jovenn",
  "karate",
  "marinero",
  "medium",
  "model",
  "montanista",
  "nadador",
  "nadadora",
  "ninobien",
  "operario",
  "playera",
  "playero",
  "pokechico",
  "pokefan",
  "pokemaniaco",
  "ranger",
  "rangerfemenina",
  "rangermasculino",
  "ruinamaniaco",
  "surfista",
  "veterana",
  "veterano",
  "viejo",
] as const;

/** Sprites de NPCs/gimnasios/torre siguen en Showdown. */
export function showdownTrainerSpriteUrl(slug: string): string {
  return `${showdownSpritesBase()}/trainers/${slug}.png`;
}

function localAvatarUrl(slug: string, variant: 1 | 2): string {
  return `/avatars/${slug}${variant}.png`;
}

export const AVATAR_OPTIONS: AvatarOption[] = AVATAR_SLUGS.map((slug) => ({
  id: slug,
  slug,
  src: localAvatarUrl(slug, 1),
  profileSrc: localAvatarUrl(slug, 2),
  stageSrc: `/avatars/stage/${slug}.png`,
}));

/**
 * Mapa de slugs Showdown → slug local, para cuentas que eligieron avatar
 * antes del catálogo propio.
 */
const LEGACY_SHOWDOWN_TO_LOCAL: Record<string, (typeof AVATAR_SLUGS)[number]> = {
  youngster: "joven",
  lass: "jovenn",
  backpacker: "ranger",
  backpackerf: "rangerfemenina",
  picnicker: "campista",
  hiker: "montanista",
  swimmer: "nadador",
  swimmerf: "nadadora",
  gentleman: "aristocrata",
  bugcatcher: "cazabichos",
  twins: "gemelas",
  blackbelt: "karate",
  medium: "medium",
  richboy: "ninobien",
  pokemaniac: "pokemaniaco",
  ruinmaniac: "ruinamaniaco",
  veteran: "viejo",
  sailor: "marinero",
};

/** Orden histórico del catálogo Showdown (sólo para resolver ids `trainer-N`). */
const LEGACY_SHOWDOWN_SLUGS = [
  "youngster",
  "lass",
  "acetrainer",
  "backpacker",
  "acetrainerf",
  "backpackerf",
  "bugcatcher",
  "beauty",
  "biker",
  "birdkeeper",
  "blackbelt",
  "medium",
  "fisherman",
  "gentleman",
  "hiker",
  "picnicker",
  "pokemaniac",
  "psychic",
  "psychicf",
  "punkgirl",
  "punkguy",
  "scientist",
  "scientistf",
  "supernerd",
  "swimmer",
  "swimmerf",
  "roughneck",
  "twins",
  "veteran",
  "veteranf",
  "waiter",
  "waitress",
  "worker",
  "pokemonbreeder",
  "pokemonbreederf",
  "schoolkid",
  "schoolkidf",
  "richboy",
  "lady",
  "parasollady",
  "ninjaboy",
  "collector",
  "ruinmaniac",
  "guitarist",
  "cameraman",
  "reporter",
  "idol",
  "clerk",
  "clerkf",
  "officeworker",
  "policeman",
  "janitor",
  "chef",
  "baker",
  "nurse",
  "doctor",
  "delinquent",
  "streetthug",
  "preschooler",
  "preschoolerf",
  "risingstar",
  "risingstarf",
] as const;

export function avatarById(id: string | null | undefined): AvatarOption | null {
  if (!id) return null;
  const direct = AVATAR_OPTIONS.find((a) => a.id === id);
  if (direct) return direct;

  const match = /^trainer-(\d+)$/.exec(id);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  if (index < 0 || index >= LEGACY_SHOWDOWN_SLUGS.length) return null;
  const oldSlug = LEGACY_SHOWDOWN_SLUGS[index];
  const localSlug = LEGACY_SHOWDOWN_TO_LOCAL[oldSlug];
  if (!localSlug) return null;
  return AVATAR_OPTIONS.find((a) => a.slug === localSlug) ?? null;
}
