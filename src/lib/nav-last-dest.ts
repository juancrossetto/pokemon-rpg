/**
 * Último destino visitado por grupo de la bottom bar mobile.
 * Así el primer toque de "Aventura" vuelve a Gimnasios si fue ahí la última vez,
 * en vez de siempre a Viaje.
 *
 * Excepción: `/tower` sólo se recuerda mientras haya un intento activo; si el
 * run terminó, Aventura vuelve a `/campaign`.
 */

const STORAGE_KEY = "poke-mobile-nav-last";

type LastMap = Record<string, string>;

function readMap(): LastMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: LastMap = {};
    for (const [k, v] of Object.entries(parsed as LastMap)) {
      if (typeof v === "string" && v.startsWith("/")) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function getLastNavHref(groupId: string): string | null {
  return readMap()[groupId] ?? null;
}

export function setLastNavHref(groupId: string, href: string): void {
  if (typeof window === "undefined") return;
  const clean = href.split("?")[0];
  if (!clean.startsWith("/")) return;
  try {
    const next = { ...readMap(), [groupId]: clean };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode — ignorar
  }
}
