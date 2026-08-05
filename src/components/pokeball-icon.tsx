export function PokeballIcon({
  className = "",
  pulseButton = false,
  mono = false,
}: {
  className?: string;
  pulseButton?: boolean;
  /** Sin rojo: icono neutro (p. ej. botones de combate). */
  mono?: boolean;
}) {
  const top = mono ? "rgba(255,255,255,0.82)" : "#f0f0f0";
  const bottom = mono ? "rgba(255,255,255,0.55)" : "var(--color-pokeball-red)";
  const ink = mono ? "rgba(255,255,255,0.35)" : "#131313";
  const button = mono ? "rgba(255,255,255,0.92)" : "#ffffff";

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d="M 50,50 m -45,0 a 45,45 0 1,0 90,0" fill={top} stroke={ink} strokeWidth="2" />
      <path d="M 50,50 m -45,0 a 45,45 0 1,1 90,0" fill={bottom} stroke={ink} strokeWidth="2" />
      <rect x="5" y="47" width="90" height="6" rx="1" fill={ink} />
      <circle cx="50" cy="50" r="12" fill={ink} />
      <circle
        cx="50"
        cy="50"
        r="6"
        fill={button}
        className={pulseButton ? "pokeball-pulse-button" : undefined}
      />
    </svg>
  );
}
