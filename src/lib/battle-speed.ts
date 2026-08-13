// Velocidad de las animaciones de combate. Farmear en rutas implica repetir el
// mismo timeline decenas de veces, así que el jugador puede acelerarlo.
//
// El multiplicador divide las esperas del timeline (battle-arena) y, vía el
// atributo data-battle-speed en la raíz de la arena, acorta las animaciones CSS
// de un solo disparo. Las animaciones en bucle (badges de estado)
// quedan a 1x a propósito: aceleradas se ven frenéticas.

export const BATTLE_SPEEDS = [1, 2, 3] as const;
export type BattleSpeed = (typeof BATTLE_SPEEDS)[number];

const STORAGE_KEY = "battle-speed";

let current: BattleSpeed = 1;
let hydrated = false;
const listeners = new Set<() => void>();

function isBattleSpeed(value: number): value is BattleSpeed {
  return (BATTLE_SPEEDS as readonly number[]).includes(value);
}

/**
 * Snapshot para el cliente. La primera lectura adopta la preferencia guardada;
 * a partir de ahí devuelve el mismo valor hasta que alguien la cambie, que es
 * lo que `useSyncExternalStore` necesita para no re-renderizar en loop.
 */
export function getBattleSpeed(): BattleSpeed {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      const raw = Number(window.localStorage.getItem(STORAGE_KEY));
      if (isBattleSpeed(raw)) current = raw;
    } catch {
      // localStorage bloqueado (modo privado / permisos): seguimos en 1x.
    }
  }
  return current;
}

/** En el servidor no hay preferencia: siempre 1x. */
export function getServerBattleSpeed(): BattleSpeed {
  return 1;
}

export function setBattleSpeed(speed: BattleSpeed) {
  current = speed;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(speed));
  } catch {
    // Sin persistencia, pero la sesión actual igual respeta la elección.
  }
  for (const listener of listeners) listener();
}

/** Avanza 1x → 2x → 3x → 1x. */
export function nextBattleSpeed(speed: BattleSpeed): BattleSpeed {
  const index = BATTLE_SPEEDS.indexOf(speed);
  return BATTLE_SPEEDS[(index + 1) % BATTLE_SPEEDS.length]!;
}

export function subscribeBattleSpeed(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * AUTO comprime el timeline además de la velocidad elegida: misma pelea,
 * menos “lunge + banner” muertos entre golpes.
 */
let fxCompact = false;

export function setBattleFxCompact(on: boolean) {
  fxCompact = on;
}

export function getBattleFxCompact(): boolean {
  return fxCompact;
}

/**
 * Espera escalada por la velocidad elegida, con piso de ~1.5 frames: varias
 * pausas cortas del timeline existen para que el navegador alcance a pintar el
 * reset de una animación (el golpe 2 de un multi-hit no se ve si la clase no
 * se limpió antes). Acelerarlas a 13 ms rompía justamente eso.
 *
 * Con AUTO (`setBattleFxCompact(true)`) se aplica un extra ~1.65× encima
 * del multiplicador de velocidad.
 */
export function scaledDelay(ms: number): number {
  if (ms <= 0) return 0;
  const div = current * (fxCompact ? 1.65 : 1);
  return Math.max(24, Math.round(ms / div));
}
