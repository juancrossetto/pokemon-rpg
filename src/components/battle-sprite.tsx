"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import {
  battleAnimatedSpriteUrl,
  type SpriteFacing,
} from "@/lib/showdown-sprites";
import { pokemonSpriteCandidates } from "@/lib/sprites";

const LOCAL_FALLBACK = "/items/hd/poke-ball.png";

/**
 * Sprite de batalla: GIF animado Showdown (ani HD) y, si el CDN falla,
 * el dex 2D del mismo host → pokeball local.
 */
export function BattleSprite({
  speciesName,
  facing,
  isShiny = false,
  fallbackUrl,
  alt,
  width,
  height,
  className,
  style,
}: {
  speciesName: string;
  facing: SpriteFacing;
  isShiny?: boolean;
  fallbackUrl: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  style?: CSSProperties;
}) {
  const animated = battleAnimatedSpriteUrl(speciesName, facing, isShiny);
  const sources = [
    animated,
    ...pokemonSpriteCandidates({
      src: fallbackUrl,
      speciesName,
      isShiny,
    }),
    LOCAL_FALLBACK,
  ].filter((value, index, all) => all.indexOf(value) === index);
  const sourcesKey = sources.join("|");
  const [failure, setFailure] = useState({ sourcesKey, index: 0 });
  const activeIndex = failure.sourcesKey === sourcesKey ? failure.index : 0;
  const activeSrc = sources[Math.min(activeIndex, sources.length - 1)] ?? LOCAL_FALLBACK;
  const usingLocalFallback = activeSrc === LOCAL_FALLBACK;

  return (
    <Image
      src={activeSrc}
      alt={alt}
      width={width}
      height={height}
      className={`battle-sprite-pixel ${className ?? ""}${usingLocalFallback ? " opacity-45 grayscale" : ""}`.trim()}
      style={style}
      unoptimized
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
