"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { typeColor } from "@/lib/type-colors";
import { AllocatePointsPanel } from "@/components/allocate-points-panel";
import { PokemonDetailDrawer } from "@/components/pokemon-detail-drawer";

export interface TeamMoveDetail {
  slot: number;
  moveId: number;
  name: string;
  type: string;
  category: string;
  power: number | null;
  currentPp: number;
  maxPp: number;
}

export interface TeamCompatibleTm {
  itemId: string;
  code: string;
  quantity: number;
  moveId: number;
  moveName: string;
  moveType: string;
  moveCategory: string;
  movePower: number | null;
  alreadyKnown: boolean;
}

export interface TeamMember {
  instanceId: string;
  slot: number;
  isLead: boolean;
  nickname: string | null;
  speciesName: string;
  level: number;
  types: string[];
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
  xp: number;
  xpForCurrentLevel: number;
  xpToNext: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
  unspentPoints: number;
  points: {
    ptStrength: number;
    ptDexterity: number;
    ptIntelligence: number;
    ptSpeed: number;
    ptConstitution: number;
  };
  bases: {
    baseHp: number;
    baseAttack: number;
    baseDefense: number;
    baseSpAtk: number;
    baseSpDef: number;
    baseSpeed: number;
  };
  moves: (TeamMoveDetail | null)[];
  compatibleTms: TeamCompatibleTm[];
  levelLabel: string;
  slotLabel: string;
  expToNextLabel: string;
}

export interface TeamRosterLabels {
  hp: string;
  exp: string;
  atk: string;
  def: string;
  spAtk: string;
  spDef: string;
  speed: string;
  lead: string;
  fainted: string;
  emptySlot: string;
  slotAvailableLabels: string[];
  viewDetails: string;
  close: string;
  statsTitle: string;
  movesTitle: string;
  pp: string;
  power: string;
  noPower: string;
  emptySlotMove: string;
  tmSectionTitle: string;
  tmSectionHint: string;
  tmNone: string;
  teach: string;
  pickSlot: string;
  cancel: string;
  teaching: string;
  alreadyKnown: string;
  teachErrors: Record<string, string>;
}

export function TeamRoster({
  members,
  labels,
}: {
  members: (TeamMember | null)[];
  labels: TeamRosterLabels;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = members.find((m) => m?.instanceId === selectedId) ?? null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {members.map((member, i) =>
          member ? (
            <PokemonCard
              key={member.instanceId}
              member={member}
              labels={labels}
              onOpen={() => setSelectedId(member.instanceId)}
            />
          ) : (
            <EmptySlot
              key={`empty-${i}`}
              label={labels.emptySlot}
              hint={labels.slotAvailableLabels[i]}
            />
          ),
        )}
      </div>

      <PokemonDetailDrawer
        key={selected?.instanceId ?? "closed"}
        member={selected}
        labels={labels}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}

function PokemonCard({
  member,
  labels,
  onOpen,
}: {
  member: TeamMember;
  labels: TeamRosterLabels;
  onOpen: () => void;
}) {
  const displayName = member.nickname ?? member.speciesName;
  const primaryType = member.types[0] ?? "normal";
  const accent = typeColor(primaryType);
  const hpPct = Math.max(0, Math.min(100, (member.currentHp / member.maxHp) * 100));
  const fainted = member.currentHp <= 0;
  const xpIntoLevel = member.xp - member.xpForCurrentLevel;
  const levelSpan = xpIntoLevel + member.xpToNext;
  const xpPct = levelSpan > 0 ? Math.max(0, Math.min(100, (xpIntoLevel / levelSpan) * 100)) : 0;
  const knownMoves = member.moves.filter((m): m is TeamMoveDetail => m !== null);

  return (
    <article
      className={`team-card group relative overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-0.5 ${
        member.isLead
          ? "border-pokeball-red/40 shadow-[0_12px_32px_rgba(238,21,21,0.12)]"
          : "border-white/[0.08] hover:border-white/20"
      } ${fainted ? "opacity-75" : ""}`}
      style={{ "--type-accent": accent } as CSSProperties}
    >
      <div
        className="pointer-events-none absolute -top-16 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full opacity-35 blur-3xl transition-opacity duration-300 group-hover:opacity-55"
        style={{ background: accent }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/20" />

      <button type="button" onClick={onOpen} className="relative flex w-full flex-col p-3 text-left">
        <div className="mb-0.5 flex items-start justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant">
              {member.slotLabel}
            </span>
            {member.isLead && (
              <span className="rounded-full bg-pokeball-red px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                {labels.lead}
              </span>
            )}
            {fainted && (
              <span className="rounded-full bg-error/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-error">
                {labels.fainted}
              </span>
            )}
          </div>
          <span className="rounded-full border border-white/10 bg-black/25 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
            {member.levelLabel}
          </span>
        </div>

        <div className="relative mx-auto my-0.5 flex h-20 w-full items-center justify-center">
          <div
            className="absolute bottom-1 h-8 w-16 rounded-[100%] opacity-45 blur-lg"
            style={{ background: accent }}
          />
          {member.spriteUrl ? (
            <Image
              src={member.spriteUrl}
              alt={member.speciesName}
              width={80}
              height={80}
              className={`relative z-[1] h-20 w-20 object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] transition duration-300 group-hover:scale-105 ${
                fainted ? "grayscale" : ""
              }`}
            />
          ) : (
            <span className="material-symbols-outlined relative z-[1] text-[40px] text-on-surface-variant/40">
              catching_pokemon
            </span>
          )}
        </div>

        <div className="mb-2 text-center">
          <h2 className="truncate text-sm font-bold tracking-tight text-white capitalize leading-tight">
            {displayName}
          </h2>
          {member.nickname && (
            <p className="mt-0.5 text-[10px] capitalize text-on-surface-variant">{member.speciesName}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
            {member.types.map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                  style={{
                    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                    boxShadow: `0 2px 8px ${color}33`,
                  }}
                >
                  {type}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mb-2 rounded-xl border border-white/[0.06] bg-black/25 px-2.5 py-2">
          <div className="mb-1 flex items-end justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
              {labels.hp}
            </span>
            <span className="font-mono text-[11px] font-semibold text-white">
              {member.currentHp}
              <span className="text-on-surface-variant">/{member.maxHp}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${hpBarClass(hpPct)}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
              {labels.exp}
            </span>
            <span className="truncate text-[9px] text-on-surface-variant">
              {member.expToNextLabel}
            </span>
          </div>
          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-tertiary/80 to-tertiary"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        <div className="mb-2 grid grid-cols-5 gap-1">
          <StatChip label={labels.atk} value={member.atk} />
          <StatChip label={labels.def} value={member.def} />
          <StatChip label={labels.spAtk} value={member.spAtk} />
          <StatChip label={labels.spDef} value={member.spDef} />
          <StatChip label={labels.speed} value={member.speed} />
        </div>

        <div className="grid grid-cols-2 gap-1">
          {knownMoves.map((move) => {
            const color = typeColor(move.type);
            return (
              <div
                key={move.slot}
                className="flex items-center justify-between gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-1.5 py-1"
              >
                <span className="truncate text-[10px] font-medium capitalize text-on-surface">
                  {move.name}
                </span>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  title={move.type}
                  style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
                />
              </div>
            );
          })}
        </div>

        <span className="mt-1.5 flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-on-surface-variant/70 transition group-hover:text-on-surface-variant">
          <span className="material-symbols-outlined text-[12px]">visibility</span>
          {labels.viewDetails}
        </span>
      </button>

      <div className="relative px-3 pb-3" onClick={(e) => e.stopPropagation()}>
        <AllocatePointsPanel
          instanceId={member.instanceId}
          level={member.level}
          unspentPoints={member.unspentPoints}
          points={member.points}
          bases={member.bases}
        />
      </div>
    </article>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-0.5 py-1 text-center">
      <p className="text-[8px] font-bold uppercase tracking-wide text-on-surface-variant leading-none">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[11px] font-semibold text-white leading-none">{value}</p>
    </div>
  );
}

function EmptySlot({ label, hint }: { label: string; hint: string }) {
  return (
    <article className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.015] px-4 py-6 text-center transition hover:border-white/20 hover:bg-white/[0.03]">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.02]">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant/50">add</span>
      </div>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="mt-0.5 text-[10px] text-on-surface-variant/60">{hint}</p>
    </article>
  );
}

function hpBarClass(pct: number): string {
  if (pct > 50) {
    return "bg-gradient-to-r from-emerald-500 to-lime-400 shadow-[0_0_12px_rgba(74,222,128,0.45)]";
  }
  if (pct > 20) {
    return "bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.4)]";
  }
  return "bg-gradient-to-r from-red-600 to-rose-400 shadow-[0_0_12px_rgba(248,113,113,0.45)]";
}
