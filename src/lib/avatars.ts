import { showdownSpritesBase } from "@/lib/showdown-sprites";

export interface AvatarOption {
  id: string;
  /** Slug en el CDN de Showdown (`sprites/trainers/{slug}.png`). */
  slug: string;
  src: string;
}

/**
 * Catálogo curado de avatares = clases de entrenador genéricas de Showdown
 * (sin líderes/campeones). Hay cientos más en:
 * https://play.pokemonshowdown.com/sprites/trainers/
 *
 * Los primeros 4 ids (`trainer-1`…`4`) se mantienen estables por cuentas ya registradas.
 * En prod conviene espejar con `NEXT_PUBLIC_SHOWDOWN_SPRITES_BASE`.
 */
const AVATAR_SLUGS = [
  // Estables (no reordenar)
  "youngster",
  "lass",
  "acetrainer",
  "backpacker",
  // Ampliación
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

export function showdownTrainerSpriteUrl(slug: string): string {
  return `${showdownSpritesBase()}/trainers/${slug}.png`;
}

export const AVATAR_OPTIONS: AvatarOption[] = AVATAR_SLUGS.map((slug, index) => ({
  id: `trainer-${index + 1}`,
  slug,
  src: showdownTrainerSpriteUrl(slug),
}));

export function avatarById(id: string | null | undefined): AvatarOption | null {
  return AVATAR_OPTIONS.find((a) => a.id === id) ?? null;
}
