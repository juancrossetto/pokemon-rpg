"use client";

// Piezas presentacionales de la arena: sidebars de equipo, íconos de party,
// placas de HP y badges de estado. No tienen estado propio — todo lo delicado
// (timeline de animaciones) queda en battle-arena.tsx.

import Image from "next/image";
import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PokeballIcon } from "@/components/pokeball-icon";
import { TrainerAvatar } from "@/components/trainer-avatar";
import {
  BATTLE_STATS,
  isStatusCondition,
  statLabelKey,
  statusAbbrKey,
  statusLabelKey,
  type StatStages,
} from "@/lib/status";

export function PartySidebar({
  name,
  portraitUrl,
  align,
  compact,
  variant = "party",
  featuredSpriteUrl = null,
  children,
}: {
  name: string;
  portraitUrl: string | null;
  align: "left" | "right";
  compact?: boolean;
  /** Encuentro salvaje: un solo sprite, sin grilla de 6. */
  variant?: "party" | "wild";
  featuredSpriteUrl?: string | null;
  children: ReactNode;
}) {
  const pixelPortrait = Boolean(portraitUrl?.startsWith("http"));
  const isWild = variant === "wild";

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/25 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {isWild && featuredSpriteUrl ? (
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-pokeball-red/45 bg-[#16181f] shadow-[0_0_12px_color-mix(in_srgb,var(--color-pokeball-red)_22%,transparent)]">
            <Image
              src={featuredSpriteUrl}
              alt=""
              width={36}
              height={36}
              className="h-8 w-8 object-contain"
              unoptimized
            />
          </span>
        ) : (
          <TrainerAvatar
            name={name}
            src={portraitUrl}
            size="xs"
            pixel={pixelPortrait}
            className="shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <p
            title={name}
            className={`truncate text-[11px] font-semibold leading-tight text-white/85 ${
              align === "right" ? "text-right" : ""
            }`}
          >
            {name}
          </p>
          {!isWild ? (
            <div className={`mt-1 flex flex-wrap gap-1 ${align === "right" ? "justify-end" : ""}`}>
              {children}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (isWild) {
    return (
      <div className="flex h-full min-w-0 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.055] via-[#12141a]/92 to-black/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_32px_rgba(0,0,0,0.35)]">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
          {name}
        </p>
        <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-pokeball-red/12 blur-xl"
          />
          <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/12 bg-[#0c0e14]/85">
            {featuredSpriteUrl ? (
              <Image
                src={featuredSpriteUrl}
                alt=""
                width={96}
                height={96}
                className="h-[88%] w-[88%] object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]"
                unoptimized
              />
            ) : (
              <PokeballIcon className="h-8 w-8 opacity-35" />
            )}
          </span>
        </div>
        {/* Doubles salvajes: hasta 2 íconos chicos debajo, sin pads vacíos. */}
        {children ? <div className="flex justify-center gap-1.5">{children}</div> : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-2.5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.055] via-[#12141a]/92 to-black/40 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_32px_rgba(0,0,0,0.35)]">
      <div
        className={`flex items-center gap-2.5 ${
          align === "right" ? "flex-row-reverse text-right" : ""
        }`}
      >
        <span className="relative shrink-0">
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-[32%] bg-pokeball-red/15 blur-md"
          />
          <TrainerAvatar
            name={name}
            src={portraitUrl}
            size="lg"
            pixel={pixelPortrait}
            className="relative"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p
            title={name}
            className="line-clamp-2 text-[13px] font-semibold leading-snug text-white"
          >
            {name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">{children}</div>
    </div>
  );
}

export function PartyIcon({
  spriteUrl,
  name,
  fainted,
  active,
  hpPct,
  compact = false,
}: {
  spriteUrl: string;
  name: string;
  fainted: boolean;
  active: boolean;
  hpPct?: number;
  compact?: boolean;
}) {
  return (
    <div
      title={name}
      className={`relative flex items-center justify-center overflow-hidden rounded-xl border bg-[#16181f]/90 ${
        compact ? "h-8 w-8 shrink-0" : "aspect-square"
      } ${
        active
          ? "border-pokeball-red/80 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-pokeball-red)_35%,transparent),0_0_12px_color-mix(in_srgb,var(--color-pokeball-red)_25%,transparent)]"
          : "border-white/10"
      } ${fainted ? "opacity-70 grayscale-[0.45]" : ""}`}
    >
      {spriteUrl ? (
        <Image
          src={spriteUrl}
          alt={name}
          width={compact ? 28 : 40}
          height={compact ? 28 : 40}
          className={
            compact
              ? "h-6 w-6 object-contain"
              : "h-[85%] w-[85%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
          }
        />
      ) : (
        <PokeballIcon className={compact ? "h-3.5 w-3.5 opacity-40" : "h-5 w-5 opacity-40"} />
      )}
      {fainted ? (
        <span className="material-symbols-outlined absolute right-0 top-0 text-[10px]! text-error drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          skull
        </span>
      ) : null}
      {typeof hpPct === "number" && !fainted ? (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-black/55 ${compact ? "h-0.5" : "h-[3px]"}`}
        >
          <div
            className={`h-full ${
              hpPct > 50 ? "bg-electric-yellow" : hpPct > 20 ? "bg-amber-400" : "bg-error"
            }`}
            style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function EmptyPartySlot({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-black/25 ${
        compact ? "h-8 w-8 shrink-0" : "aspect-square"
      }`}
    >
      <PokeballIcon className={compact ? "h-3 w-3 opacity-20" : "h-4 w-4 opacity-25"} />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("battle");
  if (!isStatusCondition(status)) return null;

  const tone =
    status === "POISON"
      ? "poison"
      : status === "BURN"
        ? "burn"
        : status === "PARALYSIS"
          ? "paralysis"
          : status === "FREEZE"
            ? "freeze"
            : "sleep";

  return (
    <span
      className={`battle-status-badge battle-status-badge--${tone}`}
      title={t(statusLabelKey(status))}
      aria-label={t(statusLabelKey(status))}
    >
      {t(statusAbbrKey(status))}
    </span>
  );
}

/** Chips de stat subido/bajado. Sin esto, un Growl repetido solo dejaba una
 *  línea vieja en el log y el jugador no sabía cuánto acumuló. */
function StageBadges({ stages, align }: { stages: StatStages; align: "left" | "right" }) {
  const tLog = useTranslations("battle.log");
  const active = BATTLE_STATS.filter((stat) => stages[stat] !== 0);
  if (active.length === 0) return null;

  return (
    <div className={`mt-0.5 flex flex-wrap gap-1 ${align === "right" ? "justify-end" : ""}`}>
      {active.map((stat) => {
        const value = stages[stat];
        const up = value > 0;
        const label = tLog(statLabelKey(stat));
        return (
          <span
            key={stat}
            className={`rounded-md px-1 text-[8px] font-bold uppercase leading-tight tabular-nums md:text-[9px] ${
              up
                ? "bg-electric-yellow/20 text-electric-yellow"
                : "bg-error/20 text-error"
            }`}
            title={`${label} ${up ? "+" : ""}${value}`}
          >
            {label.slice(0, 3)} {up ? "▲" : "▼"}
            {Math.abs(value)}
          </span>
        );
      })}
    </div>
  );
}

export function HpPlate({
  name,
  levelLabel,
  currentHp,
  maxHp,
  status,
  stages,
  align = "left",
  className = "",
}: {
  name: string;
  levelLabel: string;
  currentHp: number;
  maxHp: number;
  status?: string | null;
  stages?: StatStages;
  align?: "left" | "right";
  className?: string;
}) {
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  const hpClass = hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red";
  const critical = hpPct > 0 && hpPct <= 20;

  return (
    <div
      className={`rounded-xl border bg-[#0c0e14]/78 px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md md:px-3 md:py-2 ${
        critical ? "border-error/70 hp-plate-critical" : "border-white/12"
      } ${className}`}
    >
      <div
        className={`flex items-center gap-1.5 md:gap-2 ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        <span className="min-w-0 truncate text-[11px] font-semibold capitalize text-white md:text-label-md">
          {name}
        </span>
        <span className="shrink-0 text-[10px] text-white/55 md:text-label-sm">{levelLabel}</span>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/12 md:mt-1.5 md:h-2">
        <div
          className={`h-full health-bar-fill ${hpClass}${critical ? " hp-bar-critical" : ""}`}
          style={{ width: `${hpPct}%` }}
        />
      </div>
      <p
        className={`mt-0.5 text-[9px] tabular-nums md:text-[10px] ${
          align === "right" ? "text-right" : ""
        } ${critical ? "font-bold text-error" : "text-white/55"}`}
      >
        {Math.round(hpPct)}% · {currentHp}/{maxHp}
      </p>
      {stages ? <StageBadges stages={stages} align={align} /> : null}
    </div>
  );
}

export function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="text-label-md font-bold text-on-surface">{value}</p>
    </div>
  );
}
