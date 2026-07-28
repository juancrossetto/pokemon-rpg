/** Persiste el drawer mobile al cambiar de locale (remonta el layout). */
export const MOBILE_NAV_DRAWER_KEY = "poke-mobile-nav-drawer";

export function markMobileNavDrawerOpen(): void {
  try {
    sessionStorage.setItem(MOBILE_NAV_DRAWER_KEY, "1");
  } catch {
    /* private mode / SSR */
  }
}

export function consumeMobileNavDrawerOpen(): boolean {
  try {
    if (sessionStorage.getItem(MOBILE_NAV_DRAWER_KEY) !== "1") return false;
    sessionStorage.removeItem(MOBILE_NAV_DRAWER_KEY);
    return true;
  } catch {
    return false;
  }
}
