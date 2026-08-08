/**
 * Desbloqueo de avatares por progreso de gimnasio (historia Kanto).
 *
 * Narrativa del picker / de los lotes:
 *   starters (Oak, Ash + novatos) → Brock → Misty → Surge/Rocket →
 *   Erika → Koga → Sabrina → Blaine → Giovanni → Alto Mando →
 *   Campeones → invitados de otras regiones al final del Alto Mando.
 *
 * Variantes del mismo personaje van juntas. La elegibilidad se deriva de
 * `Badge` (órdenes ganadas); no hay tabla de ownership.
 */

import { AVATAR_OPTIONS } from "@/lib/avatars";

/** Retratos libres desde el registro (Pueblo Paleta + novatos). */
export const AVATAR_STARTER_SLUGS = [
  "oak",
  "ash",
  "joven",
  "chica",
  "campista",
  "montanista",
  "nadador",
  "nadadora",
  "karate",
  "cientifico",
  "pokechico",
  "pokefan",
] as const;

/**
 * Lotes por `Gym.order` (seed Kanto).
 * 11–12 meten invitados de otras regiones (post-Kanto).
 * 13 Campeón: Red, Blue, Cynthia, N.
 */
export const AVATAR_REWARDS_BY_GYM_ORDER: Record<number, readonly string[]> = {
  // 1 · Brock — 1.ª medalla
  1: [
    "chase",
    "brock",
    "brockk",
    "chicaa",
    "ranger",
    "cazabichos",
  ],
  // 2 · Misty
  2: [
    "mist",
    "misty",
    "mistyy",
    "mistyyy",
    "chicamala",
    "model",
    "damisela",
    "criadora",
    "francine",
  ],
  // 3 · Lt. Surge + Team Rocket
  3: [
    "lectro",
    "james",
    "jessie",
    "reclutarocket",
    "reclutarocketf",
    "entrenadorguay",
    "entrenadoraguay",
    "fredo",
    "pegaso",
    "delos",
  ],
  // 4 · Erika (Hiedra)
  4: [
    "hiedra",
    "hiedrab",
    "hiedrac",
    "mananti",
    "lem",
    "sachiko",
    "surfista",
    "leti",
    "letib",
  ],
  // 5 · Koga
  5: [
    "koga",
    "petra",
    "petraa",
    "pokemaniaco",
    "hugo",
    "supernerd",
    "motorista",
    "yakon",
    "maximo",
    "maximob",
    "junco",
  ],
  // 6 · Sabrina
  6: [
    "sabrina",
    "sabrinab",
    "sabrinac",
    "sabrinad",
    "lira",
    "liraa",
    "lirab",
    "anton",
    "antonb",
    "alana",
  ],
  // 7 · Blaine
  7: [
    "blaine",
    "blaineb",
    "candela",
    "candelab",
    "juncob",
    "alanab",
    "camila",
    "camilaa",
    "camilab",
  ],
  // 8 · Giovanni / Viridian
  8: [
    "naboru",
    "nerio",
    "ariana",
    "arianaa",
    "nanci",
    "nancia",
    "kalm",
    "kalma",
    "evemaster",
  ],
  // 9 · Lorelei
  9: [
    "lorelei",
    "vito",
    "vitob",
    "veterano",
    "veterana",
    "marcial",
    "marcialb",
    "roy",
    "royb",
  ],
  // 10 · Bruno
  10: [
    "bruno",
    "brunoaltomando",
    "brunob",
    "brunoc",
    "brunod",
    "fero",
    "feroa",
    "royc",
    "lucho",
  ],
  // 11 · Agatha + Alola / invitados
  11: [
    "agatha",
    "morti",
    "mortib",
    "mortic",
    "luchoa",
    "luchob",
    "cheren",
    "cherenb",
    "edel",
    "gladio",
  ],
  // 12 · Lance + Kalos / Hoenn
  12: [
    "lance",
    "lanceb",
    "serena",
    "serenab",
    "aura",
    "aurab",
    "aurac",
    "aurad",
    "gladiob",
    "cintiaa",
  ],
  // 13 · Campeón — rivales y campeones icónicos
  13: [
    "azul",
    "azula",
    "azulb",
    "azulc",
    "rojo",
    "rojoa",
    "rojob",
    "rojoc",
    "cintia",
    "n",
    "na",
    "nb",
    "nc",
  ],
};

const STARTER_SET = new Set<string>(AVATAR_STARTER_SLUGS);

/** slug → gym order que lo desbloquea (undefined = starter). */
const SLUG_TO_ORDER = new Map<string, number>();
for (const [orderStr, slugs] of Object.entries(AVATAR_REWARDS_BY_GYM_ORDER)) {
  const order = Number(orderStr);
  for (const slug of slugs) SLUG_TO_ORDER.set(slug, order);
}

export type AvatarUnlockRequirement =
  | { kind: "starter" }
  | { kind: "gym"; order: number };

export function avatarUnlockRequirement(
  slug: string,
): AvatarUnlockRequirement | null {
  if (STARTER_SET.has(slug)) return { kind: "starter" };
  const order = SLUG_TO_ORDER.get(slug);
  if (order != null) return { kind: "gym", order };
  return null;
}

/** Ids/slugs desbloqueados con el set de `Gym.order` ya ganados. */
export function unlockedAvatarIds(
  earnedGymOrders: Iterable<number>,
): Set<string> {
  const unlocked = new Set<string>(AVATAR_STARTER_SLUGS);
  const earned = new Set(earnedGymOrders);
  for (const [orderStr, slugs] of Object.entries(AVATAR_REWARDS_BY_GYM_ORDER)) {
    if (!earned.has(Number(orderStr))) continue;
    for (const slug of slugs) unlocked.add(slug);
  }
  return unlocked;
}

export function isAvatarUnlocked(
  slug: string,
  earnedGymOrders: Iterable<number>,
): boolean {
  return unlockedAvatarIds(earnedGymOrders).has(slug);
}

/** Lote que se revela al ganar la medalla/sello de ese `order` (primera vez). */
export function avatarRewardsForGymOrder(order: number): readonly string[] {
  return AVATAR_REWARDS_BY_GYM_ORDER[order] ?? [];
}

export function starterAvatarOptions() {
  const bySlug = new Map(AVATAR_OPTIONS.map((o) => [o.slug, o]));
  return AVATAR_STARTER_SLUGS.map((slug) => bySlug.get(slug)).filter(
    (o): o is (typeof AVATAR_OPTIONS)[number] => o != null,
  );
}

/**
 * Orden de historia: starters (Oak/Ash primero) → gym 1…13.
 */
export function avatarSlugsInStoryOrder(): string[] {
  const ordered: string[] = [...AVATAR_STARTER_SLUGS];
  for (let order = 1; order <= 13; order++) {
    const batch = AVATAR_REWARDS_BY_GYM_ORDER[order];
    if (batch) ordered.push(...batch);
  }
  return ordered;
}

export function avatarOptionsInStoryOrder() {
  const bySlug = new Map(AVATAR_OPTIONS.map((o) => [o.slug, o]));
  return avatarSlugsInStoryOrder()
    .map((slug) => bySlug.get(slug))
    .filter((o): o is (typeof AVATAR_OPTIONS)[number] => o != null);
}

/** Asegura en tests/CI que el catálogo y la tabla de unlocks coinciden. */
export function assertAvatarUnlockCoverage(): {
  ok: boolean;
  missing: string[];
  extra: string[];
} {
  const catalog = new Set(AVATAR_OPTIONS.map((o) => o.slug));
  const covered = new Set<string>(AVATAR_STARTER_SLUGS);
  for (const slugs of Object.values(AVATAR_REWARDS_BY_GYM_ORDER)) {
    for (const s of slugs) covered.add(s);
  }
  const missing = [...catalog].filter((s) => !covered.has(s));
  const extra = [...covered].filter((s) => !catalog.has(s));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}
