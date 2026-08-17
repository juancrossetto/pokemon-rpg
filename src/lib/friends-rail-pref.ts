/**
 * Preferencia de la columna flotante de amigos.
 *
 * Default encendido. El apagado es manual y vive en `sessionStorage`: dura
 * mientras el tab está abierto, y un login nuevo vuelve a mostrar las burbujas.
 */

const STORAGE_KEY = "friends-rail-visible";

export const FRIENDS_RAIL_PREF_EVENT = "friends-rail-pref";

function dropLegacyLocalStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function readFriendsRailVisible(): boolean {
  if (typeof window === "undefined") return true;
  dropLegacyLocalStorage();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

export function writeFriendsRailVisible(visible: boolean): void {
  dropLegacyLocalStorage();
  try {
    window.sessionStorage.setItem(STORAGE_KEY, visible ? "1" : "0");
  } catch {
    /* sessionStorage bloqueado: el toggle sigue andando en esta sesión. */
  }
  window.dispatchEvent(new Event(FRIENDS_RAIL_PREF_EVENT));
}
