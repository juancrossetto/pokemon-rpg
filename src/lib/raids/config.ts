import type { RewardBundle } from "@/lib/events/rewards";

export const RAID_ATTEMPTS_PER_WEEK = 3;

/**
 * Escalera de jefes: legendarios de Kanto primero, después Johto, con el nivel
 * subiendo de a 5. Antes eran tres jefes elegidos por hash de la semana, así
 * que la dificultad saltaba de un Mewtwo Nv.70 a un Rayquaza Nv.75 sin ningún
 * orden — y Rayquaza (gen 3) ni siquiera está sembrado en todas las bases.
 *
 * La rotación es **cíclica por número de semana**, no aleatoria: la incursión
 * se lee como una progresión y el jugador puede anticipar contra qué le toca.
 */
export const RAID_BOSSES = [
  { speciesId: 144, level: 50, accent: "#7dd3fc" }, // Articuno
  { speciesId: 145, level: 55, accent: "#fde047" }, // Zapdos
  { speciesId: 146, level: 60, accent: "#fb923c" }, // Moltres
  { speciesId: 150, level: 65, accent: "#a78bfa" }, // Mewtwo
  { speciesId: 151, level: 70, accent: "#f9a8d4" }, // Mew
  { speciesId: 243, level: 75, accent: "#facc15" }, // Raikou
  { speciesId: 244, level: 80, accent: "#f87171" }, // Entei
  { speciesId: 245, level: 85, accent: "#67e8f9" }, // Suicune
  { speciesId: 249, level: 90, accent: "#c4b5fd" }, // Lugia
  { speciesId: 250, level: 95, accent: "#fbbf24" }, // Ho-Oh
  { speciesId: 251, level: 100, accent: "#86efac" }, // Celebi
] as const;

export type RaidBoss = (typeof RAID_BOSSES)[number];

/** Nivel de equipo a partir del cual la incursión deja de ser una paliza. */
export const RAID_RECOMMENDED_LEVEL = 40;

/**
 * Turnos por intento (estilo Max Raid): el intento siempre termina, y tres
 * intentos semanales no se vuelven una sesión eterna.
 */
export const RAID_TURNS_PER_ATTEMPT = 10;

/**
 * HP del jefe **dentro de un intento**. No es la barra global: es lo que un
 * equipo tendría que arrancarle para tumbarlo en una sola corrida. Que exista
 * un tope evita que un jugador con equipo Nv.100 llene la barra comunitaria él
 * solo en tres intentos.
 */
export const RAID_BOSS_BATTLE_HP = 12_000;

/**
 * Barra comunitaria semanal.
 *
 * Bajó de 2.000.000 a 120.000 porque las unidades cambiaron: antes el daño
 * salía de una fórmula que devolvía ~15.000 por intento; ahora es daño real de
 * combate, que en una corrida buena ronda los 2.000-6.000. Con el número viejo
 * la barra era inalcanzable. Los puntajes de la semana en curso quedan en
 * unidades viejas y se ven inflados — se corrige solo en el reinicio semanal.
 */
export const RAID_COMMUNITY_HP = 120_000;

export const RAID_REWARD: RewardBundle = [
  { kind: "coins", amount: 750 },
  { kind: "gems", amount: 2 },
  { kind: "item", itemName: "Super Potion", quantity: 3 },
];

/** Extra por pertenecer a un clan. Se suma al bundle al reclamar. */
export const RAID_CLAN_BONUS_COINS = 250;

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
