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

const DISTRIBUTED_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
return current
`;
let lastDistributedWarningAt = 0;

async function distributedHit(key: string, windowMs: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      "EVAL",
      DISTRIBUTED_SCRIPT,
      "1",
      `pokerpg:rate:${key}`,
      String(windowMs),
    ]),
    cache: "no-store",
    signal: AbortSignal.timeout(1_500),
  });
  const payload = (await response.json()) as { result?: number; error?: string };
  if (!response.ok || payload.error || typeof payload.result !== "number") {
    throw new Error(payload.error ?? `redis_${response.status}`);
  }
  return payload.result;
}

/**
 * Igual que `allowAction` pero con el presupuesto de la familia y la clave ya
 * compuesta con el jugador. `action` identifica el punto concreto (`claim:daily`)
 * para que dos acciones de la misma familia no compartan cupo.
 */
export async function allowUserAction(
  kind: ActionRateKind,
  action: string,
  userId: string,
): Promise<boolean> {
  const { limit, windowMs } = ACTION_RATE_LIMITS[kind];
  const key = `${action}:${userId}`;
  // El filtro local evita una llamada remota cuando esta misma instancia ya
  // sabe que el cupo se agotó. Redis agrega la garantía entre réplicas.
  if (!allowAction(key, limit, windowMs)) return false;
  try {
    const distributedCount = await distributedHit(key, windowMs);
    return distributedCount === null || distributedCount <= limit;
  } catch (error) {
    // La protección local sigue activa si Redis tiene una caída. No se bloquea
    // el juego por una dependencia auxiliar, y el warning se limita a uno/min.
    const now = Date.now();
    if (now - lastDistributedWarningAt >= 60_000) {
      lastDistributedWarningAt = now;
      console.warn("[rate-limit] distributed fallback", error);
    }
    return true;
  }
}
