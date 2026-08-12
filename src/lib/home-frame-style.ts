import type { CSSProperties } from "react";
import type { HomeFrameOption } from "@/lib/home-frames";

/** Custom properties compartidas por la sección con marco. */
export function homeFrameSectionStyle(frame: HomeFrameOption): CSSProperties {
  return {
    "--hi-frame-weight": String(frame.weight ?? 1),
    "--hi-rail-top": String(frame.rails.top),
    "--hi-rail-bottom": String(frame.rails.bottom),
    "--hi-rail-left": String(frame.rails.left),
    "--hi-rail-right": String(frame.rails.right),
  } as CSSProperties;
}

/**
 * Estilos del marco en `.home-identity__marco`.
 *
 * Safari iOS no pinta `border-image` si source o slice vienen de variables CSS.
 * El selector de marcos ya usa todo inline (`frame-picker.tsx`); acá igual.
 * El ancho del borde queda en CSS con media queries (usa `--hi-frame-weight`).
 */
export function homeFrameMarcoStyle(frame: HomeFrameOption): CSSProperties {
  const borderImage = `url("${frame.src}") ${frame.slice} stretch`;
  return {
    borderStyle: "solid",
    borderColor: "transparent",
    borderImage,
    WebkitBorderImage: borderImage,
  };
}
