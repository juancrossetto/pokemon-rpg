import { showdownTypeSymbolUrl } from "@/lib/type-icons";
import { showdownTrainerSpriteUrl } from "@/lib/avatars";

// Medallas: arte local en public/gyms/badges/ (Showdown no tiene gym badges).
//
// Líderes — dos resoluciones:
// - sprites Showdown (pixel) en public/gyms/leaders/ → listas / UI compacta
// - retratos oficiales (Bulbagarden) en public/gyms/portraits/ → detalle de gym
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
};

/** Líderes con PNG local en `public/gyms/leaders/`. El resto usa CDN Showdown. */
const LOCAL_LEADER_SLUGS = new Set([
  "brock",
  "misty",
  "ltsurge",
  "erika",
  "koga",
  "sabrina",
  "blaine",
  "giovanni",
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

/** Tipos con PNG local en `public/gyms/badges/`. El resto (Elite / sellos) cae al ícono de tipo. */
const LOCAL_BADGE_TYPES = new Set([
  "rock",
  "water",
  "electric",
  "grass",
  "poison",
  "psychic",
  "fire",
  "ground",
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
};

export function gymTypeTrainerSpriteSlug(gymType: string): string {
  return GYM_TRAINER_SPRITE[gymType] ?? "pokemontrainer";
}

/** Dificultad visual 1–5 a partir del orden del gimnasio (1..badgeTarget). */
export function gymDifficultyStars(order: number, badgeTarget = 8): number {
  const denom = Math.max(1, badgeTarget);
  return Math.min(5, Math.max(1, Math.ceil((order * 5) / denom)));
}
