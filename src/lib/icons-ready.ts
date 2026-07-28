/**
 * Script early-in-head: oculta los Material Symbols hasta que la fuente esté
 * lista. Sin esto, el navegador deja ver las ligaduras como texto ("home",
 * "bolt") un instante — el FOUC que se nota en cada carga fría.
 *
 * Usa `data-icons` (no className) para no pelear con la hidratación de React
 * sobre `<html className=...>`.
 */
export function iconsReadyEarlyScript(): string {
  return `function(){try{var h=document.documentElement;h.setAttribute("data-icons","pending");var done=false;function go(){if(done)return;done=true;h.setAttribute("data-icons","ready");}function ready(){try{return document.fonts&&document.fonts.check&&document.fonts.check('24px "Material Symbols Outlined"');}catch(e){return false;}}function tick(){if(ready()){go();return;}setTimeout(tick,40);}tick();setTimeout(go,2500);}catch(e){}}`;
}
