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

/**
 * Presupuestos por familia de acción.
 *
 * El límite estaba sólo en las acciones sociales (mercado, clanes, PvP,
 * amigos), que son las que un jugador puede usar para molestar a otro. Pero
 * las que **otorgan recursos** —reclamos, compras, recompensas de zona— no
 * tenían ninguno, y ahí el daño es a la economía: un reintento en bucle no
 * duplica nada gracias a las guardas atómicas, pero sí puede martillar la base
 * gratis.
 *
 * Los números están holgados a propósito: tienen que ser invisibles jugando a
 * mano (nadie reclama veinte recompensas por minuto) y frenar el bucle.
 */
export const ACTION_RATE_LIMITS = {
  /** Reclamos de recompensa: diaria, semanal, evento, logro, zona, incursión. */
  claim: { limit: 20, windowMs: 60_000 },
  /** Compras con monedas o gemas. */
  purchase: { limit: 30, windowMs: 60_000 },
  /** Arranque de combates (salvaje, gimnasio, torre, incursión). */
  battleStart: { limit: 40, windowMs: 60_000 },
  /** Curación fuera de combate. */
  heal: { limit: 30, windowMs: 60_000 },
} as const;

export type ActionRateKind = keyof typeof ACTION_RATE_LIMITS;

/**
 * Igual que `allowAction` pero con el presupuesto de la familia y la clave ya
 * compuesta con el jugador. `action` identifica el punto concreto (`claim:daily`)
 * para que dos acciones de la misma familia no compartan cupo.
 */
export function allowUserAction(
  kind: ActionRateKind,
  action: string,
  userId: string,
): boolean {
  const { limit, windowMs } = ACTION_RATE_LIMITS[kind];
  return allowAction(`${action}:${userId}`, limit, windowMs);
}
