// Límite de tasa en memoria del proceso. Alcanza para frenar el spam de un
// jugador (doble click, tab duplicada, script casero) en el despliegue de una
// sola instancia del MVP. Cuando entre Redis —fase 4 del dossier, para el
// matchmaking PvP— esto se mueve ahí y pasa a ser global al cluster.

type Window = { hits: number[]; expiresAt: number };

const windows = new Map<string, Window>();
const MAX_TRACKED_KEYS = 5_000;

function prune(now: number): void {
  for (const [key, window] of windows) {
    if (window.expiresAt <= now) windows.delete(key);
  }
}

/**
 * Registra un intento y devuelve `false` si la clave superó el límite.
 * `key` debe incluir la acción y el jugador, ej. `market:buy:<userId>`.
 */
export function allowAction(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (windows.size > MAX_TRACKED_KEYS) prune(now);

  const hits = (windows.get(key)?.hits ?? []).filter((at) => now - at < windowMs);
  if (hits.length >= limit) {
    windows.set(key, { hits, expiresAt: hits[0] + windowMs });
    return false;
  }

  hits.push(now);
  windows.set(key, { hits, expiresAt: now + windowMs });
  return true;
}
