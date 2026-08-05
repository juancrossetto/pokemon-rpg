/**
 * Detecta PWA anclada (icono del inicio) y marca el documento.
 *
 * IMPORTANTE: el bottom nav debe quedar siempre en `bottom: 0`. Nunca usar
 * offset negativo ni `--standalone-sat-bottom` para mover el `bottom` — eso
 * es lo que hacía saltar / subir el menú al refrescar (la var pasaba 0↔34).
 *
 * Este script sólo agrega `is-standalone` para el CSS de scroll
 * (overflow hidden → scroll en `.app-main`).
 */
export const STANDALONE_SAT_BOTTOM_PX = 34;

/** CSS crítico mínimo (clase + scroll). No toca la posición del nav. */
export function standaloneNavCriticalCss(): string {
  return [
    `@media all and (display-mode: standalone){`,
    `html{height:100%;height:-webkit-fill-available;overflow:hidden;}`,
    `body{min-height:100%;min-height:-webkit-fill-available;height:100%;overflow:hidden;}`,
    `}`,
    `html.is-standalone{height:100%;height:-webkit-fill-available;overflow:hidden;}`,
    `html.is-standalone body{min-height:100%;min-height:-webkit-fill-available;height:100%;overflow:hidden;}`,
  ].join("");
}

export function standaloneEarlyScript(): string {
  return `(function(){try{var s=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||!!(window.navigator&&window.navigator.standalone);if(!s)return;var h=document.documentElement;h.classList.add("is-standalone");function body(){if(document.body)document.body.classList.add("is-standalone");}body();if(!document.body)document.addEventListener("DOMContentLoaded",body);window.addEventListener("pageshow",function(){h.classList.add("is-standalone");body();});}catch(e){}})();`;
}
