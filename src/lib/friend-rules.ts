/**
 * Reglas del grafo social. Sin Prisma — importable desde cliente si hace falta.
 */

/** Máximo de amigos por entrenador (escalable más adelante). */
export const FRIEND_MAX = 200;

/** Máximo de solicitudes salientes pendientes. */
export const FRIEND_REQUEST_OUT_MAX = 40;

/** Ventanas de presencia (ms). */
export const PRESENCE_ONLINE_MS = 5 * 60 * 1000;
export const PRESENCE_EXPLORING_MS = 15 * 60 * 1000;
export const PRESENCE_AWAY_MS = 30 * 60 * 1000;

/** Heartbeat del hub Friends. */
export const PRESENCE_HEARTBEAT_MS = 60_000;

/** Orden canónico de una pareja de ids (evita filas duplicadas). */
export function friendshipPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
