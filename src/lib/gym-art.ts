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
};

export function gymBadgeImageUrl(type: string): string {
  return `/gyms/badges/${type}.png`;
}

/** Sprite pixel Showdown — cards, listas, UI chica. */
export function gymLeaderImageUrl(leaderName: string): string | null {
  const slug = LEADER_SLUGS[leaderName];
  return slug ? `/gyms/leaders/${slug}.png` : null;
}

/** Retrato grande — detalle de gimnasio / pantallas hero. */
export function gymLeaderPortraitUrl(leaderName: string): string | null {
  const slug = LEADER_SLUGS[leaderName];
  return slug ? `/gyms/portraits/${slug}.png` : null;
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

/** Dificultad visual 1–5 a partir del orden del gimnasio (1..8). */
export function gymDifficultyStars(order: number): number {
  return Math.min(5, Math.max(1, Math.ceil((order * 5) / 8)));
}
