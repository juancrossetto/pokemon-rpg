"use client";

/**
 * Borde eléctrico (CSS).
 *
 * Antes usábamos feDisplacementMap animado; en cards anchas/bajas salían
 * púas/garabatos, en Safari el SMIL no re-pintaba, y detectar modo en el
 * primer render provocaba hydration mismatch (y la página quedaba trabada).
 *
 * Este glow con flicker es el mismo en SSR y cliente: sin `window`, sin
 * SVG filters, sin overflow raro.
 *
 * Padre: `position: relative` + radio. Puede llevar `overflow: hidden`
 * si hace falta — el efecto ya no se sale del borde.
 */
export function ElectricBorder() {
  return (
    <span
      className="electric-border electric-border--fallback pointer-events-none absolute inset-0 rounded-[inherit]"
      aria-hidden
    >
      <span className="electric-border__stroke" />
      <span className="electric-border__spark" />
      <span className="electric-border__halo electric-border__halo--near" />
      <span className="electric-border__halo electric-border__halo--far" />
      <span className="electric-border__ambient" />
    </span>
  );
}
