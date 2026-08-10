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
 *
 * La altura del body sale SOLO de `inset:0`. Antes se la pisaba con
 * `height/max-height: var(--app-vh)` (= `window.innerHeight`), que es una
 * contradicción: `inset:0` ya da el viewport exacto y ese clamp sólo puede
 * achicarlo. En iOS standalone con `viewport-fit=cover`, `innerHeight` no
 * siempre incluye las safe areas, así que el body quedaba más corto que la
 * pantalla y el dock —anclado al borde inferior de esa caja— aparecía
 * flotando con una banda negra debajo.
 *
 * `--app-vh` se sigue publicando y lo siguen usando quienes necesitan la
 * medida de `innerHeight` para su propio alto (pantalla de batalla, sheets,
 * overlay de resultado). Lo que ya no hace es definir la caja del body.
 */
export function standaloneNavCriticalCss(): string {
  const bodyBox =
    "position:fixed;inset:0;width:100%;height:100%;min-height:100%;" +
    "overflow:hidden;overscroll-behavior:none;display:flex;flex-direction:column;";
  const appMain =
    "flex:1 1 0%;min-height:0;overflow-x:clip;overflow-y:auto;" +
    "-webkit-overflow-scrolling:touch;overscroll-behavior-y:none;touch-action:pan-y;";

  return [
    `@media all and (display-mode: standalone){`,
    `html{height:100%;height:100dvh;overflow:hidden;overscroll-behavior:none;}`,
    `body{${bodyBox}}`,
    `.app-main{${appMain}}`,
    `}`,
    `html.is-standalone{height:100%;height:100dvh;overflow:hidden;overscroll-behavior:none;}`,
    `html.is-standalone body{${bodyBox}}`,
    `html.is-standalone .app-main{${appMain}}`,
  ].join("");
}

export function standaloneEarlyScript(): string {
  return `(function(){try{var s=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||!!(window.navigator&&window.navigator.standalone);if(!s)return;var h=document.documentElement;h.classList.add("is-standalone");function body(){if(document.body)document.body.classList.add("is-standalone");}body();if(!document.body)document.addEventListener("DOMContentLoaded",body);window.addEventListener("pageshow",function(){h.classList.add("is-standalone");body();});}catch(e){}})();`;
}
