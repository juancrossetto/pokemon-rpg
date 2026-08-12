import { isTutorialBattle } from "@/lib/battle-tutorial";

/** Hasta este nivel del Pokémon activo aplica el rebalanceo de daño. */
export const EARLY_GAME_PLAYER_LEVEL_MAX = 12;

/** Zonas con levelMax ≤ esto capan salvajes y alphas más agresivamente. */
export const EARLY_GAME_ZONE_LEVEL_MAX = 8;

export type EarlyGameBattleMode = "wild" | "tutorial";

/**
 * Combates salvajes / tutorial antes del primer gimnasio. No aplica a PvP,
 * torre, gimnasios ni entrenadores de ruta (ahí la dificultad es el punto).
 */
export function earlyGameBattleMode(battle: {
  routeTrainerId?: string | null;
  pvpMatchId?: string | null;
  clanWarBattleId?: string | null;
  gymRunId?: string | null;
}): EarlyGameBattleMode | null {
  if (battle.pvpMatchId || battle.clanWarBattleId || battle.gymRunId) return null;
  if (isTutorialBattle(battle)) return "tutorial";
  if (battle.routeTrainerId) return null;
  return "wild";
}

/** Progreso 1 en Lv.1 → 0 en Lv.{EARLY_GAME_PLAYER_LEVEL_MAX}. */
export function earlyGameProgress(playerLevel: number): number {
  if (playerLevel >= EARLY_GAME_PLAYER_LEVEL_MAX) return 0;
  if (playerLevel <= 1) return 1;
  return (EARLY_GAME_PLAYER_LEVEL_MAX - playerLevel) / (EARLY_GAME_PLAYER_LEVEL_MAX - 1);
}

/**
 * Multiplicador de daño en combates tempranos. Jugador pega un poco más fuerte;
 * los salvajes un poco menos (sin anular tipos).
 */
export function earlyGamePowerMultiplier(
  playerLevel: number,
  attacker: "player" | "wild",
  mode: EarlyGameBattleMode,
): number {
  const t = earlyGameProgress(playerLevel);
  if (t <= 0) return 1;

  if (mode === "tutorial") {
    return attacker === "player" ? 1 + 0.22 * t : 1 - 0.2 * t;
  }
  return attacker === "player" ? 1 + 0.14 * t : 1 - 0.14 * t;
}

/** En capítulo 1 el salvaje no supera al líder +1 (alphas incluidos). */
export function capWildLevelForEarlyGame(
  wildLevel: number,
  playerLevel: number,
  zoneLevelMax: number,
): number {
  if (zoneLevelMax > EARLY_GAME_ZONE_LEVEL_MAX) return wildLevel;
  return Math.min(wildLevel, playerLevel + 1);
}
