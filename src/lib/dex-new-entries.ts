/**
 * "Especies registradas desde la última visita" para el sello NUEVO de la
 * Pokédex.
 *
 * Módulo puro y sin Prisma a propósito: lo consume `pokedex-terminal.tsx`, que
 * es un Client Component (ver la nota de módulos puros en AGENTS.md). El
 * server no guarda cuándo se miró la Pokédex y no vale una columna nueva sólo
 * para esto, así que el "antes" vive en localStorage.
 */

export const DEX_SEEN_CAUGHT_KEY = "pokerpg:dex-seen-caught";

/**
 * Ids capturados que no estaban en la visita anterior.
 *
 * `previous === null` es la primera visita (o storage ilegible): devuelve
 * vacío en vez de marcar la colección entera como nueva, que era el defecto
 * del pulso original — salía en todas las capturadas en cada carga.
 */
export function diffNewlyCaught(previous: number[] | null | undefined, current: number[]): number[] {
  if (!Array.isArray(previous)) return [];
  const before = new Set(previous);
  return current.filter((id) => !before.has(id));
}

/** Lee la foto anterior. `null` si no hay o si el contenido no sirve. */
export function readDexSeenCaught(): number[] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEX_SEEN_CAUGHT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as number[]) : null;
  } catch {
    // Modo privado o JSON corrupto: se trata como primera visita.
    return null;
  }
}

/** Persiste la foto actual. Silencioso si el storage no está disponible. */
export function markDexEntriesSeen(ids: number[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DEX_SEEN_CAUGHT_KEY, JSON.stringify(ids));
  } catch {
    /* private mode */
  }
}
