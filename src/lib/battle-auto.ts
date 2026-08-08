// Preferencia de auto-batalla: el cliente elige movimientos (y targets en
// dobles) sin tocar el menú. Persiste como la velocidad de animación.
//
// Gate de progresión: se desbloquea con ≥3 Pokémon a nivel ≥10 (equipo + PC).
// Antes de eso el toggle está apagado y no corre el loop automático.

const STORAGE_KEY = "battle-auto";

/** Nivel mínimo por Pokémon para desbloquear AUTO. */
export const BATTLE_AUTO_UNLOCK_LEVEL = 10;
/** Cuántos Pokémon a ese nivel hacen falta. */
export const BATTLE_AUTO_UNLOCK_COUNT = 3;

let current = false;
let hydrated = false;
const listeners = new Set<() => void>();

/**
 * ¿El jugador ya puede usar auto-batalla?
 * Cuenta cualquier `PokemonInstance` propio (equipo o PC).
 */
export function isBattleAutoUnlocked(levels: Iterable<number>): boolean {
  let n = 0;
  for (const level of levels) {
    if (level >= BATTLE_AUTO_UNLOCK_LEVEL) {
      n += 1;
      if (n >= BATTLE_AUTO_UNLOCK_COUNT) return true;
    }
  }
  return false;
}

/** Snapshot cliente — hidrata desde localStorage en la primera lectura. */
export function getBattleAuto(): boolean {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      current = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // localStorage bloqueado: seguimos en off.
    }
  }
  return current;
}

/** En el servidor no hay preferencia: siempre off (evita mismatch de hidratación). */
export function getServerBattleAuto(): boolean {
  return false;
}

export function setBattleAuto(on: boolean) {
  current = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // Sin persistencia; la sesión actual igual respeta el toggle.
  }
  for (const listener of listeners) listener();
}

export function toggleBattleAuto(): boolean {
  const next = !getBattleAuto();
  setBattleAuto(next);
  return next;
}

export function subscribeBattleAuto(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
