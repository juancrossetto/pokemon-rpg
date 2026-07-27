/**
 * Tiempo del juego para recompensas recurrentes.
 *
 * El proyecto no manejaba zonas horarias en ningún lado: la única referencia
 * de fecha era `setHours(0,0,0,0)` en `market-hub.ts`, que usa la hora local
 * del proceso. Eso alcanza para una estadística, pero no para decidir si un
 * regalo diario ya se cobró: si el servidor migra de región, el día cambia de
 * lugar y aparecen reclamos duplicados o bloqueados.
 *
 * Acá el criterio se fija de una vez y en un solo lugar: **UTC**. Todas las
 * claves de día y semana se derivan de la hora del servidor, nunca del
 * navegador — el cliente puede adelantar su reloj, el servidor no le cree.
 *
 * `RESET_HOUR_UTC` deja correr el reinicio si más adelante conviene alinearlo
 * a una franja horaria concreta (por ejemplo 04:00 UTC ≈ 01:00 en Argentina,
 * que cae en horario de poca actividad).
 */

/** Hora UTC en la que arranca el día de juego. 0 = medianoche UTC. */
export const RESET_HOUR_UTC = 0;

/** Momento actual del servidor. Único punto que lee el reloj. */
export function serverNow(): Date {
  return new Date();
}

/** Desplaza la fecha para que el "día de juego" arranque en `RESET_HOUR_UTC`. */
function shifted(at: Date): Date {
  return new Date(at.getTime() - RESET_HOUR_UTC * 60 * 60 * 1000);
}

/** Clave del día de juego en UTC: "2026-07-27". */
export function dayKey(at: Date = serverNow()): string {
  return shifted(at).toISOString().slice(0, 10);
}

/** Inicio del próximo día de juego, en tiempo real. */
export function nextDailyReset(at: Date = serverNow()): Date {
  const base = shifted(at);
  const next = Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + 1,
  );
  return new Date(next + RESET_HOUR_UTC * 60 * 60 * 1000);
}

/**
 * Clave de semana ISO en UTC: "2026-W31".
 *
 * Se usa la numeración ISO 8601 (semana que arranca el lunes, la semana 1 es
 * la que contiene el primer jueves del año) porque es la única definición sin
 * ambigüedad al cruzar el fin de año — con "semana = 7 días desde enero 1" la
 * última semana de diciembre y la primera de enero se pisan.
 */
export function weekKey(at: Date = serverNow()): string {
  const base = shifted(at);
  const date = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()),
  );
  // Jueves de esta semana: define a qué año ISO pertenece.
  const dayOfWeek = (date.getUTCDay() + 6) % 7; // lunes = 0
  date.setUTCDate(date.getUTCDate() - dayOfWeek + 3);
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayOfWeek = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayOfWeek + 3);
  const week =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** Inicio (lunes 00:00 del reset) de la semana de juego que contiene `at`. */
export function weekStart(at: Date = serverNow()): Date {
  const base = shifted(at);
  const dayOfWeek = (base.getUTCDay() + 6) % 7; // lunes = 0
  const start = Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() - dayOfWeek,
  );
  return new Date(start + RESET_HOUR_UTC * 60 * 60 * 1000);
}

/** Inicio de la próxima semana de juego. */
export function nextWeeklyReset(at: Date = serverNow()): Date {
  const start = weekStart(at);
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
}
