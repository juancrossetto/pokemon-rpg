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
  "agatha",
  "alana",
  "alanab",
  "anton",
  "antonb",
  "ariana",
  "arianaa",
  "ash",
  "aura",
  "aurab",
  "aurac",
  "aurad",
  "azul",
  "azula",
  "azulb",
  "azulc",
  "blaine",
  "blaineb",
  "brock",
  "brockk",
  "bruno",
  "brunoaltomando",
  "brunob",
  "brunoc",
  "brunod",
  "camila",
  "camilaa",
  "camilab",
  "campista",
  "candela",
  "candelab",
  "cazabichos",
  "chase",
  "cheren",
  "cherenb",
  "chica",
  "chicaa",
  "chicamala",
  "cientifico",
  "cintia",
  "cintiaa",
  "criadora",
  "damisela",
  "delos",
  "edel",
  "entrenadoraguay",
  "entrenadorguay",
  "evemaster",
  "fero",
  "feroa",
  "francine",
  "fredo",
  "gladio",
  "gladiob",
  "hiedra",
  "hiedrab",
  "hiedrac",
  "hugo",
  "james",
  "jessie",
  "joven",
  "junco",
  "juncob",
  "kalm",
  "kalma",
  "karate",
  "koga",
  "lance",
  "lanceb",
  "lectro",
  "lem",
  "leti",
  "letib",
  "lira",
  "liraa",
  "lirab",
  "lorelei",
  "lucho",
  "luchoa",
  "luchob",
  "mananti",
  "marcial",
  "marcialb",
  "maximo",
  "maximob",
  "mist",
  "misty",
  "mistyy",
  "mistyyy",
  "model",
  "montanista",
  "morti",
  "mortib",
  "mortic",
  "motorista",
  "n",
  "na",
  "naboru",
  "nadador",
  "nadadora",
  "nanci",
  "nancia",
  "nb",
  "nc",
  "nerio",
  "oak",
  "pegaso",
  "petra",
  "petraa",
  "pokechico",
  "pokefan",
  "pokemaniaco",
  "ranger",
  "reclutarocket",
  "reclutarocketf",
  "rojo",
  "rojoa",
  "rojob",
  "rojoc",
  "roy",
  "royb",
  "royc",
  "sabrina",
  "sabrinab",
  "sabrinac",
  "sabrinad",
  "sachiko",
  "serena",
  "serenab",
  "supernerd",
  "surfista",
  "veterana",
  "veterano",
  "vito",
  "vitob",
  "yakon",
] as const;

/**
 * Arte histórico de clase que sigue disponible para resolver avatares de
 * cuentas viejas, pero no entra al picker ni a los desbloqueos del jugador.
 * Los NPCs del juego usan el set uniforme de `public/trainers/adventure`.
 */
export const AVATAR_ADVENTURE_ONLY_SLUGS = [
  "cazabichos",
  "chicaa",
  "criadora",
  "damisela",
  "hugo",
  "motorista",
  "pokemaniaco",
  "supernerd",
] as const;

const ADVENTURE_ONLY_SET = new Set<string>(AVATAR_ADVENTURE_ONLY_SLUGS);

export function isAdventureOnlyAvatar(slug: string): boolean {
  return ADVENTURE_ONLY_SET.has(slug);
}

/** Fallback para NPCs que todavía no tengan arte local curado. */
export function showdownTrainerSpriteUrl(slug: string): string {
  return `${showdownSpritesBase()}/trainers/${slug}.png`;
}

/**
 * Clases de entrenador con sprite local 80×80 de cuarta generación.
 * Mantener esta lista en paridad con `public/trainers/adventure`.
 */
const ADVENTURE_TRAINER_SPRITES = new Set([
  "backpacker",
  "beauty",
  "biker",
  "birdkeeper",
  "birdkeeperf",
  "blackbelt",
  "bugcatcher",
  "camper",
  "dragontamer",
  "fisherman",
  "gambler",
  "gentleman",
  "hiker",
  "lady",
  "lass",
  "medium",
  "ninjaboy",
  "picnicker",
  "pokemaniac",
  "pokemonbreeder",
  "pokemonbreederf",
  "psychic",
  "psychicf",
  "rocketgrunt",
  "sailor",
  "scientist",
  "skier",
  "skierf",
  "supernerd",
  "swimmer",
  "swimmerf",
  "worker",
  "youngster",
]);

function normalizeNpcTrainerSlug(slug: string): string {
  return slug.toLowerCase().replace(/[-_]/g, "");
}

export function isNpcTrainerPixelPortraitUrl(url: string | null | undefined): boolean {
  return Boolean(
    url?.includes("/trainers/adventure/") ||
      (url?.startsWith("http") && url.includes("/trainers/")),
  );
}

/**
 * Retrato de NPC de clase (entrenadores de ruta, etc.).
 * Usa una única familia pixel-art local de 80×80 para que aventura, pasillos
 * e intro de batalla compartan encuadre, escala y definición.
 */
export function npcTrainerPortraitUrl(
  showdownSlug: string,
  variant: "thumb" | "profile" = "profile",
): string {
  const key = normalizeNpcTrainerSlug(showdownSlug);
  if (ADVENTURE_TRAINER_SPRITES.has(key)) {
    return variant === "thumb"
      ? `/trainers/portraits/thumbs/${key}.png`
      : `/trainers/portraits/${key}.png`;
  }
  return showdownTrainerSpriteUrl(showdownSlug);
}

/** Retrato horizontal que se integra como arte ambiental dentro de una card. */
export function npcTrainerCardPortraitUrl(showdownSlug: string): string | null {
  const key = normalizeNpcTrainerSlug(showdownSlug);
  return ADVENTURE_TRAINER_SPRITES.has(key)
    ? `/trainers/portraits/${key}.png`
    : null;
}

/**
 * La intro VS reutiliza exactamente el mismo sprite que el pasillo. Evita que
 * el entrenador cambie de generación, pose o proporción al iniciar el combate.
 */
export function npcTrainerVsPortraitUrl(showdownSlug: string): string {
  return npcTrainerPortraitUrl(showdownSlug, "profile");
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
 * Fade + velo en la base del stage en **perfil** (escena centrada).
 * Se aplica a todos: en los cortados tapa el borde duro; en los completos
 * apenas disuelve la zona de los pies y se integra con la sombra de piso.
 */
export function avatarStageSoftFeet(avatarId: string | null | undefined): boolean {
  return Boolean(avatarId);
}

const AVATAR_SLUG_SET = new Set<string>(AVATAR_SLUGS);

/**
 * Nombre legible del retrato (slug → "Ariana A", "Rojo", "N B").
 * Las variantes de una letra se detectan si el resto también es un slug del catálogo.
 */
export function avatarDisplayName(slug: string | null | undefined): string {
  if (!slug) return "";
  if (slug.length > 1) {
    const letter = slug.slice(-1);
    const root = slug.slice(0, -1);
    if (/^[a-d]$/i.test(letter) && AVATAR_SLUG_SET.has(root)) {
      return `${capitalizeAvatar(root)} ${letter.toUpperCase()}`;
    }
  }
  return capitalizeAvatar(slug);
}

function capitalizeAvatar(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/**
 * Mapa de slugs Showdown → slug local, para cuentas que eligieron avatar
 * antes del catálogo propio.
 */
const LEGACY_SHOWDOWN_TO_LOCAL: Record<string, (typeof AVATAR_SLUGS)[number]> = {
  youngster: "joven",
  lass: "chica",
  backpacker: "ranger",
  backpackerf: "ranger",
  picnicker: "campista",
  camper: "campista",
  hiker: "montanista",
  swimmer: "nadador",
  swimmerf: "nadadora",
  gentleman: "entrenadorguay",
  bugcatcher: "cazabichos",
  twins: "chica",
  blackbelt: "karate",
  medium: "leti",
  richboy: "joven",
  pokemaniac: "pokemaniaco",
  ruinmaniac: "pokemaniaco",
  veteran: "veterano",
  veteranf: "veterana",
  sailor: "nadador",
  beauty: "damisela",
  biker: "motorista",
  fisherman: "nadador",
  gambler: "hugo",
  supernerd: "supernerd",
  scientist: "cientifico",
  scientistf: "cientifico",
  rocketgrunt: "reclutarocket",
  rocketgruntf: "reclutarocketf",
  schoolkid: "joven",
  schoolkidf: "chica",
  pokemonbreeder: "criadora",
  pokemonbreederf: "criadora",
  acetrainer: "entrenadorguay",
  acetrainerf: "entrenadoraguay",
  birdkeeper: "ranger",
  psychic: "leti",
  psychicf: "leti",
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

/**
 * Avatares locales retirados del catálogo: cuentas que todavía los tienen
 * guardados resuelven a un reemplazo cercano en vez de quedarse sin retrato.
 */
const RETIRED_LOCAL_TO_CURRENT: Record<string, (typeof AVATAR_SLUGS)[number]> = {
  escolar: "joven",
  escolara: "chica",
  gemelas: "chica",
  playera: "surfista",
  playero: "surfista",
  viejo: "veterano",
  rangerfemenina: "ranger",
  rangermasculino: "ranger",
  operario: "montanista",
  jovenn: "chica",
  gary: "ash",
  ninobien: "joven",
  medium: "leti",
  aristocrata: "entrenadorguay",
  ruinamaniaco: "pokemaniaco",
  marinero: "nadador",
};

export function avatarById(id: string | null | undefined): AvatarOption | null {
  if (!id) return null;
  const direct = AVATAR_OPTIONS.find((a) => a.id === id);
  if (direct) return direct;

  const retired = RETIRED_LOCAL_TO_CURRENT[id];
  if (retired) {
    return AVATAR_OPTIONS.find((a) => a.slug === retired) ?? null;
  }

  const match = /^trainer-(\d+)$/.exec(id);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  if (index < 0 || index >= LEGACY_SHOWDOWN_SLUGS.length) return null;
  const oldSlug = LEGACY_SHOWDOWN_SLUGS[index];
  const localSlug = LEGACY_SHOWDOWN_TO_LOCAL[oldSlug];
  if (!localSlug) return null;
  return AVATAR_OPTIONS.find((a) => a.slug === localSlug) ?? null;
}
