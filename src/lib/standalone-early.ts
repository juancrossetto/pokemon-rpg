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

/**
 * CSS crítico mínimo (clase + scroll). No toca la posición del nav.
 *
 * Body `position:fixed; inset:0` + `.app-main` con `flex:1 1 0%` es lo que
 * hace confiable el scroll en iOS PWA: sin eso, en algunos iPhone el body
 * crece con el contenido, `overflow:hidden` lo recorta y `.app-main` nunca
 * llega a scrollear (síntoma: “no puedo bajar en ninguna página”).
 */
export function standaloneNavCriticalCss(): string {
  return [
    `@media all and (display-mode: standalone){`,
    `html{height:100%;height:100dvh;overflow:hidden;overscroll-behavior:none;}`,
    `body{position:fixed;inset:0;width:100%;height:100%;height:100dvh;max-height:100dvh;min-height:0;overflow:hidden;overscroll-behavior:none;display:flex;flex-direction:column;}`,
    `.app-main{flex:1 1 0%;min-height:0;overflow-x:clip;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-y:none;touch-action:pan-y;}`,
    `}`,
    `html.is-standalone{height:100%;height:100dvh;overflow:hidden;overscroll-behavior:none;}`,
    `html.is-standalone body{position:fixed;inset:0;width:100%;height:100%;height:var(--app-vh,100dvh);max-height:var(--app-vh,100dvh);min-height:0;overflow:hidden;overscroll-behavior:none;display:flex;flex-direction:column;}`,
    `html.is-standalone .app-main{flex:1 1 0%;min-height:0;overflow-x:clip;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-y:none;touch-action:pan-y;}`,
  ].join("");
}

export function standaloneEarlyScript(): string {
  return `(function(){try{var s=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||!!(window.navigator&&window.navigator.standalone);if(!s)return;var h=document.documentElement;h.classList.add("is-standalone");function body(){if(document.body)document.body.classList.add("is-standalone");}body();if(!document.body)document.addEventListener("DOMContentLoaded",body);window.addEventListener("pageshow",function(){h.classList.add("is-standalone");body();});}catch(e){}})();`;
}
