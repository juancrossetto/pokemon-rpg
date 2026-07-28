"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { typeColor } from "@/lib/type-colors";
import { showdownTypeSymbolUrl } from "@/lib/type-icons";

/** Chip rectangular de afinidad — símbolo oficial + color del tipo. */
export function ClanAffinityChip({
  affinity,
  label,
  selected = false,
  onClick,
  size = "md",
}: {
  affinity: string;
  label: string;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}) {
  const type = affinity.toLowerCase();
  const color = typeColor(type);
  const isButton = typeof onClick === "function";
  const symbolSize = size === "sm" ? 14 : 18;

  const shell =
    size === "sm"
      ? "min-h-8 gap-1.5 rounded-md px-2 py-1"
      : "min-h-11 gap-2 rounded-xl px-2.5 py-1.5";

  const labelClass =
    size === "sm"
      ? "text-[10px] font-bold uppercase tracking-[0.08em]"
      : "text-[11px] font-bold uppercase tracking-[0.1em]";

  const iconBox =
    size === "sm"
      ? "h-5 w-5 rounded"
      : "h-7 w-7 rounded-md";

  const style: CSSProperties = selected
    ? {
        background: `linear-gradient(135deg, ${color}55 0%, ${color}22 48%, rgba(10,12,18,0.92) 100%)`,
        borderColor: color,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px ${color}66, 0 8px 20px ${color}28`,
      }
    : {
        background: `linear-gradient(160deg, ${color}24 0%, rgba(12,14,20,0.88) 55%)`,
        borderColor: `${color}40`,
      };

  const content = (
    <>
      <span
        className={`relative inline-flex shrink-0 items-center justify-center ${iconBox}`}
        style={{
          background: `linear-gradient(145deg, ${color}, ${color}aa)`,
          boxShadow: `0 0 12px ${color}33`,
        }}
      >
        <Image
          src={showdownTypeSymbolUrl(type)}
          alt=""
          width={symbolSize}
          height={symbolSize}
          unoptimized
          className="object-contain brightness-110 contrast-125"
        />
      </span>
      <span
        className={`${labelClass} truncate`}
        style={{ color: selected ? "#fff" : color }}
      >
        {label}
      </span>
      {selected ? (
        <span
          className="ml-auto h-1.5 w-1.5 shrink-0 rounded-[2px]"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          aria-hidden
        />
      ) : null}
    </>
  );

  const className = `relative inline-flex items-center overflow-hidden border ${shell} transition-[transform,box-shadow,border-color] ${
    isButton ? "hover:-translate-y-0.5 active:translate-y-0" : ""
  }`;

  if (isButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={className}
        style={style}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
          aria-hidden
        />
        {content}
      </button>
    );
  }

  return (
    <span className={className} style={style}>
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        aria-hidden
      />
      {content}
    </span>
  );
}
