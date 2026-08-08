"use client";

import { AvatarImage } from "@/components/avatar-image";

const SIZE_CLASS = {
  /** Header / chrome: alinea con campana y resource chip (h-8). */
  xs: "h-8 w-8",
  sm: "h-11 w-11",
  md: "h-14 w-14",
  lg: "h-16 w-16",
  xl: "h-20 w-20",
  /** Sidebar de batalla: un poco más grande que xl. */
  "2xl": "h-24 w-24",
} as const;

const INITIALS_CLASS = {
  xs: "text-[10px]",
  sm: "text-[12px]",
  md: "text-[13px]",
  lg: "text-[15px]",
  xl: "text-[18px]",
  "2xl": "text-[20px]",
} as const;

export type TrainerAvatarSize = keyof typeof SIZE_CLASS;

/**
 * Retrato de entrenador.
 *
 * - `framed` (default): chip del header / friends — borde neutro + fill.
 * - `bare`: sólo el arte, sin fondo ni caja (ranking, listas).
 */
export function TrainerAvatar({
  name,
  src,
  size = "md",
  active = false,
  framed = true,
  /** Sprites pixel (Showdown): contain + pixelated en vez del crop HD. */
  pixel = false,
  presenceClassName,
  className = "",
}: {
  name: string;
  src: string | null;
  size?: TrainerAvatarSize;
  /** Brillo suave (menú abierto, card hover…). */
  active?: boolean;
  /** Si false, sin fondo ni caja — sólo el sprite. */
  framed?: boolean;
  pixel?: boolean;
  /** Clase del punto de presencia (absolute, esquina). */
  presenceClassName?: string;
  className?: string;
}) {
  const imgClass = pixel
    ? "relative h-full w-full object-contain p-[12%] [image-rendering:pixelated]"
    : framed
      ? "trainer-sprite-fill relative h-full w-full"
      : "trainer-sprite-thumb relative h-full w-full drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]";

  if (!framed) {
    return (
      <span
        className={`relative inline-flex shrink-0 items-center justify-center ${SIZE_CLASS[size]} ${className}`}
      >
        {src ? (
          <AvatarImage src={src} alt={name} className={imgClass} />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center font-bold tracking-wide text-white/50 ${INITIALS_CLASS[size]}`}
          >
            {initials(name)}
          </span>
        )}
        {presenceClassName ? (
          <span
            className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#0c0e14] ${
            size === "2xl" || size === "xl" ? "h-3.5 w-3.5" : "h-3 w-3"
            } ${presenceClassName}`}
          />
        ) : null}
      </span>
    );
  }

  const shape = "rounded-[28%]";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${SIZE_CLASS[size]} ${className}`}
    >
      <span
        className={`absolute inset-0 overflow-hidden ${shape} transition-shadow duration-200 ${
          src ? "bg-[#12141a]" : "bg-white/8 text-white"
        } ${
          active
            ? "shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_0_10px_rgba(255,255,255,0.08)]"
            : "shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
        }`}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-1 ${shape}`}
          style={{
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.14) 0%, transparent 36%, transparent 68%, rgba(0,0,0,0.28) 100%)",
          }}
        />
        {src ? (
          <AvatarImage src={src} alt={name} className={imgClass} />
        ) : (
          <span
            className={`relative flex h-full w-full items-center justify-center font-bold tracking-wide ${INITIALS_CLASS[size]}`}
          >
            {initials(name)}
          </span>
        )}
      </span>
      {presenceClassName ? (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#0c0e14] ${
            size === "2xl" || size === "xl" ? "h-3.5 w-3.5" : size === "xs" ? "h-2 w-2" : "h-3 w-3"
          } ${presenceClassName}`}
        />
      ) : null}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}
