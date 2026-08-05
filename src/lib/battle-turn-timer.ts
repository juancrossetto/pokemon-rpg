/**
 * Reloj de decisión en combate: si el jugador no elige acción a tiempo,
 * la batalla se cierra por inactividad (como en juegos por turnos).
 */

/** 60s de decisión por turno de jugador. */
export const BATTLE_TURN_IDLE_MS = 60_000;

export function nextTurnDeadline(from: Date = new Date()): Date {
  return new Date(from.getTime() + BATTLE_TURN_IDLE_MS);
}

export function isTurnExpired(
  deadline: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!deadline) return false;
  return now.getTime() >= deadline.getTime();
}

/** Patch para resets de deadline cuando el control vuelve al jugador. */
export function turnDeadlinePatch(from: Date = new Date()) {
  return { turnDeadlineAt: nextTurnDeadline(from) };
}
