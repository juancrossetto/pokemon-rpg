/**
 * Reloj de decisión en combate: si el jugador no elige acción a tiempo,
 * la batalla se cierra por inactividad (como en juegos por turnos).
 *
 * Sólo aplica a PvP. En salvaje / gym / torre / clan war no hay timer:
 * el jugador puede tomarse el tiempo que quiera.
 */

/** 60s de decisión por turno de jugador (PvP). */
export const BATTLE_TURN_IDLE_MS = 60_000;

export function nextTurnDeadline(from: Date = new Date()): Date {
  return new Date(from.getTime() + BATTLE_TURN_IDLE_MS);
}

/** ¿Esta batalla usa reloj de turno? Sólo ranked/match PvP. */
export function battleUsesTurnTimer(battle: {
  pvpMatchId?: string | null;
}): boolean {
  return Boolean(battle.pvpMatchId);
}

/** Deadline si el modo lo usa; `null` en salvaje/gym/etc. */
export function turnDeadlineForBattle(
  battle: { pvpMatchId?: string | null },
  from: Date = new Date(),
): Date | null {
  return battleUsesTurnTimer(battle) ? nextTurnDeadline(from) : null;
}

export function isTurnExpired(
  deadline: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!deadline) return false;
  return now.getTime() >= deadline.getTime();
}

/** Patch para resets de deadline cuando el control vuelve al jugador. */
export function turnDeadlinePatch(
  battle: { pvpMatchId?: string | null },
  from: Date = new Date(),
) {
  return { turnDeadlineAt: turnDeadlineForBattle(battle, from) };
}
