/** Barra segmentada sesgada estilo mockup (Charizard stats). */
export function SegmentedStatBar({
  pct,
  segments = 15,
  variant = "xp",
  className = "",
  heightClass = "h-2.5",
}: {
  pct: number;
  segments?: number;
  variant?: "xp" | "hp" | "stat" | "danger";
  className?: string;
  heightClass?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * segments);

  return (
    <div
      className={`flex w-full gap-[2px] ${className}`}
      style={{ transform: "skewX(-14deg)" }}
      title={`${Math.round(clamped)}%`}
    >
      {Array.from({ length: segments }, (_, i) => {
        const active = i < filled;
        const t = segments <= 1 ? 0 : i / (segments - 1);
        return (
          <div
            key={i}
            className={`${heightClass} min-w-0 flex-1 rounded-[2px] ${
              active ? "" : "bg-white/[0.08]"
            }`}
            style={active ? { background: segmentFill(variant, t) } : undefined}
          />
        );
      })}
    </div>
  );
}

function segmentFill(variant: "xp" | "hp" | "stat" | "danger", t: number): string {
  if (variant === "xp" || variant === "stat") {
    // naranja → amarillo
    const r = Math.round(249 + (253 - 249) * t);
    const g = Math.round(115 + (224 - 115) * t);
    const b = Math.round(22 + (71 - 22) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  if (variant === "danger") {
    const r = Math.round(220 + (248 - 220) * t);
    const g = Math.round(38 + (113 - 38) * t);
    const b = Math.round(38 + (113 - 38) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // hp: emerald → lime
  const r = Math.round(16 + (163 - 16) * t);
  const g = Math.round(185 + (230 - 185) * t);
  const b = Math.round(129 + (53 - 129) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function hpBarVariant(pct: number): "hp" | "xp" | "danger" {
  if (pct > 50) return "hp";
  if (pct > 20) return "xp";
  return "danger";
}
