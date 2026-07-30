/**
 * Ciclo semanal de la Torre.
 *
 * Reinicio: domingos 21:00 America/Argentina/Buenos_Aires (UTC−3 todo el año).
 * Un solo ascenso por período: al fallir/completar/abandonar, el CTA queda
 * bloqueado hasta el próximo domingo 21hs.
 */

export const TOWER_TZ = "America/Argentina/Buenos_Aires";
/** Domingo = 0 en el calendario local ART. */
export const TOWER_RESET_WEEKDAY = 0;
export const TOWER_RESET_HOUR = 21;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0=domingo … 6=sábado
};

function zonedParts(at: Date, timeZone = TOWER_TZ): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(at)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}

/** Instant UTC que corresponde a Y-M-D H:00 en ART. */
function artLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
): Date {
  // ART = UTC−3 fijo → UTC = local + 3h.
  return new Date(Date.UTC(year, month - 1, day, hour + 3, 0, 0, 0));
}

function addDaysArt(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const utc = Date.UTC(year, month - 1, day + delta);
  const d = new Date(utc);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/** Inicio del período actual (último domingo 21:00 ART ≤ now). */
export function currentTowerPeriodStart(at: Date = new Date()): Date {
  const z = zonedParts(at);
  let daysSinceSunday = z.weekday - TOWER_RESET_WEEKDAY;
  if (daysSinceSunday < 0) daysSinceSunday += 7;

  let anchor = addDaysArt(z.year, z.month, z.day, -daysSinceSunday);
  let start = artLocalToUtc(anchor.year, anchor.month, anchor.day, TOWER_RESET_HOUR);

  // Si aún no llegamos al domingo 21hs de esta semana calendario, el período
  // empezó el domingo anterior.
  if (at.getTime() < start.getTime()) {
    anchor = addDaysArt(anchor.year, anchor.month, anchor.day, -7);
    start = artLocalToUtc(anchor.year, anchor.month, anchor.day, TOWER_RESET_HOUR);
  }
  return start;
}

/** Próximo domingo 21:00 ART estrictamente después de `at` (o el actual si falta). */
export function nextTowerReset(at: Date = new Date()): Date {
  const start = currentTowerPeriodStart(at);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (at.getTime() < end.getTime()) return end;
  return new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000);
}

/** Clave estable del período: fecha ART del domingo de reinicio. */
export function towerPeriodKey(at: Date = new Date()): string {
  const start = currentTowerPeriodStart(at);
  const z = zonedParts(start);
  return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
}

export function msUntilTowerReset(at: Date = new Date()): number {
  return Math.max(0, nextTowerReset(at).getTime() - at.getTime());
}
