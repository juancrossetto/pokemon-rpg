import { isTutorialBattle } from "@/lib/battle-tutorial";

/**
 * Hasta este nivel del Pokémon activo se desvanece la ayuda de onboarding.
 *
 * Era 20, y ahí estaba el agujero del arranque: a nivel 19 la asistencia ya
 * valía 1,7% — o sea nada — justo en el tramo donde los jugadores nuevos
 * reportaban perder contra salvajes de menor nivel.
 */
export const EARLY_GAME_PLAYER_LEVEL_MAX = 26;

/** Hasta acá la asistencia se mantiene completa; luego baja gradualmente. */
export const EARLY_GAME_FULL_ASSIST_LEVEL = 12;

/** Zonas hasta Ciudad Celeste capan salvajes y alphas más agresivamente. */
export const EARLY_GAME_ZONE_LEVEL_MAX = 16;

export type EarlyGameBattleMode = "wild" | "tutorial";

/**
 * Combates salvajes / tutorial del recorrido inicial. No aplica a PvP, torre,
 * gimnasios ni entrenadores de ruta (ahí la dificultad es el punto).
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

/** Progreso 1 hasta Lv.12 → 0 en Lv.{EARLY_GAME_PLAYER_LEVEL_MAX}. */
export function earlyGameProgress(playerLevel: number): number {
  if (playerLevel >= EARLY_GAME_PLAYER_LEVEL_MAX) return 0;
  if (playerLevel <= EARLY_GAME_FULL_ASSIST_LEVEL) return 1;
  return (
    (EARLY_GAME_PLAYER_LEVEL_MAX - playerLevel) /
    (EARLY_GAME_PLAYER_LEVEL_MAX - EARLY_GAME_FULL_ASSIST_LEVEL)
  );
}

/** A partir de esta diferencia de niveles la ventaja deja de crecer. */
export const LEVEL_ADVANTAGE_SATURATION = 5;

/**
 * Ventaja por sacarle niveles al salvaje.
 *
 * Sin esto el nivel casi no pesa: un Pokémon del jugador sin puntos asignados
 * tiene exactamente las mismas stats que un salvaje de su nivel (comparar
 * `playerCombatantStats` con `wildCombatantStats`), así que +5 niveles son
 * ~+26% de stats mientras que una ventaja de tipo mueve ×4. Resultado medido:
 * un Oddish Lv.14 mataba a un Wartortle Lv.19 en 5 turnos mientras el Wartortle
 * necesitaba 4 — y encima el Oddish drena con Absorber.
 *
 * Es asimétrico a propósito: sólo corrige cuando el jugador va **arriba** en
 * nivel. Si el salvaje es igual o más fuerte, no toca nada y la dificultad
 * queda intacta.
 */
export function levelAdvantageMultiplier(
  playerLevel: number,
  wildLevel: number,
  attacker: "player" | "wild",
): number {
  const gap = playerLevel - wildLevel;
  if (gap <= 0) return 1;
  const t = Math.min(1, gap / LEVEL_ADVANTAGE_SATURATION);
  return attacker === "player" ? 1 + 0.3 * t : 1 - 0.25 * t;
}

/**
 * Multiplicador de daño en combates tempranos. Jugador pega un poco más fuerte;
 * los salvajes un poco menos (sin anular tipos). Encima se compone la ventaja
 * por nivel, que a diferencia de la ayuda de onboarding no se apaga con el
 * nivel del jugador: mientras le saque niveles al rival, la ventaja vale.
 */
export function earlyGamePowerMultiplier(
  playerLevel: number,
  wildLevel: number,
  attacker: "player" | "wild",
  mode: EarlyGameBattleMode,
): number {
  const byLevel = levelAdvantageMultiplier(playerLevel, wildLevel, attacker);
  const t = earlyGameProgress(playerLevel);
  if (t <= 0) return byLevel;

  const onboarding =
    mode === "tutorial"
      ? attacker === "player"
        ? 1 + 0.22 * t
        : 1 - 0.2 * t
      : attacker === "player"
        ? 1 + 0.14 * t
        : 1 - 0.14 * t;

  return byLevel * onboarding;
}

/** En el onboarding el salvaje no supera al líder +1 (alphas incluidos). */
export function capWildLevelForEarlyGame(
  wildLevel: number,
  playerLevel: number,
  zoneLevelMax: number,
): number {
  if (zoneLevelMax > EARLY_GAME_ZONE_LEVEL_MAX) return wildLevel;
  return Math.min(wildLevel, playerLevel + 1);
}
