/**
 * Zona para next-intl (`format.dateTime`, relative time, etc.).
 * El calendario de juego (diario/semanal/PvP) ya está en UTC — ver
 * `src/lib/events/time.ts` — así que el provider usa la misma, no la TZ
 * del runtime de Vercel/Node (que dispara ENVIRONMENT_FALLBACK).
 */
export const APP_TIME_ZONE = "UTC";
