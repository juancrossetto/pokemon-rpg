"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import type { DexRarity } from "@/lib/pokedex";
import { typeColor } from "@/lib/type-colors";
import { showdownTypeSymbolUrl } from "@/lib/type-icons";
import { uiSpriteUrl } from "@/lib/sprites";
import { TypeAura } from "@/components/type-aura";
import { useTypeLabel } from "@/hooks/use-type-label";

export type FavoriteCardLabels = {
  favorite: string;
  level: string;
  cp: string;
  shiny: string;
  rarity: Record<string, string>;
  empty: string;
  emptyHint: string;
};

/**
 * Vitrina del favorito — no es una card de stats ampliada.
 * Aro de energía, partículas tipadas, sprite HOME 3D como pieza de museo.
 */
export function TrainerFavoriteCard({
  name,
  spriteUrl,
  level,
  cp,
  types,
  accent,
  rarity,
  isShiny,
  labels,
}: {
  name: string;
  spriteUrl: string;
  level: number;
  cp: number;
  types: string[];
  accent: string;
  rarity: DexRarity;
  isShiny: boolean;
  labels: FavoriteCardLabels;
}) {
  const typeLabel = useTypeLabel();
  const primary = types[0] ?? "normal";

  return (
    <section
      className="tp-rise relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-[1.6rem] border border-white/[0.1] bg-[#080a10]"
      style={{ animationDelay: "60ms" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(80% 70% at 50% 35%, ${accent}33 0%, transparent 60%),
            radial-gradient(60% 40% at 50% 100%, ${accent}14 0%, transparent 55%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse at 50% 40%, #000 20%, transparent 75%)",
        }}
      />

      <TypeAura type={primary} intensity={0.7} />

      <div className="relative z-[1] flex items-center justify-between px-4 pt-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">
          {labels.favorite}
        </p>
        <span
          className="rounded-md px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-black/75"
          style={
            {
              background:
                rarity === "legendary" || rarity === "mythical"
                  ? "linear-gradient(135deg,#f5cb46,#d4a017)"
                  : rarity === "epic"
                    ? "linear-gradient(135deg,#b98ef0,#7c4dcc)"
                    : "linear-gradient(135deg,#94a3b8,#64748b)",
            } as CSSProperties
          }
        >
          {labels.rarity[rarity] ?? rarity}
        </span>
      </div>

      {/* Aro de energía + sprite */}
      <div className="relative z-[1] flex flex-1 flex-col items-center justify-center px-4 py-2">
        <span
          aria-hidden
          className="tp-halo absolute h-44 w-44 rounded-full border sm:h-52 sm:w-52"
          style={{
            borderColor: `${accent}55`,
            boxShadow: `0 0 40px ${accent}33, inset 0 0 30px ${accent}18`,
          }}
        />
        <span
          aria-hidden
          className="absolute h-36 w-36 rounded-full border border-dashed opacity-30 sm:h-44 sm:w-44"
          style={{
            borderColor: accent,
            animation: "tp-breathe 7s ease-in-out infinite",
          }}
        />
        <span
          aria-hidden
          className="absolute bottom-[18%] h-8 w-28 rounded-[100%] opacity-50 blur-xl"
          style={{ background: accent }}
        />

        <Image
          src={uiSpriteUrl(spriteUrl, isShiny)}
          alt={name}
          width={200}
          height={200}
          unoptimized
          priority
          className="tp-sprite-float relative z-[1] h-[148px] w-[148px] object-contain drop-shadow-[0_20px_36px_rgba(0,0,0,0.55)] sm:h-[168px] sm:w-[168px]"
        />

        {isShiny && (
          <span className="absolute right-6 top-2 inline-flex items-center gap-0.5 rounded-full border border-electric-yellow/45 bg-black/55 px-1.5 py-0.5 text-[8px] font-bold uppercase text-electric-yellow">
            <span className="material-symbols-outlined text-[10px]!">auto_awesome</span>
            {labels.shiny}
          </span>
        )}
      </div>

      <div className="relative z-[1] space-y-2 border-t border-white/[0.06] bg-black/30 px-4 py-3 backdrop-blur-sm">
        <h3 className="truncate text-center text-[20px] font-black capitalize tracking-tight text-white">
          {name}
        </h3>
        <div className="flex items-center justify-center gap-4 font-mono text-[12px] tabular-nums">
          <span className="text-white/70">
            <span className="text-white/35">{labels.level}</span> {level}
          </span>
          <span className="h-3 w-px bg-white/15" />
          <span style={{ color: accent }}>
            <span className="text-white/35">{labels.cp}</span> {cp.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          {types.slice(0, 2).map((type) => {
            const c = typeColor(type);
            return (
              <span
                key={type}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border"
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${c}ee, ${c}88)`,
                  borderColor: `${c}aa`,
                  boxShadow: `0 0 8px ${c}40`,
                }}
                title={typeLabel(type)}
              >
                <Image
                  src={showdownTypeSymbolUrl(type)}
                  alt=""
                  width={14}
                  height={14}
                  unoptimized
                  className="h-3.5 w-3.5 object-contain brightness-110"
                />
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function TrainerFavoriteEmpty({ labels }: { labels: FavoriteCardLabels }) {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-[1.6rem] border border-dashed border-white/12 bg-white/[0.015] p-6 text-center">
      <span className="material-symbols-outlined text-[36px]! text-on-surface-variant/35">
        star_outline
      </span>
      <p className="text-label-md text-on-surface-variant">{labels.empty}</p>
      <p className="max-w-[15rem] text-[11px] leading-snug text-on-surface-variant/55">
        {labels.emptyHint}
      </p>
    </div>
  );
}
