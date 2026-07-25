import Image from "next/image";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import {
  SquadCardContextMenu,
  type SquadContextLabels,
} from "@/components/squad-card-context-menu";

export type HomeSquadCardLabels = {
  hp: string;
  level: string;
  slot: string;
  lead: string;
  fainted: string;
  favorite: string;
  tradeLocked: string;
};

/**
 * Card del equipo en el dashboard: vista de un vistazo, no ficha técnica.
 * Click izquierdo → /team. Click derecho / ⋮ → favorito, bloqueo de venta, etc.
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
  xpPct,
  xpToNextLabel,
  labels,
  menuLabels,
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
  xpPct: number;
  xpToNextLabel: string;
  labels: HomeSquadCardLabels;
  menuLabels: SquadContextLabels;
}) {
  const displayName = nickname ?? speciesName;
  const primaryType = types[0] ?? "normal";
  const accent = typeColor(primaryType);
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  const fainted = currentHp <= 0;

  return (
    <SquadCardContextMenu
      instanceId={instanceId}
      isFavorite={isFavorite}
      isTradeLocked={isTradeLocked}
      labels={menuLabels}
    >
      <Link
        href="/team"
        title={`${displayName} · ${labels.level}`}
        className={`team-card group relative flex flex-col overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1 ${
          isLead || isFavorite
            ? "border-pokeball-red/45 shadow-[0_12px_32px_rgba(238,21,21,0.14)]"
            : "border-white/[0.08] hover:border-white/25"
        } ${fainted ? "opacity-75" : ""}`}
        style={{ "--type-accent": accent } as CSSProperties}
      >
        <div
          className="pointer-events-none absolute -top-12 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full opacity-40 blur-3xl transition-opacity duration-300 group-hover:opacity-70"
          style={{ background: accent }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.05] via-transparent to-black/25" />

        <div className="relative flex flex-1 flex-col p-2">
          <div className="flex items-center justify-between gap-1 pr-6">
            <div className="flex items-center gap-1">
              {isLead ? (
                <span
                  className="flex items-center gap-0.5 rounded-full bg-pokeball-red px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                  title={labels.lead}
                >
                  <span className="material-symbols-outlined text-[11px]! leading-none">military_tech</span>
                </span>
              ) : (
                <span className="text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
                  {labels.slot}
                </span>
              )}
              {isFavorite && (
                <span
                  className="flex items-center rounded-full bg-electric-yellow/20 px-1 py-0.5 text-electric-yellow"
                  title={labels.favorite}
                >
                  <span className="material-symbols-outlined text-[12px]! leading-none">star</span>
                </span>
              )}
              {isTradeLocked && (
                <span
                  className="flex items-center rounded-full bg-white/10 px-1 py-0.5 text-on-surface-variant"
                  title={labels.tradeLocked}
                >
                  <span className="material-symbols-outlined text-[12px]! leading-none">lock</span>
                </span>
              )}
            </div>
            <span className="rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
              {labels.level}
            </span>
          </div>

          <div className="relative mx-auto flex h-[88px] w-full items-center justify-center">
            <div
              className="absolute bottom-1.5 h-6 w-14 rounded-[100%] opacity-50 blur-md transition-all duration-300 group-hover:w-16 group-hover:opacity-70"
              style={{ background: accent }}
            />
            {spriteUrl ? (
              <Image
                src={spriteUrl}
                alt={speciesName}
                width={88}
                height={88}
                className={`relative z-[1] h-[88px] w-[88px] object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.55)] transition duration-300 group-hover:-translate-y-1 group-hover:scale-110 ${
                  fainted ? "grayscale" : ""
                }`}
              />
            ) : (
              <span className="material-symbols-outlined relative z-[1] text-[40px]! text-on-surface-variant/40">
                sports_baseball
              </span>
            )}
            {fainted && (
              <span
                className="absolute right-0 top-0 rounded-full bg-error/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-error"
                title={labels.fainted}
              >
                <span className="material-symbols-outlined text-[11px]! leading-none">
                  sentiment_very_dissatisfied
                </span>
              </span>
            )}
          </div>

          <p className="truncate text-center text-[13px] font-bold capitalize leading-tight tracking-tight text-white">
            {displayName}
          </p>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
            {types.map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white"
                  style={{
                    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                    boxShadow: `0 2px 8px ${color}44`,
                  }}
                >
                  {type}
                </span>
              );
            })}
          </div>

          <div className="mt-auto pt-2">
            <div className="mb-0.5 flex items-baseline justify-between">
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
            <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-white/10" title={xpToNextLabel}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-tertiary/80 to-tertiary"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>
        </div>
      </Link>
    </SquadCardContextMenu>
  );
}

export function HomeEmptySquadSlot({ label }: { label: string }) {
  return (
    <Link
      href="/team"
      className="group flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.015] px-2 py-4 text-center transition hover:border-white/25 hover:bg-white/[0.03]"
    >
      <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.02] transition group-hover:border-white/30">
        <span className="material-symbols-outlined text-[18px]! text-on-surface-variant/50">add</span>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-on-surface-variant/70">{label}</p>
    </Link>
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
