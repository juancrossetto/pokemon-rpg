/**
 * Marca shiny estilo Pokémon GO: círculo dorado + 3 sparkles blancos.
 */
function sparkle(cx: number, cy: number, r: number) {
  const tip = r;
  const waist = r * 0.28;
  return [
    `M ${cx} ${cy - tip}`,
    `L ${cx + waist} ${cy - waist}`,
    `L ${cx + tip} ${cy}`,
    `L ${cx + waist} ${cy + waist}`,
    `L ${cx} ${cy + tip}`,
    `L ${cx - waist} ${cy + waist}`,
    `L ${cx - tip} ${cy}`,
    `L ${cx - waist} ${cy - waist}`,
    "Z",
  ].join(" ");
}

export function ShinyMark({
  className = "h-4 w-4",
  title = "Shiny",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] ${className}`.trim()}
      role="img"
      aria-label={title}
      title={title}
    >
      <circle cx="16" cy="16" r="14.5" fill="#FFCC00" />
      <circle
        cx="16"
        cy="16"
        r="14.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.25"
      />
      {/* Grande izq · mediano arriba-der · chico der — composición GO. */}
      <path fill="#FFFFFF" d={sparkle(12.2, 17.4, 5.1)} />
      <path fill="#FFFFFF" d={sparkle(20.6, 11.6, 3.35)} />
      <path fill="#FFFFFF" d={sparkle(22.4, 18.2, 2.15)} />
    </svg>
  );
}
