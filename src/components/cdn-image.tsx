"use client";

import Image, { type ImageProps } from "next/image";

function isRemoteSrc(src: ImageProps["src"]): boolean {
  if (typeof src === "string") return /^https?:\/\//i.test(src);
  if (src && typeof src === "object" && "src" in src) {
    return /^https?:\/\//i.test(String(src.src));
  }
  return false;
}

/**
 * `next/image` con el optimizer apagado para CDNs (GitHub / Showdown).
 *
 * El optimizador de Next pide esas URLs con un user-agent de bot y GitHub
 * responde 403, así que en el home (TOP 5, tipos) y el resto de pantallas
 * quedaba el ícono roto. El browser sí las puede pedir; por eso las remotas
 * van `unoptimized`. Las locales de `/public` siguen pasando por el optimizer.
 */
export function CdnImage(props: ImageProps) {
  return (
    <Image
      {...props}
      alt={props.alt ?? ""}
      unoptimized={props.unoptimized ?? isRemoteSrc(props.src)}
    />
  );
}
