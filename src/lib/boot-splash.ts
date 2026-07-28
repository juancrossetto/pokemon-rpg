/** Flag de sesión: mostrar splash solo tras login/registro en mobile. */
export const BOOT_SPLASH_KEY = "poke-boot-splash";

/** Breakpoint desktop de la app (`xl` = 1280px). Debajo = mobile. */
export const BOOT_SPLASH_DESKTOP_MQ = "(min-width: 1280px)";

export function markBootSplashPending(): void {
  try {
    sessionStorage.setItem(BOOT_SPLASH_KEY, "1");
  } catch {
    /* private mode / SSR */
  }
}

export function peekBootSplashPending(): boolean {
  try {
    return sessionStorage.getItem(BOOT_SPLASH_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearBootSplashPending(): void {
  try {
    sessionStorage.removeItem(BOOT_SPLASH_KEY);
  } catch {
    /* ignore */
  }
}

export function isBootSplashDesktop(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia(BOOT_SPLASH_DESKTOP_MQ).matches;
}

/** Seguro para Server Components (layout). */
export function bootSplashEarlyScript(): string {
  return `(function(){try{var k=${JSON.stringify(BOOT_SPLASH_KEY)};if(sessionStorage.getItem(k)!=='1')return;if(window.matchMedia(${JSON.stringify(BOOT_SPLASH_DESKTOP_MQ)}).matches){sessionStorage.removeItem(k);return;}document.documentElement.classList.add('boot-splash-pending');}catch(e){}})();`;
}
