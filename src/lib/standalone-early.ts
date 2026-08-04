/**
 * Detecta PWA anclada y marca el documento ANTES del primer paint.
 *
 * El salto al refrescar venía de:
 * 1. Re-medir `env(safe-area-inset-bottom)` (parpadea 0→34px en iOS).
 * 2. Critical CSS atado a `html.is-standalone`, que React pisa al hidratar
 *    `className` del <html> un frame.
 *
 * El offset (34px) vive fijo en CSS (`globals.css` + `<style>` del layout)
 * con `@media (display-mode: standalone)` — no depende de JS ni de la clase.
 * Este script sólo agrega `is-standalone` (Safari viejo / navigator.standalone)
 * y clava la CSS var por si algo la lee.
 */
export const STANDALONE_SAT_BOTTOM_PX = 34;

/** CSS crítico del layout (<style id="standalone-nav-critical">). */
export function standaloneNavCriticalCss(): string {
  const sat = STANDALONE_SAT_BOTTOM_PX;
  return [
    `@media all and (display-mode: standalone){`,
    `.mobile-bottom-nav{bottom:-${sat}px!important;padding-bottom:${sat}px!important;margin-bottom:0!important;background-color:#0a0b11!important;}`,
    `.mobile-bottom-nav__dock{padding-bottom:.4rem!important;}`,
    `}`,
    `html.is-standalone .mobile-bottom-nav{bottom:-${sat}px!important;padding-bottom:${sat}px!important;margin-bottom:0!important;background-color:#0a0b11!important;}`,
    `html.is-standalone .mobile-bottom-nav__dock{padding-bottom:.4rem!important;}`,
  ].join("");
}

export function standaloneEarlyScript(): string {
  const sat = STANDALONE_SAT_BOTTOM_PX;
  return `(function(){try{var s=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||!!(window.navigator&&window.navigator.standalone);if(!s)return;var h=document.documentElement;h.classList.add("is-standalone");h.style.setProperty("--standalone-sat-bottom","${sat}px");function body(){if(document.body)document.body.classList.add("is-standalone");}body();if(!document.body)document.addEventListener("DOMContentLoaded",body);window.addEventListener("pageshow",function(){h.classList.add("is-standalone");body();h.style.setProperty("--standalone-sat-bottom","${sat}px");});}catch(e){}})();`;
}
