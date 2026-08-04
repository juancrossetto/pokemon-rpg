/**
 * Detecta PWA anclada al inicio lo antes posible (antes de hidratar React).
 *
 * En iOS, `display-mode: standalone` a veces no matchea en el primer paint
 * y sólo `navigator.standalone` es fiable. Si la clase `.is-standalone`
 * llega tarde (useEffect de MobileChrome), la bottom nav pinta un frame con
 * hueco bajo el dock y después “salta” al anclarse.
 */
export function standaloneEarlyScript(): string {
  return `(function(){try{var s=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||!!(window.navigator&&window.navigator.standalone);if(!s)return;var h=document.documentElement;h.classList.add("is-standalone");function body(){if(document.body)document.body.classList.add("is-standalone");}body();if(!document.body)document.addEventListener("DOMContentLoaded",body);}catch(e){}})();`;
}
