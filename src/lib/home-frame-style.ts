import type { CSSProperties } from "react";
import type { HomeFrameOption } from "@/lib/home-frames";

/** Custom properties compartidas por la sección con marco. */
export function homeFrameSectionStyle(frame: HomeFrameOption): CSSProperties {
  return {
    "--hi-frame-slice": String(frame.slice),
    "--hi-frame-weight": String(frame.weight ?? 1),
    "--hi-rail-top": String(frame.rails.top),
    "--hi-rail-bottom": String(frame.rails.bottom),
    "--hi-rail-left": String(frame.rails.left),
    "--hi-rail-right": String(frame.rails.right),
  } as CSSProperties;
}

/**
 * Safari iOS no pinta `border-image-source: var(--url)`; el marco hay que
 * pasarlo inline en `.home-identity__marco`.
 */
export function homeFrameMarcoStyle(frame: HomeFrameOption): CSSProperties {
  return {
    borderImageSource: `url("${frame.src}")`,
    borderImageSlice: frame.slice,
  };
}
