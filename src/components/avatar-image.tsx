"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Retrato de entrenador. Si el CDN falla, muestra un ícono neutro.
 */
export function AvatarImage({
  src,
  alt,
  className = "",
  size,
}: {
  src: string;
  alt: string;
  className?: string;
  /**
   * Lado en px de la caja donde se muestra. Con esto el arte pasa por el
   * optimizador y baja al tamaño real en vez del original.
   *
   * El arte de `/avatars/*1.png` es de 256×256 y en los chips se muestra a
   * 27–32px: medido en el home, eso son ~108 veces más píxeles de los que se
   * pintan, decodificados y en memoria por cada retrato de la pantalla.
   */
  size?: number;
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

  // Sólo optimizamos arte local y con tamaño conocido. Los sprites remotos
  // (Showdown) siguen por <img> crudo: algunos son animados y pasarlos por el
  // optimizador los congelaría en el primer frame.
  if (size && src.startsWith("/")) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={className}
        draggable={false}
        onError={() => setFailedSrc(src)}
      />
    );
  }

  // <img> y no next/image: necesitamos onError para el fallback y, sin saber a
  // qué tamaño se muestra, `next/image` no puede elegir una resolución mejor.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      onError={() => setFailedSrc(src)}
    />
  );
}
