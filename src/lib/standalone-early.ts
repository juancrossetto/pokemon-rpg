/**
 * Detecta PWA anclada y fija la bottom nav ANTES del primer paint.
 *
 * En iOS standalone no hay barra de Safari: `bottom: 0` cae en el borde safe.
 * Usamos `--standalone-sat-bottom` (0 en browser, 34px en standalone) — nunca
 * `env()`, que al refrescar parpadea 0→34 y hace saltar el menú.
 *
 * Anti-salto al refrescar:
 * 1. Early script inyecta el <style> crítico al parsear el <head>.
 * 2. Setea la CSS var en <html> antes de que exista el nav.
 * 3. El nav base siempre lee `bottom: calc(-1 * var(--standalone-sat-bottom))`.
 * 4. En standalone queda `visibility:hidden` hasta `data-sat-pinned` para no
 *    mostrar un frame mal anclado si el media query llega tarde.
 */
export const STANDALONE_SAT_BOTTOM_PX = 34;

/** CSS crítico: early script + <style> del layout (mismo texto). */
export function standaloneNavCriticalCss(): string {
  const sat = STANDALONE_SAT_BOTTOM_PX;
  return [
    `:root{--standalone-sat-bottom:0px;}`,
    `@media all and (display-mode: standalone){`,
    `:root{--standalone-sat-bottom:${sat}px;}`,
    `.mobile-bottom-nav{visibility:hidden;}`,
    `.mobile-bottom-nav[data-sat-pinned]{visibility:visible;}`,
    `.mobile-bottom-nav__dock{padding-bottom:.4rem!important;}`,
    `}`,
    `html.is-standalone{--standalone-sat-bottom:${sat}px;}`,
    `html.is-standalone .mobile-bottom-nav{visibility:hidden;}`,
    `html.is-standalone .mobile-bottom-nav[data-sat-pinned]{visibility:visible;}`,
    `html.is-standalone .mobile-bottom-nav__dock{padding-bottom:.4rem!important;}`,
  ].join("");
}

/** Aplica el anclaje inline + marca pinned (hace visible el nav en standalone). */
export function pinStandaloneNavElement(nav: HTMLElement, sat = STANDALONE_SAT_BOTTOM_PX): void {
  nav.style.setProperty("bottom", `-${sat}px`, "important");
  nav.style.setProperty("padding-bottom", `${sat}px`, "important");
  nav.style.setProperty("margin-bottom", "0px", "important");
  nav.style.setProperty("background-color", "#0a0b11", "important");
  nav.style.setProperty("visibility", "visible", "important");
  nav.setAttribute("data-sat-pinned", "1");
  const dock = nav.querySelector<HTMLElement>(".mobile-bottom-nav__dock");
  if (dock) {
    dock.style.setProperty("padding-bottom", "0.4rem", "important");
  }
}

export function standaloneEarlyScript(): string {
  const sat = STANDALONE_SAT_BOTTOM_PX;
  const cssJson = JSON.stringify(standaloneNavCriticalCss());
  return `(function(){try{var sat=${sat};var css=${cssJson};var doc=document;var html=doc.documentElement;var head=doc.head||html;if(!doc.getElementById("standalone-nav-critical-early")){var st=doc.createElement("style");st.id="standalone-nav-critical-early";st.textContent=css;head.insertBefore(st,head.firstChild);}var standalone=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||!!(window.navigator&&window.navigator.standalone);if(!standalone)return;html.classList.add("is-standalone");html.style.setProperty("--standalone-sat-bottom",sat+"px");function body(){if(doc.body)doc.body.classList.add("is-standalone");}function pin(nav){if(!nav||nav.nodeType!==1)return;nav.style.setProperty("bottom","-"+sat+"px","important");nav.style.setProperty("padding-bottom",sat+"px","important");nav.style.setProperty("margin-bottom","0px","important");nav.style.setProperty("background-color","#0a0b11","important");nav.style.setProperty("visibility","visible","important");nav.setAttribute("data-sat-pinned","1");var dock=nav.querySelector(".mobile-bottom-nav__dock");if(dock)dock.style.setProperty("padding-bottom",".4rem","important");}function pinAll(){var list=doc.querySelectorAll(".mobile-bottom-nav");for(var i=0;i<list.length;i++)pin(list[i]);}body();pinAll();if(!doc.body)doc.addEventListener("DOMContentLoaded",function(){body();pinAll();});window.addEventListener("pageshow",function(){html.classList.add("is-standalone");body();html.style.setProperty("--standalone-sat-bottom",sat+"px");pinAll();});if(typeof MutationObserver!=="undefined"){new MutationObserver(function(muts){for(var i=0;i<muts.length;i++){var m=muts[i];if(m.type!=="childList")continue;for(var j=0;j<m.addedNodes.length;j++){var n=m.addedNodes[j];if(n.nodeType!==1)continue;if(n.classList&&n.classList.contains("mobile-bottom-nav"))pin(n);else if(n.querySelectorAll){var found=n.querySelectorAll(".mobile-bottom-nav");for(var k=0;k<found.length;k++)pin(found[k]);}}}}).observe(html,{childList:true,subtree:true});}}catch(e){}})();`;
}
