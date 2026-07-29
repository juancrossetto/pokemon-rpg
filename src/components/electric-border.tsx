/**
 * Borde eléctrico.
 *
 * El borde se dibuja normal y después se deforma con un `feDisplacementMap`
 * alimentado por cuatro capas de ruido `feTurbulence` que se desplazan en
 * direcciones opuestas. Al cruzarse, el ruido nunca repite el mismo patrón:
 * eso es lo que da el chisporroteo continuo sin que se note el bucle.
 *
 * Encima van dos copias desenfocadas del mismo borde (el halo) y un resplandor
 * de fondo, que son los que lo hacen leer como luz y no como una línea
 * temblorosa.
 *
 * No lleva `"use client"`: son SVG y CSS, se renderiza en el servidor.
 *
 * El contenedor tiene que ser `position: relative`, marcar su radio y **no**
 * recortar con `overflow: hidden` — el borde deformado se sale unos píxeles y
 * recortarlo lo devuelve a una línea recta justo en los bordes.
 */
export function ElectricBorder({
  id = "electric-displace",
  scale = 14,
}: {
  id?: string;
  /**
   * Cuánto se deforma el trazo. El ejemplo original usa 30 sobre una card de
   * 350×500; sobre una card ancha y baja ese valor saca púas largas. 14 es el
   * chisporroteo del podio; por debajo de 10 queda un temblor apenas visible.
   */
  scale?: number;
}) {
  return (
    <span
      className="electric-border pointer-events-none absolute inset-0 rounded-[inherit]"
      aria-hidden
    >
      <svg className="absolute h-0 w-0" aria-hidden focusable="false">
        <defs>
          <filter
            id={id}
            colorInterpolationFilters="sRGB"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise1" seed="1" />
            <feOffset in="noise1" dx="0" dy="0" result="offsetNoise1">
              <animate
                attributeName="dy"
                values="700; 0"
                dur="6s"
                repeatCount="indefinite"
                calcMode="linear"
              />
            </feOffset>

            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise2" seed="1" />
            <feOffset in="noise2" dx="0" dy="0" result="offsetNoise2">
              <animate
                attributeName="dy"
                values="0; -700"
                dur="6s"
                repeatCount="indefinite"
                calcMode="linear"
              />
            </feOffset>

            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise3" seed="2" />
            <feOffset in="noise3" dx="0" dy="0" result="offsetNoise3">
              <animate
                attributeName="dx"
                values="490; 0"
                dur="6s"
                repeatCount="indefinite"
                calcMode="linear"
              />
            </feOffset>

            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise4" seed="2" />
            <feOffset in="noise4" dx="0" dy="0" result="offsetNoise4">
              <animate
                attributeName="dx"
                values="0; -490"
                dur="6s"
                repeatCount="indefinite"
                calcMode="linear"
              />
            </feOffset>

            <feComposite in="offsetNoise1" in2="offsetNoise2" result="part1" />
            <feComposite in="offsetNoise3" in2="offsetNoise4" result="part2" />
            <feBlend in="part1" in2="part2" mode="color-dodge" result="combinedNoise" />

            <feDisplacementMap
              in="SourceGraphic"
              in2="combinedNoise"
              scale={scale}
              xChannelSelector="R"
              yChannelSelector="B"
            />
          </filter>
        </defs>
      </svg>

      <span
        className="electric-border__stroke"
        style={{ filter: `url(#${id})` }}
      />
      <span className="electric-border__halo electric-border__halo--near" />
      <span className="electric-border__halo electric-border__halo--far" />
      <span className="electric-border__ambient" />
    </span>
  );
}
