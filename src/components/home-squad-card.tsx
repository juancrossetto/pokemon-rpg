"use client";

import Image from "next/image";
import type { CSSProperties, MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import {
  SquadCardContextMenu,
  type SquadContextLabels,
} from "@/components/squad-card-context-menu";
import type { SquadBagCounts } from "@/lib/squad-bag";
import { SquadCardSheet, type SquadCardSheetLabels } from "@/components/squad-card-sheet";
import type { EvolutionStage } from "@/lib/evolution-chain";

export type HomeSquadMove = {
  slot: number;
  name: string;
  type: string;
  currentPp: number;
  maxPp: number;
};

export type HomeSquadCardLabels = {
  hp: string;
  exp: string;
  atk: string;
  def: string;
  spAtk: string;
  spDef: string;
  speed: string;
  level: string;
  slot: string;
  lead: string;
  fainted: string;
  favorite: string;
  tradeLocked: string;
  pp: string;
  emptyMove: string;
  tabAbout: string;
  tabStats: string;
  tabEvolutions: string;
  unknownSpecies: string;
  evolveAtLevel: string;
};

/**
 * Card del equipo en el dashboard — hero + solapas About / Stats / Evolutions.
 */
export function HomeSquadCard({
  instanceId,
  isLead,
  isFavorite,
  isTradeLocked,
  nickname,
  speciesName,
  types,
  spriteUrl,
  currentHp,
  maxHp,
  level,
  xpPct,
  atk,
  def,
  spAtk,
  spDef,
  speed,
  evolutionChain,
  moves,
  labels,
  menuLabels,
  bagCounts,
  onBagChange,
  onHealed,
  onLeveledUp,
  onPpRestored,
  onCardClick,
}: {
  instanceId: string;
  isLead: boolean;
  isFavorite: boolean;
  isTradeLocked: boolean;
  nickname: string | null;
  speciesName: string;
  types: string[];
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
  level: number;
  xpPct: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
  evolutionChain: EvolutionStage[];
  moves: (HomeSquadMove | null)[];
  labels: HomeSquadCardLabels;
  menuLabels: SquadContextLabels;
  bagCounts: SquadBagCounts;
  onBagChange?: (next: SquadBagCounts) => void;
  onHealed?: (next: { currentHp: number; maxHp: number }) => void;
  onLeveledUp?: (next: {
    level: number;
    currentHp: number;
    maxHp: number;
    levelLabel: string;
  }) => void;
  onPpRestored?: (next: {
    moveName: string;
    restoredBy: number;
    allMoves: boolean;
  }) => void;
  onCardClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const tTeam = useTranslations("team");
  const displayName = nickname ?? speciesName;
  const primaryType = types[0] ?? "normal";
  const accent = typeColor(primaryType);
  const fainted = currentHp <= 0;

  const sheetLabels: SquadCardSheetLabels = {
    tabAbout: labels.tabAbout,
    tabStats: labels.tabStats,
    tabEvolutions: labels.tabEvolutions,
    hp: labels.hp,
    exp: labels.exp,
    atk: labels.atk,
    def: labels.def,
    spAtk: labels.spAtk,
    spDef: labels.spDef,
    speed: labels.speed,
    emptyMove: labels.emptyMove,
    unknownSpecies: labels.unknownSpecies,
    evolveAtLevel: labels.evolveAtLevel,
  };

  return (
    <SquadCardContextMenu
      instanceId={instanceId}
      pokemonName={displayName}
      currentHp={currentHp}
      maxHp={maxHp}
      level={level}
      isFavorite={isFavorite}
      isTradeLocked={isTradeLocked}
      canHeal={currentHp < maxHp}
      canLevelUp={level < 100}
      labels={menuLabels}
      bagCounts={bagCounts}
      onBagChange={onBagChange}
      onHealed={onHealed}
      onPpRestored={onPpRestored}
      onLeveledUp={
        onLeveledUp
          ? (next) =>
              onLeveledUp({
                ...next,
                levelLabel: tTeam("level", { level: next.level }),
              })
          : undefined
      }
    >
      <div
        className={`team-card group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border transition duration-300 hover:-translate-y-1 ${
          isLead || isFavorite
            ? "border-pokeball-red/35 shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
            : "border-white/[0.07] hover:border-white/20"
        } ${fainted ? "opacity-75" : ""}`}
        style={{ "--type-accent": accent } as CSSProperties}
      >
        <Link
          href="/team"
          title={`${displayName} · ${labels.level}`}
          draggable={false}
          onClick={onCardClick}
          className="relative flex min-h-[128px] flex-col items-center justify-end px-2 pb-0 pt-7"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 90% 70% at 50% 40%, ${accent}66 0%, transparent 72%)`,
            }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-[42%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07]"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, transparent 36%, currentColor 37%, currentColor 48%, transparent 49%)",
              color: accent,
            }}
            aria-hidden
          />

          <div className="absolute left-2.5 top-2.5 z-[2] flex items-center gap-1">
            {isLead ? (
              <span className="flex items-center text-violet-300" title={labels.lead}>
                <span className="material-symbols-outlined text-[16px]! leading-none">
                  military_tech
                </span>
              </span>
            ) : (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/45">
                {labels.slot}
              </span>
            )}
            {isFavorite && (
              <span className="flex items-center text-electric-yellow" title={labels.favorite}>
                <span className="material-symbols-outlined text-[15px]! leading-none">star</span>
              </span>
            )}
            {isTradeLocked && (
              <span className="flex items-center text-white/50" title={labels.tradeLocked}>
                <span className="material-symbols-outlined text-[14px]! leading-none">lock</span>
              </span>
            )}
          </div>
          <span className="absolute right-2.5 top-2.5 z-[2] rounded-full border border-white/15 bg-black/45 px-2 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur-sm">
            {labels.level}
          </span>

          <div className="relative z-[1] flex h-[96px] w-full items-end justify-center">
            <div
              className="absolute bottom-0 h-6 w-14 rounded-[100%] opacity-55 blur-lg transition group-hover:opacity-75"
              style={{ background: accent }}
            />
            {spriteUrl ? (
              <Image
                src={spriteUrl}
                alt={speciesName}
                width={96}
                height={96}
                className={`relative z-[1] h-24 w-24 object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.65)] transition duration-300 group-hover:-translate-y-1.5 group-hover:scale-110 ${
                  fainted ? "grayscale" : ""
                }`}
              />
            ) : (
              <span className="material-symbols-outlined relative z-[1] text-[40px]! text-white/25">
                sports_baseball
              </span>
            )}
          </div>
        </Link>

        <div className="relative z-[1] flex flex-1 flex-col bg-gradient-to-b from-transparent to-black/25 px-2.5 pb-2.5 pt-1">
          <h2 className="truncate text-center text-[13px] font-bold capitalize tracking-tight text-white">
            {displayName}
          </h2>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
            {types.map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="rounded-full border border-white/10 bg-black/40 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide"
                  style={{ color }}
                >
                  {type}
                </span>
              );
            })}
            {fainted && (
              <span className="rounded-full bg-error/20 px-1.5 py-0.5 text-[7px] font-bold uppercase text-error">
                {labels.fainted}
              </span>
            )}
          </div>

          <div className="mt-2 flex-1">
            <SquadCardSheet
              compact
              labels={sheetLabels}
              moves={moves}
              currentHp={currentHp}
              maxHp={maxHp}
              xpPct={xpPct}
              atk={atk}
              def={def}
              spAtk={spAtk}
              spDef={spDef}
              speed={speed}
              evolutionChain={evolutionChain}
            />
          </div>
        </div>
      </div>
    </SquadCardContextMenu>
  );
}

export function HomeEmptySquadSlot({ label }: { label: string }) {
  return (
    <Link
      href="/team"
      className="group flex h-full min-h-[300px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.015] px-2 py-4 text-center transition hover:border-white/25 hover:bg-white/[0.03]"
    >
      <div className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.02] transition group-hover:border-white/30">
        <span className="material-symbols-outlined text-[20px]! text-on-surface-variant/50">add</span>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-on-surface-variant/70">{label}</p>
    </Link>
  );
}
