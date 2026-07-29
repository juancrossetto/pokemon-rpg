"use client";

import Image from "next/image";
import type { DexRarity } from "@/lib/pokedex";
import { typeColor } from "@/lib/type-colors";
import { showdownTypeSymbolUrl } from "@/lib/type-icons";
import { uiSpriteUrl } from "@/lib/sprites";
import { ProgressRail } from "@/components/trainer-profile-parts";
import { useTypeLabel } from "@/hooks/use-type-label";

export type SquadBandMember = {
  instanceId: string;
  name: string;
  spriteUrl: string;
  level: number;
  currentHp: number;
  maxHp: number;
  cp: number;
  types: string[];
  accent: string;
  rarity: DexRarity;
  isShiny: boolean;
};

export type SquadBandLabels = {
  lead: string;
  level: string;
  cp: string;
  hp: string;
  shiny: string;
  empty: string;
  rarity: Record<string, string>;
};

/**
 * Active Squad del perfil: seis slots al mismo peso visual.
 * Sin podium de líder ni auras tipadas — el equipo se lee como un conjunto.
 */
export function TrainerSquadBand({
  members,
  labels,
}: {
  members: (SquadBandMember | null)[];
  labels: SquadBandLabels;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {members.map((member, i) => {
        if (!member) {
          return (
            <li
              key={`empty-${i}`}
              className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.015]"
            >
              <span className="material-symbols-outlined text-[24px]! text-white/25">add</span>
              <p className="mt-1 text-[8px] uppercase tracking-[0.14em] text-white/30">
                {labels.empty}
              </p>
            </li>
          );
        }

        const isLead = i === 0;
        const primary = member.types[0] ?? "normal";
        const color = typeColor(primary);
        const hpPct = member.maxHp > 0 ? member.currentHp / member.maxHp : 0;
        const hpColor = hpPct > 0.5 ? "#4ade80" : hpPct > 0.2 ? "#facc15" : "#ef4444";

        return (
          <li
            key={member.instanceId}
            className="group relative flex min-h-[200px] flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0b0e14] transition hover:border-white/20"
            style={{
              boxShadow: `inset 0 0 0 1px ${color}28, 0 8px 20px rgba(0,0,0,0.28)`,
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-35"
              style={{
                background: `radial-gradient(ellipse at 50% 0%, ${color}40, transparent 70%)`,
              }}
            />

            <div className="absolute inset-x-0 top-0 z-[2] flex items-start justify-between p-2">
              {isLead ? (
                <span className="rounded-md bg-pokeball-red px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">
                  {labels.lead}
                </span>
              ) : (
                <span className="font-mono text-[9px] tabular-nums text-white/25">
                  {String(i + 1).padStart(2, "0")}
                </span>
              )}
              <TypeOrb type={primary} />
            </div>

            {member.isShiny && (
              <span className="material-symbols-outlined absolute left-2 top-8 z-[2] text-[12px]! text-electric-yellow">
                auto_awesome
              </span>
            )}

            <div className="relative flex flex-1 items-end justify-center px-2 pt-8 pb-1">
              <span
                aria-hidden
                className="absolute bottom-2 h-5 w-16 rounded-[100%] opacity-40 blur-md"
                style={{ background: color }}
              />
              <Image
                src={uiSpriteUrl(member.spriteUrl, member.isShiny)}
                alt={member.name}
                width={128}
                height={128}
                unoptimized
                className="relative z-[1] h-[100px] w-[100px] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)] sm:h-[110px] sm:w-[110px]"
              />
            </div>

            <div className="relative z-[1] space-y-1 border-t border-white/[0.06] bg-black/25 px-2.5 py-2">
              <p className="truncate text-center text-[12px] font-bold capitalize leading-tight text-white">
                {member.name}
              </p>
              <div className="flex items-center justify-between gap-1 font-mono text-[9px] tabular-nums text-white/60">
                <span>
                  {labels.level}
                  {member.level}
                </span>
                <span style={{ color }}>{member.cp}</span>
              </div>
              <ProgressRail pct={hpPct} color={hpColor} height={3} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TypeOrb({ type }: { type: string }) {
  const typeLabel = useTypeLabel();
  const color = typeColor(type);
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border sm:h-7 sm:w-7"
      style={{
        background: `radial-gradient(circle at 35% 30%, ${color}ee, ${color}88)`,
        borderColor: `${color}aa`,
        boxShadow: `0 0 6px ${color}33`,
      }}
      title={typeLabel(type)}
    >
      <Image
        src={showdownTypeSymbolUrl(type)}
        alt=""
        width={14}
        height={14}
        unoptimized
        className="h-3 w-3 object-contain brightness-110 sm:h-3.5 sm:w-3.5"
      />
    </span>
  );
}
