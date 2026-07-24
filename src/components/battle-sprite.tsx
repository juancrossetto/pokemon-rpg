"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import {
  battleAnimatedSpriteUrl,
  type SpriteFacing,
} from "@/lib/showdown-sprites";

/**
 * Sprite de batalla: GIF animado Showdown (ani HD) con fallback al
 * official-artwork si el GIF no existe o falla la red.
 */
export function BattleSprite({
  speciesName,
  facing,
  fallbackUrl,
  alt,
  width,
  height,
  className,
  style,
}: {
  speciesName: string;
  facing: SpriteFacing;
  fallbackUrl: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  style?: CSSProperties;
}) {
  const animated = battleAnimatedSpriteUrl(speciesName, facing);
  const [src, setSrc] = useState(animated);

  useEffect(() => {
    setSrc(battleAnimatedSpriteUrl(speciesName, facing));
  }, [speciesName, facing]);

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      unoptimized
      onError={() => {
        if (src !== fallbackUrl) setSrc(fallbackUrl);
      }}
    />
  );
}
