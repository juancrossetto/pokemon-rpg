import { typeColor } from "@/lib/type-colors";
import { typeIcon } from "@/lib/type-icons";

/** Ambientación visual reutilizable por tipo de gimnasio. */
export type GymCorridorTheme = {
  type: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
  particle: "water" | "fire" | "rock" | "electric" | "grass" | "poison" | "psychic" | "ground" | "generic";
  icon: string;
  gradientFrom: string;
  gradientVia: string;
  fogOpacity: number;
};

const PARTICLE_BY_TYPE: Record<string, GymCorridorTheme["particle"]> = {
  water: "water",
  fire: "fire",
  rock: "rock",
  electric: "electric",
  grass: "grass",
  poison: "poison",
  psychic: "psychic",
  ground: "ground",
};

export function gymCorridorTheme(type: string): GymCorridorTheme {
  const accent = typeColor(type);
  const particle = PARTICLE_BY_TYPE[type] ?? "generic";
  return {
    type,
    accent,
    accentSoft: `${accent}33`,
    accentGlow: `${accent}66`,
    particle,
    icon: typeIcon(type),
    gradientFrom: `${accent}40`,
    gradientVia: `${accent}14`,
    fogOpacity: particle === "water" || particle === "poison" || particle === "psychic" ? 0.35 : 0.22,
  };
}

/** Recompensa estimada por subordinado (no hay tabla dedicada aún). */
export function subordinateReward(coinReward: number, slot: number, teamLevels: number[]) {
  const avgLevel =
    teamLevels.length > 0
      ? teamLevels.reduce((a, b) => a + b, 0) / teamLevels.length
      : 10;
  const coins = Math.max(40, Math.round(coinReward * (0.12 + slot * 0.08)));
  const xp = Math.max(30, Math.round(avgLevel * 8 + slot * 20));
  return { coins, xp };
}

/** Dificultad 1–5 a partir del nivel medio del equipo vs orden del gym. */
export function encounterDifficulty(avgLevel: number, gymOrder: number): number {
  const baseline = 8 + gymOrder * 4;
  const delta = avgLevel - baseline;
  if (delta <= -4) return 1;
  if (delta <= -1) return 2;
  if (delta <= 2) return 3;
  if (delta <= 5) return 4;
  return 5;
}

/** Clase de entrenador = primera palabra del nombre seed ("Pescador Iván"). */
export function trainerClassFromName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || name;
}

/**
 * Sprite Showdown según clase del subordinado (seed en ES).
 * Fallback genérico si no hay match.
 */
const TRAINER_CLASS_SLUGS: Record<string, string> = {
  excursionista: "hiker",
  minero: "worker",
  buceadora: "swimmerf",
  buceador: "swimmer",
  pescador: "fisherman",
  pescadora: "fisherman",
  electricista: "scientist",
  tecnico: "scientist",
  técnico: "scientist",
  jardinera: "pokemonbreederf",
  jardinero: "pokemonbreeder",
  herbolario: "pokemonbreeder",
  ninja: "ninjaboy",
  fumigador: "scientist",
  medium: "medium",
  médium: "medium",
  vidente: "psychic",
  psíquico: "psychic",
  psiquico: "psychic",
  psíquica: "psychicf",
  psiquica: "psychicf",
  bombero: "worker",
  vulcanologo: "scientist",
  vulcanólogo: "scientist",
  excavador: "worker",
  cazador: "backpacker",
  supernerd: "supernerd",
  recluta: "rocketgrunt",
  karateka: "blackbelt",
  montañista: "hiker",
  montanista: "hiker",
  nadadora: "swimmerf",
  nadador: "swimmer",
  observador: "birdkeeper",
  ornitóloga: "birdkeeperf",
  ornitologa: "birdkeeperf",
  pajarero: "birdkeeper",
  cazabichos: "bugcatcher",
  belleza: "beauty",
  señorita: "lady",
  senorita: "lady",
  gentilhombre: "gentleman",
  dama: "lady",
  marinero: "sailor",
  esquiador: "skier",
  esquiadora: "skierf",
  domadragones: "dragontamer",
};

export function trainerSpriteSlugFromName(name: string): string {
  const cls = trainerClassFromName(name).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const normalized = trainerClassFromName(name).toLowerCase();
  return (
    TRAINER_CLASS_SLUGS[normalized] ??
    TRAINER_CLASS_SLUGS[cls] ??
    (normalized.endsWith("a") ? "lass" : "youngster")
  );
}

