/**
 * Detecta PWA anclada y fija el inset del home indicator ANTES del primer paint.
 *
 * El bug de “al refrescar la nav sube y después baja”:
 * `env(safe-area-inset-bottom)` en iOS suele ser `0` en el primer frame y
 * después pasa a ~34px. Si el CSS depende de env(), la barra pinta con hueco
 * y luego salta. Acá seteamos `--standalone-sat-bottom` con un provisional
 * (34px en teléfonos) e inyectamos la regla crítica inline para no esperar
 * al CSS bundle de Next.
 */
export function standaloneEarlyScript(): string {
  return `(function(){try{var s=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||!!(window.navigator&&window.navigator.standalone);if(!s)return;var h=document.documentElement;h.classList.add("is-standalone");var phone=Math.min(screen.width||0,screen.height||0)<=500;var provisional=phone?34:0;h.style.setProperty("--standalone-sat-bottom",provisional+"px");if(!document.getElementById("standalone-nav-critical")){var st=document.createElement("style");st.id="standalone-nav-critical";st.textContent="html.is-standalone .mobile-bottom-nav{bottom:calc(-1 * var(--standalone-sat-bottom, 34px))!important;padding-bottom:var(--standalone-sat-bottom, 34px)!important;margin-bottom:0!important;background-color:#0a0b11!important;}html.is-standalone .mobile-bottom-nav__dock{padding-bottom:.4rem!important;}";h.appendChild(st);}var gotReal=false;function measure(){try{var el=document.createElement("div");el.setAttribute("aria-hidden","true");el.style.cssText="position:absolute;left:0;bottom:0;width:0;height:0;visibility:hidden;padding:0;padding-bottom:env(safe-area-inset-bottom);margin:0;border:0;pointer-events:none;";h.appendChild(el);var v=parseFloat(getComputedStyle(el).paddingBottom)||0;el.remove();if(v>0){gotReal=true;h.style.setProperty("--standalone-sat-bottom",Math.ceil(v)+"px");}}catch(e){}}function body(){if(document.body)document.body.classList.add("is-standalone");measure();}body();if(!document.body)document.addEventListener("DOMContentLoaded",body);window.addEventListener("pageshow",function(){h.classList.add("is-standalone");gotReal=false;body();measure();});requestAnimationFrame(function(){requestAnimationFrame(measure);});setTimeout(function(){if(!gotReal){h.style.setProperty("--standalone-sat-bottom",phone?"34px":"0px");}else{measure();}},450);}catch(e){}})();`;
}
