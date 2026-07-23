import { calculateStat } from "@/lib/stats";
import type { CombatantStats } from "@/lib/battle";

interface SpeciesBaseStats {
  baseAttack: number;
  baseDefense: number;
  baseSpAtk: number;
  baseSpDef: number;
  baseSpeed: number;
  types: string[];
}

// Stats del Pokémon del jugador: usa los puntos manuales que invirtió.
export function playerCombatantStats(
  species: SpeciesBaseStats,
  level: number,
  points: { ptStrength: number; ptDexterity: number; ptIntelligence: number; ptSpeed: number },
): CombatantStats {
  return {
    level,
    types: species.types,
    atk: calculateStat(species.baseAttack, points.ptStrength, level),
    def: calculateStat(species.baseDefense, points.ptDexterity, level),
    spAtk: calculateStat(species.baseSpAtk, points.ptIntelligence, level),
    spDef: calculateStat(species.baseSpDef, points.ptIntelligence, level),
    speed: calculateStat(species.baseSpeed, points.ptSpeed, level),
  };
}

// Stats de un Pokémon salvaje: sin puntos manuales, solo base + nivel.
export function wildCombatantStats(species: SpeciesBaseStats, level: number): CombatantStats {
  return {
    level,
    types: species.types,
    atk: calculateStat(species.baseAttack, 0, level),
    def: calculateStat(species.baseDefense, 0, level),
    spAtk: calculateStat(species.baseSpAtk, 0, level),
    spDef: calculateStat(species.baseSpDef, 0, level),
    speed: calculateStat(species.baseSpeed, 0, level),
  };
}
