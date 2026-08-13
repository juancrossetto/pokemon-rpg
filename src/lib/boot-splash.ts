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

/** Labels del splash sin pasar por next-intl (el layout no debe esperar mensajes). */
export const BOOT_SPLASH_LABELS: Record<string, string> = {
  es: "Cargando",
  en: "Loading",
  pt: "Carregando",
};

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
 * El splash se pinta siempre igual. Lo oculta `html.boot-splash-done`
 * (SSR + script de `<head>` si el warmup ya corrió). `--out` lo agrega
 * el warmup al cerrar, no React — así no hay mismatch de hidratación.
 */
export function bootSplashCriticalCss(): string {
  const bg = BOOT_SPLASH_BG;
  return [
    `:root{color-scheme:dark;}`,
    `html,body{background:${bg}!important;margin:0;}`,
    `.boot-splash{position:fixed;inset:0;z-index:9999;display:flex;`,
    `flex-direction:column;background:${bg};opacity:1;visibility:visible;pointer-events:auto;}`,
    `html.boot-splash-done .boot-splash,`,
    `.boot-splash.boot-splash--out{opacity:0!important;visibility:hidden!important;pointer-events:none!important;}`,
    `.boot-splash__mobile,.boot-splash__desktop{position:absolute;inset:0;display:flex;flex-direction:column;}`,
    `.boot-splash__mobile{display:flex;}`,
    `.boot-splash__desktop{display:none;align-items:center;justify-content:center;background:${bg};}`,
    `@media (min-width:1280px){.boot-splash__mobile{display:none;}.boot-splash__desktop{display:flex;}}`,
    `.boot-splash__art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center center;}`,
    `.boot-splash__poster{z-index:0;}`,
    `.boot-splash__video{z-index:1;background:${bg};}`,
    `.boot-splash__pokeball{position:relative;z-index:1;width:min(360px,42vw);height:auto;object-fit:contain;}`,
    `.boot-splash__shade{position:absolute;left:0;right:0;bottom:0;height:46%;z-index:2;`,
    `background:linear-gradient(to top,rgba(0,0,0,.88) 0%,rgba(0,0,0,.45) 45%,transparent 100%);pointer-events:none;}`,
    `.boot-splash__footer{position:relative;z-index:3;margin-top:auto;display:flex;flex-direction:column;align-items:center;`,
    `padding:max(1.25rem,env(safe-area-inset-bottom)) 1.5rem max(1.65rem,env(safe-area-inset-bottom));}`,
    `.boot-splash__footer--desktop{position:absolute;left:0;right:0;bottom:0;margin-top:0;padding:1.75rem 2.5rem 2rem;}`,
    `.boot-splash__logo{display:block;width:min(11.5rem,52vw);height:auto;margin:0 auto .95rem;object-fit:contain;`,
    `filter:drop-shadow(0 4px 18px rgba(0,0,0,.55));}`,
    `.boot-splash__meta{display:flex;align-items:baseline;justify-content:space-between;gap:.75rem;width:100%;margin-bottom:.7rem;}`,
    `.boot-splash__label{font:650 13px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.82);}`,
    `.boot-splash__pct{font:700 22px/1 ui-monospace,monospace;letter-spacing:.02em;color:#fff;`,
    `text-shadow:0 1px 10px rgba(0,0,0,.55);font-variant-numeric:tabular-nums;}`,
    `.boot-splash__track{width:100%;height:8px;border-radius:999px;background:rgba(255,255,255,.18);overflow:hidden;`,
    `box-shadow:inset 0 1px 2px rgba(0,0,0,.35);}`,
    `.boot-splash__fill{height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#f43f5e,#e879f9);`,
    `box-shadow:0 0 14px rgba(232,121,249,.55);}`,
    `@media (prefers-reduced-motion:reduce){.boot-splash__video{display:none;}}`,
  ].join("");
}

/**
 * Corre en `<head>` antes del paint.
 * - Login/register o warmup ya hecho → marcar done (splash oculto).
 * - Cold start → pending; el reveal post-markup quita `--out` del nodo.
 */
export function bootSplashEarlyScript(): string {
  return `(function(){try{
var html=document.documentElement;
var warm=${JSON.stringify(NAV_WARMUP_DONE_KEY)};
var path=location.pathname||'';
if(/\\/(login|register)(\\/|$)/.test(path)||sessionStorage.getItem(warm)==='1'){
html.classList.add('boot-splash-done');
html.classList.remove('boot-splash-pending');
return;
}
html.classList.add('boot-splash-pending');
html.classList.remove('boot-splash-done');
}catch(e){}})();`;
}

/**
 * Justo debajo del markup del splash. No toca class/aria del nodo (eso
 * pelearía la hidratación). En cold start reproduce el video; si el
 * warmup ya corrió, sólo confirma `html.boot-splash-done`.
 */
export function bootSplashRevealScript(): string {
  return `(function(){try{
var html=document.documentElement;
var warm=${JSON.stringify(NAV_WARMUP_DONE_KEY)};
var path=location.pathname||'';
var splash=document.getElementById('boot-splash');
if(/\\/(login|register)(\\/|$)/.test(path)||sessionStorage.getItem(warm)==='1'){
html.classList.add('boot-splash-done');
html.classList.remove('boot-splash-pending');
return;
}
html.classList.add('boot-splash-pending');
html.classList.remove('boot-splash-done');
var video=splash&&splash.querySelector('video');
if(video){try{void video.play();}catch(e){}}
}catch(e){}})();`;
}
