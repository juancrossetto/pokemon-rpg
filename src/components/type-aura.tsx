"use client";

import type { CSSProperties } from "react";
import { typeColor } from "@/lib/type-colors";

type AuraKind =
  | "grass"
  | "fire"
  | "water"
  | "electric"
  | "ghost"
  | "poison"
  | "generic";

function auraKind(type: string): AuraKind {
  const t = type.toLowerCase();
  if (t === "grass" || t === "bug") return "grass";
  if (t === "fire" || t === "dragon") return "fire";
  if (t === "water" || t === "ice") return "water";
  if (t === "electric") return "electric";
  if (t === "ghost" || t === "dark") return "ghost";
  if (t === "poison" || t === "psychic" || t === "fairy") return "poison";
  return "generic";
}

/**
 * Aura tipada extremadamente sutil: partículas + glow. Sin GIFs.
 * `intensity` 0–1 escala opacidad/cantidad (líder > soporte).
 */
export function TypeAura({
  type,
  intensity = 0.55,
  className = "",
}: {
  type: string;
  intensity?: number;
  className?: string;
}) {
  const kind = auraKind(type);
  const color = typeColor(type);
  const n = kind === "electric" ? 5 : kind === "ghost" ? 6 : 7;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ "--tp-aura": color, opacity: intensity } as CSSProperties}
    >
      {/* Glow ambiental respirando */}
      <span
        className="tp-aura-glow absolute left-1/2 top-[42%] h-[70%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${color}55 0%, transparent 70%)` }}
      />

      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={`tp-aura-mote tp-aura-mote--${kind} absolute`}
          style={
            {
              left: `${12 + ((i * 37) % 76)}%`,
              bottom: `${8 + ((i * 19) % 40)}%`,
              animationDelay: `${-(i * 0.7)}s`,
              animationDuration: `${5.5 + (i % 4)}s`,
              background: color,
              boxShadow: `0 0 6px ${color}`,
            } as CSSProperties
          }
        />
      ))}

      {kind === "electric" && <span className="tp-electric-crawl" />}
    </div>
  );
}
