import Image from "next/image";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";

export type HomeSquadCardLabels = {
  hp: string;
  exp: string;
  expToNext: string;
  atk: string;
  def: string;
  spAtk: string;
  spDef: string;
  speed: string;
  level: string;
  lead: string;
  slot: string;
  fainted: string;
};

/** Compact team-card look for the Home 6-up roster (links to /team). */
export function HomeSquadCard({
  slot,
  isLead,
  nickname,
  speciesName,
  level,
  types,
  spriteUrl,
  currentHp,
  maxHp,
  xpPct,
  xpToNextLabel,
  atk,
  def,
  spAtk,
  spDef,
  speed,
  moves,
  labels,
}: {
  slot: number;
  isLead: boolean;
  nickname: string | null;
  speciesName: string;
  level: number;
  types: string[];
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
  xpPct: number;
  xpToNextLabel: string;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
  moves: { name: string; type: string }[];
  labels: HomeSquadCardLabels;
}) {
  const displayName = nickname ?? speciesName;
  const primaryType = types[0] ?? "normal";
  const accent = typeColor(primaryType);
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  const fainted = currentHp <= 0;

  return (
    <Link
      href="/team"
      className={`team-card group relative flex flex-col overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-0.5 ${
        isLead
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

      <div className="relative flex flex-1 flex-col p-2.5">
        <div className="mb-0.5 flex items-start justify-between gap-1">
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant">
              {labels.slot}
            </span>
            {isLead && (
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
            {labels.level}
          </span>
        </div>

        <div className="relative mx-auto my-0.5 flex h-[72px] w-full items-center justify-center">
          <div
            className="absolute bottom-1 h-7 w-14 rounded-[100%] opacity-45 blur-lg"
            style={{ background: accent }}
          />
          {spriteUrl ? (
            <Image
              src={spriteUrl}
              alt={speciesName}
              width={72}
              height={72}
              className={`relative z-[1] h-[72px] w-[72px] object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] transition duration-300 group-hover:scale-105 ${
                fainted ? "grayscale" : ""
              }`}
            />
          ) : (
            <span className="material-symbols-outlined relative z-[1] text-[36px] text-on-surface-variant/40">
              catching_pokemon
            </span>
          )}
        </div>

        <div className="mb-1.5 text-center">
          <p className="truncate text-[13px] font-bold capitalize leading-tight tracking-tight text-white">
            {displayName}
          </p>
          {nickname && (
            <p className="mt-0.5 text-[10px] capitalize text-on-surface-variant">{speciesName}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
            {types.map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white"
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

        <div className="mb-1.5 rounded-xl border border-white/[0.06] bg-black/25 px-2 py-1.5">
          <div className="mb-0.5 flex items-end justify-between">
            <span className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant">
              {labels.hp}
            </span>
            <span className="font-mono text-[10px] font-semibold text-white">
              {currentHp}
              <span className="text-on-surface-variant">/{maxHp}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${hpBarClass(hpPct)}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-1">
            <span className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant">
              {labels.exp}
            </span>
            <span className="truncate text-[8px] text-on-surface-variant">{xpToNextLabel}</span>
          </div>
          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-tertiary/80 to-tertiary"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        <div className="mb-1.5 grid grid-cols-5 gap-0.5">
          <StatChip label={labels.atk} value={atk} />
          <StatChip label={labels.def} value={def} />
          <StatChip label={labels.spAtk} value={spAtk} />
          <StatChip label={labels.spDef} value={spDef} />
          <StatChip label={labels.speed} value={speed} />
        </div>

        <div className="mt-auto grid grid-cols-2 gap-0.5">
          {moves.slice(0, 4).map((move) => {
            const color = typeColor(move.type);
            return (
              <div
                key={`${slot}-${move.name}`}
                className="flex items-center justify-between gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-1 py-0.5"
              >
                <span className="truncate text-[9px] font-medium capitalize text-on-surface">
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
      </div>
    </Link>
  );
}

export function HomeEmptySquadSlot({ label }: { label: string }) {
  return (
    <Link
      href="/team"
      className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.015] px-3 py-5 text-center transition hover:border-white/20 hover:bg-white/[0.03]"
    >
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.02]">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant/50">add</span>
      </div>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
    </Link>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.03] px-0.5 py-1 text-center">
      <p className="text-[7px] font-bold uppercase leading-none tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[10px] font-semibold leading-none text-white">{value}</p>
    </div>
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
