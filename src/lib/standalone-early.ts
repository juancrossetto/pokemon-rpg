/**
 * Detecta PWA anclada y fija la bottom nav ANTES del primer paint.
 *
 * En iOS standalone (icono del inicio) NO existe la barra de Safari. El
 * `bottom: 0` de un fixed cae en el borde *safe* (arriba del home indicator),
 * dejando el hueco negro. Empujamos con offset FIJO 34px + padding igual.
 *
 * El salto al refrescar/navegar venía de:
 * 1. `env(safe-area-inset-bottom)` parpadea 0→34 → no lo usamos.
 * 2. React al hidratar pisa `className` del <html> y saca `is-standalone`.
 * 3. El efecto de medición hacía `style.bottom = ""` y soltaba el anclaje.
 *
 * Mitigación: CSS fijo (`@media standalone` + clase) + var CSS + estilos
 * inline con !important clavados por el early script (MutationObserver) y
 * re-afirmados en MobileChrome antes de cada paint de navegación.
 */
export const STANDALONE_SAT_BOTTOM_PX = 34;

/** CSS crítico del layout (<style id="standalone-nav-critical">). */
export function standaloneNavCriticalCss(): string {
  const sat = STANDALONE_SAT_BOTTOM_PX;
  return [
    `:root{--standalone-sat-bottom:${sat}px;}`,
    `@media all and (display-mode: standalone){`,
    `.mobile-bottom-nav{bottom:-${sat}px!important;padding-bottom:${sat}px!important;margin-bottom:0!important;background-color:#0a0b11!important;}`,
    `.mobile-bottom-nav__dock{padding-bottom:.4rem!important;}`,
    `}`,
    `html.is-standalone .mobile-bottom-nav{bottom:-${sat}px!important;padding-bottom:${sat}px!important;margin-bottom:0!important;background-color:#0a0b11!important;}`,
    `html.is-standalone .mobile-bottom-nav__dock{padding-bottom:.4rem!important;}`,
  ].join("");
}

/** Aplica el anclaje inline (gana a casi cualquier pelea de especificidad). */
export function pinStandaloneNavElement(nav: HTMLElement, sat = STANDALONE_SAT_BOTTOM_PX): void {
  nav.style.setProperty("bottom", `-${sat}px`, "important");
  nav.style.setProperty("padding-bottom", `${sat}px`, "important");
  nav.style.setProperty("margin-bottom", "0px", "important");
  nav.style.setProperty("background-color", "#0a0b11", "important");
  const dock = nav.querySelector<HTMLElement>(".mobile-bottom-nav__dock");
  if (dock) {
    dock.style.setProperty("padding-bottom", "0.4rem", "important");
  }
}

export function standaloneEarlyScript(): string {
  const sat = STANDALONE_SAT_BOTTOM_PX;
  // Minificado a propósito: corre en <head> antes del primer paint.
  return `(function(){try{var sat=${sat};var s=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||!!(window.navigator&&window.navigator.standalone);if(!s)return;var h=document.documentElement;h.classList.add("is-standalone");h.style.setProperty("--standalone-sat-bottom",sat+"px");function body(){if(document.body)document.body.classList.add("is-standalone");}function pin(nav){if(!nav||nav.nodeType!==1)return;nav.style.setProperty("bottom","-"+sat+"px","important");nav.style.setProperty("padding-bottom",sat+"px","important");nav.style.setProperty("margin-bottom","0px","important");nav.style.setProperty("background-color","#0a0b11","important");var dock=nav.querySelector(".mobile-bottom-nav__dock");if(dock)dock.style.setProperty("padding-bottom",".4rem","important");}function pinAll(){var list=document.querySelectorAll(".mobile-bottom-nav");for(var i=0;i<list.length;i++)pin(list[i]);}body();pinAll();if(!document.body)document.addEventListener("DOMContentLoaded",function(){body();pinAll();});window.addEventListener("pageshow",function(){h.classList.add("is-standalone");body();h.style.setProperty("--standalone-sat-bottom",sat+"px");pinAll();});if(typeof MutationObserver!=="undefined"){var mo=new MutationObserver(function(muts){for(var i=0;i<muts.length;i++){var m=muts[i];if(m.type==="childList"){for(var j=0;j<m.addedNodes.length;j++){var n=m.addedNodes[j];if(n.nodeType!==1)continue;if(n.classList&&n.classList.contains("mobile-bottom-nav"))pin(n);else if(n.querySelectorAll){var found=n.querySelectorAll(".mobile-bottom-nav");for(var k=0;k<found.length;k++)pin(found[k]);}}}}});mo.observe(h,{childList:true,subtree:true});}}catch(e){}})();`;
}
