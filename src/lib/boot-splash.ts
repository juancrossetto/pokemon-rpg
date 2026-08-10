/** Flag post-login: fuerza splash en el siguiente paint (mobile). */
export const BOOT_SPLASH_KEY = "poke-boot-splash";

/**
 * Warmup de pantallas de la sesión ya hecho. Si está, no bloqueamos con
 * splash al reabrir rutas dentro de la misma pestaña.
 */
export const NAV_WARMUP_DONE_KEY = "poke-nav-warmup-done";

/** Breakpoint desktop de la app (`xl` = 1280px). Debajo = mobile. */
export const BOOT_SPLASH_DESKTOP_MQ = "(min-width: 1280px)";

/** Cookies típicas de Auth.js v5 (dev y prod). */
const SESSION_COOKIE_HINTS = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

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

export function markNavWarmupDone(): void {
  try {
    sessionStorage.setItem(NAV_WARMUP_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function peekNavWarmupDone(): boolean {
  try {
    return sessionStorage.getItem(NAV_WARMUP_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isBootSplashDesktop(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia(BOOT_SPLASH_DESKTOP_MQ).matches;
}

export function hasAuthSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  const raw = document.cookie;
  return SESSION_COOKIE_HINTS.some((name) => raw.includes(`${name}=`));
}

/** Fondo del splash. Mismo tono que `viewport.themeColor` y `.boot-splash`. */
export const BOOT_SPLASH_BG = "#0a0806";

/**
 * CSS crítico del arranque, inline en el `<head>`.
 *
 * El script de arriba marca `boot-splash-pending` antes del primer paint, pero
 * las reglas de `.boot-splash` viven en `globals.css`, que es una hoja externa:
 * entre el primer paint y que esa hoja llegue, el documento no tiene fondo y el
 * navegador pinta su lienzo por defecto — el destello blanco al abrir la app.
 *
 * Inline no depende de la red, así que lo primero que se ve ya es el splash y
 * no un flash. `color-scheme: dark` es lo que además evita que el UA pinte en
 * claro el lienzo, los scrollbars y los controles antes de aplicar nada.
 */
export function bootSplashCriticalCss(): string {
  return [
    `:root{color-scheme:dark;}`,
    `html{background:${BOOT_SPLASH_BG};}`,
    `body{background:${BOOT_SPLASH_BG};}`,
    `.boot-splash{position:fixed;inset:0;z-index:9999;display:none;`,
    `flex-direction:column;background:${BOOT_SPLASH_BG};}`,
    `html.boot-splash-pending .boot-splash{display:flex;opacity:1;visibility:visible;}`,
  ].join("");
}

/**
 * Seguro para Server Components (layout).
 * Muestra el splash antes del paint si la sesión aún no calentó las rutas
 * (post-login o cookie de sesión) y no estamos en login/register.
 */
export function bootSplashEarlyScript(): string {
  return `(function(){try{
var warm=${JSON.stringify(NAV_WARMUP_DONE_KEY)};
if(sessionStorage.getItem(warm)==='1')return;
var path=location.pathname||'';
if(/\\/(login|register)(\\/|$)/.test(path))return;
var post=sessionStorage.getItem(${JSON.stringify(BOOT_SPLASH_KEY)})==='1';
var cookie=document.cookie||'';
var authed=${JSON.stringify(SESSION_COOKIE_HINTS)}.some(function(n){return cookie.indexOf(n+'=')!==-1;});
if(!post&&!authed)return;
document.documentElement.classList.add('boot-splash-pending');
}catch(e){}})();`;
}
