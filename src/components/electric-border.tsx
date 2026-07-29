"use client";

import { useEffect, useState } from "react";

function prefersFallbackElectricBorder(): boolean {
  if (typeof window === "undefined") return false;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return reduced || coarse || ios;
}

/**
 * Borde eléctrico.
 *
 * Desktop: `feDisplacementMap` + ruido animado (SMIL) sobre un trazo SVG.
 * Mobile / iOS / touch: fallback CSS — Safari no re-renderiza bien el filtro
 * aplicado a HTML vía `filter: url()`, así que pulsamos halos y glow.
 *
 * El contenedor padre debe ser `position: relative`, tener radio y **no**
 * usar `overflow: hidden` (el borde deformado se sale unos px).
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
  const [fallback, setFallback] = useState(() => {
    if (typeof window === "undefined") return false;
    return prefersFallbackElectricBorder();
  });

  useEffect(() => {
    setFallback(prefersFallbackElectricBorder());

    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarseMq = window.matchMedia("(pointer: coarse)");
    const sync = () => setFallback(prefersFallbackElectricBorder());
    reducedMq.addEventListener("change", sync);
    coarseMq.addEventListener("change", sync);
    return () => {
      reducedMq.removeEventListener("change", sync);
      coarseMq.removeEventListener("change", sync);
    };
  }, []);

  return (
    <span
      className={`electric-border pointer-events-none absolute inset-0 rounded-[inherit] ${
        fallback ? "electric-border--fallback" : ""
      }`}
      aria-hidden
    >
      {!fallback ? (
        <svg
          className="electric-border__stroke-svg absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
          aria-hidden
          focusable="false"
        >
          <defs>
            <ElectricFilterDef id={id} scale={scale} />
          </defs>
          <rect
            x="0.75"
            y="0.75"
            width="98.5"
            height="98.5"
            rx="3.2"
            ry="3.2"
            fill="none"
            stroke="var(--electric)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            filter={`url(#${id})`}
          />
        </svg>
      ) : (
        <>
          <span className="electric-border__stroke" />
          <span className="electric-border__spark" aria-hidden />
        </>
      )}

      <span className="electric-border__halo electric-border__halo--near" />
      <span className="electric-border__halo electric-border__halo--far" />
      <span className="electric-border__ambient" />
    </span>
  );
}

function ElectricFilterDef({ id, scale }: { id: string; scale: number }) {
  return (
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
        <animate attributeName="dy" values="700; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
      </feOffset>

      <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise2" seed="1" />
      <feOffset in="noise2" dx="0" dy="0" result="offsetNoise2">
        <animate attributeName="dy" values="0; -700" dur="6s" repeatCount="indefinite" calcMode="linear" />
      </feOffset>

      <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise3" seed="2" />
      <feOffset in="noise3" dx="0" dy="0" result="offsetNoise3">
        <animate attributeName="dx" values="490; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
      </feOffset>

      <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise4" seed="2" />
      <feOffset in="noise4" dx="0" dy="0" result="offsetNoise4">
        <animate attributeName="dx" values="0; -490" dur="6s" repeatCount="indefinite" calcMode="linear" />
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
  );
}
