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

/**
 * `trainer` = entrenador de ruta. No recibe la ayuda de onboarding (la
 * dificultad de un entrenador es parte de la historia), pero sí la ventaja por
 * nivel: antes quedaba afuera de todo y era donde más se rompía el pacing —
 * los entrenadores de ruta van 3..34 mientras el jugador suele ir por arriba,
 * y aún así la pelea se sentía pareja porque el nivel casi no pesa.
 */
export type EarlyGameBattleMode = "wild" | "tutorial" | "trainer";

/**
 * Combates de la aventura (salvajes, tutorial y entrenadores de ruta).
 * No aplica a PvP, torre ni gimnasios: ahí la dificultad es el punto.
 */
export function earlyGameBattleMode(battle: {
  routeTrainerId?: string | null;
  pvpMatchId?: string | null;
  clanWarBattleId?: string | null;
  gymRunId?: string | null;
}): EarlyGameBattleMode | null {
  if (battle.pvpMatchId || battle.clanWarBattleId || battle.gymRunId) return null;
  if (isTutorialBattle(battle)) return "tutorial";
  if (battle.routeTrainerId) return "trainer";
  return "wild";
}

/** La IA rival sólo se "afloja" contra salvajes; los entrenadores juegan bien. */
export function isOnboardingAiMode(mode: EarlyGameBattleMode | null): boolean {
  return mode === "wild" || mode === "tutorial";
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

/**
 * A partir de esta diferencia de niveles la ventaja deja de crecer.
 *
 * Era 5 y saturaba demasiado pronto: el tramo previo al segundo gimnasio tiene
 * rivales Nv.12-14 contra equipos Nv.17-18, o sea justo en el borde, y encima
 * las zonas de farmeo quedan 6-8 niveles atrás cuando el jugador se prepara
 * para Misty (líder Nv.18-21). Con 8 la ventaja sigue creciendo en ese tramo.
 */
export const LEVEL_ADVANTAGE_SATURATION = 8;

/**
 * Ventaja por sacarle niveles al rival.
 *
 * Sin esto el nivel casi no pesa: un Pokémon del jugador sin puntos asignados
 * tiene exactamente las mismas stats que un salvaje de su nivel (comparar
 * `playerCombatantStats` con `wildCombatantStats`), así que +5 niveles son
 * ~+26% de stats mientras que una ventaja de tipo mueve ×4. Resultado medido:
 * un Oddish Lv.14 mataba a un Wartortle Lv.19 en 5 turnos mientras el Wartortle
 * necesitaba 4 — y encima el Oddish drena con Absorber.
 *
 * Es asimétrico a propósito: sólo corrige cuando el jugador va **arriba** en
 * nivel. Si el rival es igual o más fuerte, no toca nada y la dificultad queda
 * intacta.
 */
export function levelAdvantageMultiplier(
  playerLevel: number,
  wildLevel: number,
  attacker: "player" | "wild",
): number {
  const gap = playerLevel - wildLevel;
  if (gap <= 0) return 1;
  /*
    Los coeficientes suben junto con la saturación a propósito. Ampliar el techo
    de 5 a 8 niveles sin tocarlos habría **achicado** el efecto por nivel
    (0.30/5 = 0.06 → 0.45/8 = 0.056), o sea que la ventaja de 3-4 niveles —el
    caso más común de la aventura— habría quedado peor que antes. Con 0.55/0.45
    cada nivel de ventaja pesa más que en la versión anterior y además sigue
    creciendo hasta 8.
  */
  const t = Math.min(1, gap / LEVEL_ADVANTAGE_SATURATION);
  return attacker === "player" ? 1 + 0.55 * t : 1 - 0.45 * t;
}

/**
 * Multiplicador de daño en combates de la aventura. Jugador pega un poco más
 * fuerte; los salvajes un poco menos (sin anular tipos). Encima se compone la
 * ventaja por nivel, que a diferencia de la ayuda de onboarding no se apaga con
 * el nivel del jugador: mientras le saque niveles al rival, la ventaja vale.
 */
export function earlyGamePowerMultiplier(
  playerLevel: number,
  wildLevel: number,
  attacker: "player" | "wild",
  mode: EarlyGameBattleMode,
): number {
  const byLevel = levelAdvantageMultiplier(playerLevel, wildLevel, attacker);
  const t = earlyGameProgress(playerLevel);
  // El entrenador de ruta cobra la ventaja de nivel y nada más.
  if (t <= 0 || mode === "trainer") return byLevel;

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

/**
 * Cuántos niveles puede quedar el salvaje por debajo del líder antes de que la
 * zona lo levante sola.
 */
export const WILD_LEVEL_CATCHUP_GAP = 3;

/**
 * Sube el salvaje hacia el nivel del líder **sin pasarse del techo de la zona**.
 *
 * El problema reportado: para llegar a Misty hay que subir de 16 a 19, pero las
 * zonas disponibles hasta ahí escupen rivales Nv.10-14. Como la XP crece con el
 * nivel del vencido y el costo del nivel siguiente crece al cubo, farmear ahí
 * es tiempo muerto. Anclar el piso del rango al jugador no hace la zona más
 * difícil que su diseño (nunca supera `levelMax`) y además hace que lo que se
 * captura sirva.
 */
export function raiseWildLevelForPlayer(
  wildLevel: number,
  playerLevel: number,
  zoneLevelMax: number,
): number {
  const floor = Math.min(zoneLevelMax, playerLevel - WILD_LEVEL_CATCHUP_GAP);
  return Math.max(wildLevel, floor);
}
