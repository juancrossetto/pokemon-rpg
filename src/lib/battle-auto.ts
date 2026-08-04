// Preferencia de auto-batalla: el cliente elige movimientos (y targets en
// dobles) sin tocar el menú. Persiste como la velocidad de animación.

const STORAGE_KEY = "battle-auto";

let current = false;
let hydrated = false;
const listeners = new Set<() => void>();

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
