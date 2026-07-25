import { calculateMaxHp, calculateStat } from "@/lib/stats";

// Ranking segmentado del dossier (fase 4): global, por país y por especie.
// El "poder" de un Pokémon se calcula con las MISMAS fórmulas que usa el
// combate (ver stats.ts y la ficha del mercado), así el ranking refleja la
// fuerza real en batalla y no un número inventado. Suma de los 6 stats.

export type PowerInput = {
  level: number;
  ptStrength: number;
  ptDexterity: number;
  ptIntelligence: number;
  ptSpeed: number;
  ptConstitution: number;
  species: {
    baseHp: number;
    baseAttack: number;
    baseDefense: number;
    baseSpAtk: number;
    baseSpDef: number;
    baseSpeed: number;
  };
};

export function pokemonPower(p: PowerInput): number {
  const s = p.species;
  return (
    calculateMaxHp(s.baseHp, p.level, p.ptConstitution) +
    calculateStat(s.baseAttack, p.ptStrength, p.level) +
    calculateStat(s.baseDefense, p.ptDexterity, p.level) +
    calculateStat(s.baseSpAtk, p.ptIntelligence, p.level) +
    calculateStat(s.baseSpDef, p.ptIntelligence, p.level) +
    calculateStat(s.baseSpeed, p.ptSpeed, p.level)
  );
}

/**
 * Poder de un entrenador = suma del poder de su equipo activo (máx. 6). Se usa
 * el equipo y no toda la colección para acotar el costo (6 por jugador) y
 * porque mide la fuerza que el jugador realmente lleva a pelear.
 */
export function teamPower(team: PowerInput[]): number {
  return team.reduce((total, p) => total + pokemonPower(p), 0);
}

export type TrainerRankFields = {
  badges: number;
  power: number;
  createdAt: Date;
};

/**
 * Orden del ranking de entrenadores: medallas primero (progresión real),
 * después poder del equipo, y como desempate final la antigüedad de la cuenta
 * (el que llegó antes queda arriba). Determinístico: nunca dos filas empatan
 * en un orden ambiguo.
 */
export function compareTrainers(a: TrainerRankFields, b: TrainerRankFields): number {
  if (a.badges !== b.badges) return b.badges - a.badges;
  if (a.power !== b.power) return b.power - a.power;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export type CollectorRankFields = {
  owned: number;
  shinies: number;
  createdAt: Date;
};

/** Collectors: más especies únicas, luego shinies, luego antigüedad. */
export function compareCollectors(a: CollectorRankFields, b: CollectorRankFields): number {
  if (a.owned !== b.owned) return b.owned - a.owned;
  if (a.shinies !== b.shinies) return b.shinies - a.shinies;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function winRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total <= 0) return 0;
  return Math.round((wins / total) * 100);
}

/** Buckets simples para el gráfico de distribución de poder. */
export function powerDistribution(
  powers: number[],
): { labelKey: "low" | "mid" | "high" | "elite"; count: number; pct: number }[] {
  if (powers.length === 0) return [];
  const max = Math.max(...powers, 1);
  const edges = [0, max * 0.25, max * 0.5, max * 0.75, max + 1];
  const labelKeys = ["low", "mid", "high", "elite"] as const;
  const counts = [0, 0, 0, 0];
  for (const p of powers) {
    const i = edges.findIndex((edge, idx) => idx > 0 && p < edge) - 1;
    counts[Math.max(0, i)] += 1;
  }
  const total = powers.length;
  return labelKeys.map((labelKey, i) => ({
    labelKey,
    count: counts[i],
    pct: Math.round((counts[i] / total) * 100),
  }));
}

export const RANKING_PAGE_SIZE = 20;
