import { calculateMaxHp, calculateStat } from "@/lib/stats";

// Ranking segmentado del dossier (fase 4): global, por país y por especie.
// El "poder" de un Pokémon se calcula con las MISMAS fórmulas que usa el
// combate (ver stats.ts y la ficha del mercado), así el ranking refleja la
// fuerza real en batalla y no un número inventado. Suma de los 6 stats.
//
// Nota de balance: calculateMaxHp no considera ptConstitution (igual que el
// motor de combate hoy), así que Constitución no pesa en el poder. Es una
// inconsistencia preexistente del juego, no del ranking — se resuelve cuando
// se afine el balance (fase 7), y ahí este número se ajusta solo.

export type PowerInput = {
  level: number;
  ptStrength: number;
  ptDexterity: number;
  ptIntelligence: number;
  ptSpeed: number;
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
    calculateMaxHp(s.baseHp, p.level) +
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

export const RANKING_PAGE_SIZE = 25;
