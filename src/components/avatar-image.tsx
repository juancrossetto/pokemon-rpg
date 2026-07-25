"use client";

import { useState } from "react";

/**
 * Retrato de entrenador. Si el CDN falla, muestra un ícono neutro.
 */
export function AvatarImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  // Guardamos QUÉ src falló (no un booleano): así cambiar de avatar
  // resetea el fallback solo, sin necesitar un useEffect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <span className={`flex items-center justify-center ${className}`}>
        <span className="material-symbols-outlined text-on-surface-variant/60 text-[60%]">person</span>
      </span>
    );
  }

  // <img> y no next/image: necesitamos onError para el fallback, y son
  // assets locales chicos que no ganan nada con la optimización.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} />;
}
