import type { RewardBundle } from "@/lib/events/rewards";

export const RAID_ATTEMPTS_PER_WEEK = 3;

/**
 * Escalera de jefes: legendarios de Kanto primero, después Johto.
 *
 * Arranca en Nv.25 —cuando el jugador ronda las 3-4 medallas— y sube de a 5 en
 * la mitad baja y de a 10 en la alta, así el modo es alcanzable temprano sin
 * perder un tope de Nv.100. Antes empezaba en Nv.50 y quedaba a meses de una
 * cuenta nueva.
 *
 * La rotación es **cíclica por número de semana**, no aleatoria (antes era un
 * hash, y la dificultad saltaba sin orden): la incursión se lee como una
 * progresión y el jugador puede anticipar contra qué le toca.
 *
 * Son los once legendarios que existen en la base — la gen 3 no está sembrada,
 * verificado contra Supabase. Sumar escalones exige sembrarla primero.
 */
export const RAID_BOSSES = [
  { speciesId: 144, level: 25, accent: "#7dd3fc" }, // Articuno
  { speciesId: 145, level: 30, accent: "#fde047" }, // Zapdos
  { speciesId: 146, level: 35, accent: "#fb923c" }, // Moltres
  { speciesId: 150, level: 40, accent: "#a78bfa" }, // Mewtwo
  { speciesId: 151, level: 45, accent: "#f9a8d4" }, // Mew
  { speciesId: 243, level: 50, accent: "#facc15" }, // Raikou
  { speciesId: 244, level: 60, accent: "#f87171" }, // Entei
  { speciesId: 245, level: 70, accent: "#67e8f9" }, // Suicune
  { speciesId: 249, level: 80, accent: "#c4b5fd" }, // Lugia
  { speciesId: 250, level: 90, accent: "#fbbf24" }, // Ho-Oh
  { speciesId: 251, level: 100, accent: "#86efac" }, // Celebi
] as const;

export type RaidBoss = (typeof RAID_BOSSES)[number];

/**
 * Nivel de equipo a partir del cual la incursión deja de ser una paliza.
 *
 * Bajó de 40 a 25 junto con el primer escalón: la incursión arrancaba en Nv.50
 * y quedaba a meses de una cuenta nueva. La escalera ahora entra en Nv.25 —
 * más o menos cuando el jugador tiene 3-4 medallas — y sube de a 5 en la mitad
 * baja y de a 10 en la alta, para que el tope siga siendo Nv.100.
 *
 * Los 11 son todos los legendarios que hay: la gen 3 no está sembrada (se
 * verificó contra la base), así que sumar escalones exige `npm run db:seed`
 * con esas especies antes.
 */
export const RAID_RECOMMENDED_LEVEL = 25;

/**
 * Turnos por intento (estilo Max Raid): el intento siempre termina, y tres
 * intentos semanales no se vuelven una sesión eterna.
 */
export const RAID_TURNS_PER_ATTEMPT = 10;

/*
  HP del jefe **dentro de un intento**. No es la barra global: es lo que hay que
  arrancarle para tumbarlo en una sola corrida, y escala con el escalón (era un
  valor fijo para los once, así que el primero y el último aguantaban igual).

  Calibrado contra daño real de combate, no contra la fórmula vieja.

  El primer valor fue 12.000 porque copié el orden de magnitud de
  `calculateRaidDamage`, que devolvía ~15.000 por intento — pero ese número era
  un puntaje de poder inventado, no HP. Medido sobre la fórmula de daño real,
  10 turnos rinden dos órdenes de magnitud menos, así que aquel jefe era
  intumbable incluso con equipo Nv.100 (52% en una semana entera) y una cuenta
  nueva aportaba 0,3% — invisible.

  1.200 en el primer escalón apunta a que un equipo del nivel del jefe (Nv.25)
  con un matchup decente le saque ~420 por intento, o sea que una semana
  completa lo tumbe casi solo; con matchup neutro ronda el 20% y necesita
  compañía. Los 180 por nivel mantienen esa proporción hasta el último escalón
  (Nv.100 → 14.700).

  Como el daño de un intento no puede pasar el HP del jefe, esto además es el
  tope anti-whale: por fuerte que seas, aportás como mucho 3 × HP por semana.
*/
export const RAID_BOSS_HP_AT_FIRST_STEP = 1_200;
export const RAID_BOSS_HP_PER_LEVEL = 180;

export function raidBossBattleHp(level: number): number {
  const first = RAID_BOSSES[0]!.level;
  return RAID_BOSS_HP_AT_FIRST_STEP + Math.max(0, level - first) * RAID_BOSS_HP_PER_LEVEL;
}

/**
 * Barra comunitaria semanal.
 *
 * Es, en la práctica, "cuántos jugadores hacen falta para tumbarla". Una cuenta
 * en el nivel del jefe aporta ~1.400-4.600 semanales según el escalón, así que
 * 15.000 son entre 4 y 10 jugadores. Éste es el número a mover si el juego
 * crece o si querés que caiga más seguido; no hace falta tocar nada más.
 *
 * (Venía de 2.000.000 y después 120.000, las dos calibradas contra la fórmula
 * vieja, que no devolvía daño de combate sino un puntaje de poder.)
 */
export const RAID_COMMUNITY_HP = 15_000;

export const RAID_REWARD: RewardBundle = [
  { kind: "coins", amount: 750 },
  { kind: "gems", amount: 2 },
  { kind: "item", itemName: "Super Potion", quantity: 3 },
];

/** Extra por pertenecer a un clan. Se suma al bundle al reclamar. */
export const RAID_CLAN_BONUS_COINS = 250;

/**
 * Botín extra si entre todos tumbaron la barra comunitaria.
 *
 * Sin esto la premisa del modo —"todos los entrenadores empujan la misma
 * barra"— no tenía desenlace: `communityDefeated` se calculaba y no lo leía
 * nadie, así que llenar los {@link RAID_COMMUNITY_HP} no cambiaba nada.
 * Se cobra en el mismo reclamo semanal, junto al bundle base.
 */
export const RAID_COMMUNITY_BONUS: RewardBundle = [
  { kind: "gems", amount: 3 },
  { kind: "item", itemName: "Hyper Potion", quantity: 2 },
];

/** Índice de semana ISO ("2026-W31" → 31). Sirve para rotar en orden. */
export function raidWeekIndex(key: string): number {
  const match = /W(\d+)$/.exec(key);
  if (!match) return 0;
  return Number.parseInt(match[1]!, 10);
}

/** Jefe de la semana: recorre la escalera en orden, no al azar. */
export function raidBossForWeek(key: string): RaidBoss {
  const index = raidWeekIndex(key);
  return RAID_BOSSES[((index % RAID_BOSSES.length) + RAID_BOSSES.length) % RAID_BOSSES.length]!;
}

/** El siguiente de la escalera — la card lo anuncia como "la próxima semana". */
export function raidNextBossForWeek(key: string): RaidBoss {
  const index = raidWeekIndex(key) + 1;
  return RAID_BOSSES[((index % RAID_BOSSES.length) + RAID_BOSSES.length) % RAID_BOSSES.length]!;
}
