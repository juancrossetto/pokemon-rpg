"use client";

import type { CSSProperties } from "react";
import { usePathname } from "@/i18n/navigation";

type RouteWorld =
  | "world"
  | "journey"
  | "research"
  | "nature"
  | "neon"
  | "lab"
  | "arena"
  | "event"
  | "social";

function worldForPath(pathname: string): RouteWorld | null {
  if (/^\/(login|register|battle)(\/|$)/.test(pathname)) return null;
  if (/^\/pokedex(\/|$)/.test(pathname)) return "research";
  if (/^\/(campaign|gyms)(\/|$)/.test(pathname)) return "journey";
  if (/^\/(park|safari)(\/|$)/.test(pathname)) return "nature";
  if (/^\/(market|shop)(\/|$)/.test(pathname)) return "neon";
  if (/^\/(pc|team|inventory|starter)(\/|$)/.test(pathname)) return "lab";
  if (/^\/(pvp|tower|factory|ranking)(\/|$)/.test(pathname)) return "arena";
  if (/^\/(events|raids|season)(\/|$)/.test(pathname)) return "event";
  if (/^\/(friends|clans|profile)(\/|$)/.test(pathname)) return "social";
  return "world";
}

const MOTES = Array.from({ length: 14 }, (_, index) => ({
  x: (index * 37 + 11) % 97,
  y: (index * 53 + 19) % 91,
  size: 2 + (index % 4),
  delay: -((index * 0.73) % 7),
  duration: 7 + (index % 6) * 1.7,
}));

/** Fondo 2.5D liviano y contextual, separado del contenido interactivo. */
export function GameRouteAtmosphere() {
  const pathname = usePathname();
  const world = worldForPath(pathname);
  if (!world) return null;

  return (
    <div className={`game-atmosphere game-atmosphere--${world}`} aria-hidden>
      <span className="game-atmosphere__aurora" />
      <span className="game-atmosphere__grid" />
      <span className="game-atmosphere__beam" />
      <span className="game-atmosphere__vignette" />
      <span className="game-atmosphere__motes">
        {MOTES.map((mote, index) => (
          <i
            key={index}
            style={
              {
                "--mote-x": `${mote.x}%`,
                "--mote-y": `${mote.y}%`,
                "--mote-size": `${mote.size}px`,
                "--mote-delay": `${mote.delay}s`,
                "--mote-duration": `${mote.duration}s`,
              } as CSSProperties
            }
          />
        ))}
      </span>
    </div>
  );
}
