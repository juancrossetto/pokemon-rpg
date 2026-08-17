"use client";

import Image from "next/image";
import { useState } from "react";
import { showdownTypeSymbolUrl, typeIcon } from "@/lib/type-icons";

/**
 * Símbolo de tipo que se lee sobre chips oscuros.
 *
 * El CDN de Showdown a veces 404 o manda un glyph casi del mismo color que
 * el chip (agua sobre agua, fuego sobre fuego). Si carga, lo pasamos a blanco
 * con contraste; si falla, cae al Material Symbol local.
 */
export function TypeSymbol({
  type,
  size = 14,
  className = "",
}: {
  type: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const icon = typeIcon(type);

  if (failed) {
    return (
      <span
        className={`material-symbols-outlined leading-none text-white ${className}`.trim()}
        style={{ fontSize: size }}
        aria-hidden
      >
        {icon}
      </span>
    );
  }

  return (
    <Image
      src={showdownTypeSymbolUrl(type)}
      alt=""
      width={size}
      height={size}
      unoptimized
      className={`object-contain brightness-0 invert drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] ${className}`.trim()}
      onError={() => setFailed(true)}
      aria-hidden
    />
  );
}
