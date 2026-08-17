"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";

/**
 * Fantasma que sigue el dedo/mouse mientras se reordena el squad.
 * El slot de origen queda como placeholder; este es el feedback de “seleccionado”.
 */
export function SquadReorderGhost({
  x,
  y,
  spriteUrl,
  name,
  accent,
}: {
  x: number;
  y: number;
  spriteUrl: string;
  name: string;
  accent: string;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="squad-reorder-ghost"
      style={
        {
          "--ghost-x": `${x}px`,
          "--ghost-y": `${y}px`,
          "--ghost-accent": accent,
        } as CSSProperties
      }
      aria-hidden
    >
      <span className="squad-reorder-ghost__glow" />
      <Image
        src={spriteUrl}
        alt=""
        width={96}
        height={96}
        draggable={false}
        unoptimized
        className="squad-reorder-ghost__sprite"
      />
      <span className="squad-reorder-ghost__name">{name}</span>
    </div>,
    document.body,
  );
}
