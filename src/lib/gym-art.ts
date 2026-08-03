import { showdownTypeSymbolUrl } from "@/lib/type-icons";
import { showdownTrainerSpriteUrl } from "@/lib/avatars";

// Medallas: arte local en public/gyms/badges/ (Showdown no tiene gym badges).
//
// Líderes — dos resoluciones, mismo criterio Kanto/Johto:
// - `leaders/` → sprites pixel Showdown (listas / UI compacta)
// - `portraits/` → arte oficial Bulbagarden Archives
//     Kanto: Lets_Go_Pikachu_Eevee_{Name}.png
//     Johto: HeartGold_SoulSilver_{Name}.png
//
// Slugs no son derivables del display name ("Lt. Surge" → "ltsurge").
const LEADER_SLUGS: Record<string, string> = {
  Brock: "brock",
  Misty: "misty",
  "Lt. Surge": "ltsurge",
  Erika: "erika",
  Koga: "koga",
  Sabrina: "sabrina",
  Blaine: "blaine",
  Giovanni: "giovanni",
  // Alto Mando + Campeón (Kanto)
  Lorelei: "lorelei",
  Bruno: "bruno",
  Agatha: "agatha",
  Lance: "lance",
  Blue: "blue",
  // Johto
  Falkner: "falkner",
  Bugsy: "bugsy",
  Whitney: "whitney",
  Morty: "morty",
  Chuck: "chuck",
  Jasmine: "jasmine",
  Pryce: "pryce",
  Clair: "clair",
  Will: "will",
  Karen: "karen",
};

/** Líderes con PNG local en `public/gyms/leaders/` (y portraits cuando aplica). */
const LOCAL_LEADER_SLUGS = new Set([
  "brock",
  "misty",
  "ltsurge",
  "erika",
  "koga",
  "sabrina",
  "blaine",
  "giovanni",
  // Johto — portraits HGSS + leaders Showdown (mismo esquema que Kanto)
  "falkner",
  "bugsy",
  "whitney",
  "morty",
  "chuck",
  "jasmine",
  "pryce",
  "clair",
  "will",
  "karen",
]);

/**
 * Alto Mando / Campeón: cuerpo completo desde el catálogo de avatares (`*2`),
 * en vez del sprite pixel de Showdown / `gyms/leaders`.
 */
const LEADER_AVATAR_BODY_SLUG: Partial<Record<string, string>> = {
  Lorelei: "lorelei",
  Bruno: "brunoaltomando",
  Agatha: "agatha",
  Lance: "lance",
  Blue: "gary",
};

/** Tipos con PNG local en `public/gyms/badges/` (Kanto + Johto). */
const LOCAL_BADGE_TYPES = new Set([
  // Kanto
  "rock",
  "water",
  "electric",
  "grass",
  "poison",
  "psychic",
  "fire",
  "ground",
  // Johto
  "flying",
  "bug",
  "normal",
  "ghost",
  "fighting",
  "steel",
  "ice",
  "dragon",
]);

export function gymBadgeImageUrl(type: string): string {
  const key = type.trim().toLowerCase();
  if (LOCAL_BADGE_TYPES.has(key)) {
    return `/gyms/badges/${key}.png`;
  }
  return showdownTypeSymbolUrl(key);
}

/** Sprite — cards, listas, UI chica. Prefiere avatar *2 (Alto Mando), luego leaders locales, luego CDN. */
export function gymLeaderImageUrl(leaderName: string): string | null {
  const avatarSlug = LEADER_AVATAR_BODY_SLUG[leaderName];
  if (avatarSlug) {
    return `/avatars/${avatarSlug}2.png`;
  }
  const slug = LEADER_SLUGS[leaderName];
  if (!slug) return null;
  if (LOCAL_LEADER_SLUGS.has(slug)) {
    return `/gyms/leaders/${slug}.png`;
  }
  return showdownTrainerSpriteUrl(slug);
}

/** Retrato grande — detalle de gimnasio / pantallas hero. */
export function gymLeaderPortraitUrl(leaderName: string): string | null {
  const avatarSlug = LEADER_AVATAR_BODY_SLUG[leaderName];
  if (avatarSlug) {
    return `/avatars/${avatarSlug}2.png`;
  }
  const slug = LEADER_SLUGS[leaderName];
  if (!slug) return null;
  if (LOCAL_LEADER_SLUGS.has(slug)) {
    // Retrato HQ Bulbagarden (LGPE Kanto / HGSS Johto).
    return `/gyms/portraits/${slug}.png`;
  }
  return showdownTrainerSpriteUrl(slug);
}

/** Sprite genérico de entrenador del gimnasio (pre-líder). */
const GYM_TRAINER_SPRITE: Record<string, string> = {
  rock: "hiker",
  water: "swimmer",
  electric: "gentleman",
  grass: "picnicker",
  poison: "ninja",
  psychic: "psychic",
  fire: "blackbelt",
  ground: "worker",
  flying: "birdkeeper",
  bug: "bugcatcher",
  normal: "lass",
  ghost: "medium",
  fighting: "blackbelt",
  steel: "gentleman",
  ice: "skier",
  dragon: "cooltrainer",
};

export function gymTypeTrainerSpriteSlug(gymType: string): string {
  return GYM_TRAINER_SPRITE[gymType] ?? "pokemontrainer";
}

/** Dificultad visual 1–5 a partir del orden del gimnasio (1..badgeTarget). */
export function gymDifficultyStars(order: number, badgeTarget = 8): number {
  const denom = Math.max(1, badgeTarget);
  return Math.min(5, Math.max(1, Math.ceil((order * 5) / denom)));
}
