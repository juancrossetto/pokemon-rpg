"use client";

import type { CSSProperties } from "react";
import { itemDisplayUrl } from "@/lib/item-sprites";

type FxSize = "field" | "party";

/**
 * Destello al usar poción (sobre el sprite en campo) o revive (sobre el
 * ícono del party en la columna).
 */
export function BattleItemUseFx({
  kind,
  itemName,
  label,
  size = "field",
}: {
  kind: "heal" | "revive";
  itemName: string;
  /** Texto flotante, p. ej. "+20". */
  label: string;
  size?: FxSize;
}) {
  const iconSrc = itemDisplayUrl(itemName, "hd");
  const compact = size === "party";
  const tone =
    kind === "revive"
      ? {
          burst: "rgba(251, 191, 36, 0.55)",
          ring: "rgba(252, 211, 77, 0.9)",
          glow: "rgba(251, 191, 36, 0.65)",
          label: "text-amber-100",
          spark: "#fde68a",
        }
      : {
          burst: "rgba(52, 211, 153, 0.55)",
          ring: "rgba(110, 231, 183, 0.95)",
          glow: "rgba(16, 185, 129, 0.65)",
          label: "text-emerald-200",
          spark: "#6ee7b7",
        };

  const sparks = compact
    ? [
        { x: "-28%", y: "0%", sx: "-10px", sy: "-16px", d: "0ms" },
        { x: "30%", y: "-4%", sx: "12px", sy: "-18px", d: "40ms" },
        { x: "-8%", y: "22%", sx: "-6px", sy: "-12px", d: "90ms" },
        { x: "12%", y: "20%", sx: "8px", sy: "-14px", d: "70ms" },
      ]
    : [
        { x: "-22%", y: "4%", sx: "-18px", sy: "-28px", d: "0ms" },
        { x: "26%", y: "-4%", sx: "20px", sy: "-32px", d: "45ms" },
        { x: "-12%", y: "28%", sx: "-14px", sy: "-20px", d: "100ms" },
        { x: "18%", y: "24%", sx: "16px", sy: "-22px", d: "75ms" },
        { x: "0%", y: "-12%", sx: "2px", sy: "-36px", d: "25ms" },
        { x: "-28%", y: "14%", sx: "-22px", sy: "-16px", d: "130ms" },
        { x: "30%", y: "12%", sx: "24px", sy: "-18px", d: "110ms" },
      ];

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-30 overflow-visible ${
        compact ? "battle-item-fx--party" : "battle-item-fx--field"
      }`}
      aria-hidden
      style={{ "--battle-item-glow": tone.glow } as CSSProperties}
    >
      <span
        className={`battle-item-fx-burst absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-md ${
          compact ? "h-16 w-16" : "h-36 w-36"
        }`}
        style={{ background: tone.burst }}
      />
      <span
        className={`battle-item-fx-ring absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
          compact ? "h-12 w-12" : "h-28 w-28"
        }`}
        style={{ borderColor: tone.ring }}
      />
      <span
        className={`battle-item-fx-ring battle-item-fx-ring--late absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full border ${
          compact ? "h-10 w-10" : "h-20 w-20"
        }`}
        style={{ borderColor: tone.ring }}
      />
      <span className="battle-item-fx-cross absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2">
        <span
          className={`material-symbols-outlined drop-shadow-[0_0_14px_rgba(0,0,0,0.55)] ${
            compact ? "text-[22px]!" : "text-[44px]!"
          }`}
          style={{ color: tone.ring }}
        >
          {kind === "revive" ? "ecg" : "cardiology"}
        </span>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={iconSrc}
        alt=""
        width={compact ? 28 : 48}
        height={compact ? 28 : 48}
        className={`battle-item-fx-icon absolute left-1/2 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] ${
          compact
            ? "top-[62%] h-7 w-7 -translate-x-1/2 -translate-y-1/2"
            : "top-[60%] h-12 w-12 -translate-x-1/2 -translate-y-1/2"
        }`}
      />
      {sparks.map((s, i) => (
        <span
          key={i}
          className={`battle-item-fx-spark absolute left-1/2 top-1/2 rounded-full ${
            compact ? "h-1 w-1" : "h-1.5 w-1.5"
          }`}
          style={
            {
              marginLeft: s.x,
              marginTop: s.y,
              background: tone.spark,
              animationDelay: s.d,
              "--sx": s.sx,
              "--sy": s.sy,
            } as CSSProperties
          }
        />
      ))}
      <span
        className={`battle-item-fx-label absolute left-1/2 -translate-x-1/2 rounded-md border border-white/20 bg-black/65 font-mono font-bold tracking-wide shadow-lg backdrop-blur-sm ${tone.label} ${
          compact
            ? "top-[-0.15rem] px-1.5 py-px text-[9px]"
            : "top-[10%] px-2.5 py-0.5 text-[13px]"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
