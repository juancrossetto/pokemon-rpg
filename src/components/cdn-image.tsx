"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

function srcString(src: ImageProps["src"]): string {
  if (typeof src === "string") return src;
  if (src && typeof src === "object" && "src" in src) return String(src.src);
  return "";
}

function isRemoteSrc(src: ImageProps["src"]): boolean {
  return /^https?:\/\//i.test(srcString(src));
}

/** Arte estático del parque: ya viene optimizado y el optimizer de Next en dev suma latencia. */
function isLocalParkSrc(src: ImageProps["src"]): boolean {
  return srcString(src).startsWith("/park/");
}

export type CdnImageProps = ImageProps & {
  /** Atenúa el pop-in: la imagen entra con fade cuando termina de cargar. */
  fadeIn?: boolean;
};

/**
 * `next/image` con el optimizer apagado para CDNs (GitHub / Showdown).
 *
 * El optimizador de Next pide esas URLs con un user-agent de bot y GitHub
 * responde 403, así que en el home (TOP 5, tipos) y el resto de pantallas
 * quedaba el ícono roto. El browser sí las puede pedir; por eso las remotas
 * van `unoptimized`. Las de `/park/` también: son PNG/JPG finales y en local
 * el proxy del optimizer hace más lenta la primera pintura.
 */
export function CdnImage({
  fadeIn = false,
  className,
  onLoad,
  ...props
}: CdnImageProps) {
  const [loaded, setLoaded] = useState(false);
  const unoptimized =
    props.unoptimized ?? (isRemoteSrc(props.src) || isLocalParkSrc(props.src));
  const fadeClass = fadeIn ? (loaded ? " cdn-img--loaded" : " cdn-img--pending") : "";

  return (
    <Image
      {...props}
      alt={props.alt ?? ""}
      unoptimized={unoptimized}
      className={`${className ?? ""}${fadeClass}`.trim() || undefined}
      onLoad={(event) => {
        if (fadeIn) setLoaded(true);
        onLoad?.(event);
      }}
    />
  );
}
