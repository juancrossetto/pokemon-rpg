"use client";

import { type ImageProps } from "next/image";
import { CdnImage } from "@/components/cdn-image";
import { useState } from "react";
import { pokemonSpriteCandidates } from "@/lib/sprites";

const LOCAL_FALLBACK = "/items/hd/poke-ball.png";

type PokemonImageProps = Omit<ImageProps, "src" | "onError"> & {
  src?: string | null;
  speciesId?: number | null;
  speciesName?: string | null;
  isShiny?: boolean;
  fallbackSrc?: string;
};

/**
 * Imagen de Pokémon tolerante a fallos de CDN.
 *
 * Cambia de fuente al recibir `onError`; el último origen es siempre local,
 * por lo que nunca queda el ícono roto del navegador. El estado incluye la
 * lista activa para resetearse solo cuando cambia el Pokémon, sin un effect.
 */
export function PokemonImage({
  src,
  speciesId,
  speciesName,
  isShiny = false,
  fallbackSrc = LOCAL_FALLBACK,
  alt,
  className,
  ...imageProps
}: PokemonImageProps) {
  const sources = [
    ...pokemonSpriteCandidates({ src, speciesId, speciesName, isShiny }),
    fallbackSrc,
  ].filter((value, index, all) => all.indexOf(value) === index);
  const sourcesKey = sources.join("|");
  const [failure, setFailure] = useState({ sourcesKey, index: 0 });
  const activeIndex = failure.sourcesKey === sourcesKey ? failure.index : 0;
  const activeSrc = sources[Math.min(activeIndex, sources.length - 1)] ?? fallbackSrc;
  const usingLocalFallback = activeSrc === fallbackSrc;

  return (
    <CdnImage
      {...imageProps}
      src={activeSrc}
      alt={alt}
      className={`${className ?? ""}${usingLocalFallback ? " opacity-45 grayscale" : ""}`.trim()}
      onError={() => {
        setFailure((current) => {
          const currentIndex = current.sourcesKey === sourcesKey ? current.index : 0;
          if (current.sourcesKey === sourcesKey && currentIndex >= sources.length - 1) {
            return current;
          }
          return {
            sourcesKey,
            index: Math.min(currentIndex + 1, sources.length - 1),
          };
        });
      }}
    />
  );
}
