"use client";

// Piezas presentacionales de la arena: sidebars de equipo, íconos de party,
// placas de HP y badges de estado. No tienen estado propio — todo lo delicado
// (timeline de animaciones) queda en battle-arena.tsx.

import Image from "next/image";
import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PokeballIcon } from "@/components/pokeball-icon";
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
  children,
}: {
  name: string;
  portraitUrl: string | null;
  align: "left" | "right";
  compact?: boolean;
  children: ReactNode;
}) {
  const portraitIsRemote = portraitUrl?.startsWith("http") ?? false;

  if (compact) {
    return (
      <div className="glass-panel rounded-lg border border-white/10 px-3 py-2 flex items-center gap-3">
        {portraitUrl && (
          <div className="w-10 h-12 rounded overflow-hidden border border-white/15 shrink-0 bg-surface-container-high">
            <Image
              src={portraitUrl}
              alt={name}
              width={40}
              height={48}
              unoptimized={portraitIsRemote}
              className="w-full h-full object-cover object-top"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p
            title={name}
            className={`text-label-sm text-on-surface font-bold leading-tight line-clamp-2 ${
              align === "right" ? "text-right" : ""
            }`}
          >
            {name}
          </p>
          <div className={`mt-1 flex gap-1.5 ${align === "right" ? "justify-end" : ""}`}>{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl border border-white/10 p-2.5 h-full flex flex-col gap-2 min-w-0">
      <p
        title={name}
        className={`text-label-sm text-on-surface font-bold leading-tight px-0.5 line-clamp-2 ${
          align === "right" ? "text-right" : ""
        }`}
      >
        {name}
      </p>
      {portraitUrl && (
        <div className="mx-auto w-20 h-24 shrink-0 rounded-lg overflow-hidden border border-white/15 bg-surface-container-high">
          <Image
            src={portraitUrl}
            alt={name}
            width={80}
            height={96}
            unoptimized={portraitIsRemote}
            className="w-full h-full object-cover object-top"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5 mt-auto">{children}</div>
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
      className={`relative rounded-md border bg-surface-container-high/80 flex items-center justify-center overflow-hidden ${
        compact ? "h-7 w-7 shrink-0" : "aspect-square"
      } ${
        active ? "border-pokeball-red/70 ring-1 ring-pokeball-red/40" : "border-white/10"
      } ${fainted ? "opacity-35 grayscale" : ""}`}
    >
      {spriteUrl ? (
        <Image
          src={spriteUrl}
          alt={name}
          width={compact ? 28 : 40}
          height={compact ? 28 : 40}
          className={compact ? "w-6 h-6 object-contain" : "w-9 h-9 object-contain"}
        />
      ) : (
        <PokeballIcon className={compact ? "w-3.5 h-3.5 opacity-40" : "w-5 h-5 opacity-40"} />
      )}
      {typeof hpPct === "number" && !fainted && (
        <div className={`absolute bottom-0 left-0 right-0 bg-black/50 ${compact ? "h-0.5" : "h-1"}`}>
          <div
            className={`h-full ${hpPct > 50 ? "bg-emerald-400" : hpPct > 20 ? "bg-amber-400" : "bg-red-500"}`}
            style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function EmptyPartySlot({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-md border border-dashed border-white/10 bg-black/20 flex items-center justify-center ${
        compact ? "h-7 w-7 shrink-0" : "aspect-square"
      }`}
    >
      <PokeballIcon className={compact ? "w-3 h-3 opacity-25" : "w-4 h-4 opacity-25"} />
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
            className={`rounded px-1 text-[8px] md:text-[9px] font-bold uppercase leading-tight tabular-nums ${
              up ? "bg-emerald-500/25 text-emerald-200" : "bg-red-500/25 text-red-200"
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
      className={`rounded-lg border bg-black/55 backdrop-blur-sm px-2 py-1 md:px-2.5 md:py-1.5 shadow-lg ${
        critical ? "border-red-500/70 hp-plate-critical" : "border-white/15"
      } ${className}`}
    >
      <div className={`flex items-center gap-1.5 md:gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <span className="text-[11px] md:text-label-md text-white font-bold capitalize truncate min-w-0">
          {name}
        </span>
        <span className="text-[10px] md:text-label-sm text-white/70 shrink-0">{levelLabel}</span>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <div className="h-1.5 md:h-2 bg-white/15 rounded-full overflow-hidden mt-0.5 md:mt-1">
        <div
          className={`h-full health-bar-fill ${hpClass}${critical ? " hp-bar-critical" : ""}`}
          style={{ width: `${hpPct}%` }}
        />
      </div>
      <p
        className={`text-[9px] md:text-[10px] mt-0.5 ${align === "right" ? "text-right" : ""} ${
          critical ? "text-red-300 font-bold" : "text-white/70"
        }`}
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
      <p className="text-label-md text-on-surface font-bold">{value}</p>
    </div>
  );
}
