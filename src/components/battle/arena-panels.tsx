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

function hpTone(hpPct: number): "" | "yellow" | "red" {
  if (hpPct > 50) return "";
  if (hpPct > 20) return "yellow";
  return "red";
}

/** Una sola barra rectangular: verde → verde flúor. */
function PartyHpLine({ hpPct }: { hpPct: number }) {
  return (
    <div className="mx-[10%] h-[3px] w-[80%] overflow-hidden rounded-[1px] bg-white/12">
      <div
        className={`health-bar-fill h-full rounded-none ${hpTone(hpPct)}`}
        style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }}
      />
    </div>
  );
}

export function PartySidebar({
  name,
  portraitUrl,
  align,
  compact,
  variant = "party",
  featuredSpriteUrl = null,
  featuredLevel = null,
  encounterPlace = null,
  children,
}: {
  name: string;
  portraitUrl: string | null;
  align: "left" | "right";
  compact?: boolean;
  /** Encuentro sin entrenador (salvaje / torre): sprite destacado, sin grilla de 6. */
  variant?: "party" | "wild";
  /** Sprite del mon activo. */
  featuredSpriteUrl?: string | null;
  /** Nivel del mon activo (sidebar salvaje). */
  featuredLevel?: number | null;
  /** Lugar del encuentro (ruta/piso/torre). */
  encounterPlace?: {
    title: string;
    subtitle: string | null;
    iconUrl?: string | null;
  } | null;
  children: ReactNode;
}) {
  const t = useTranslations("battle");
  const pixelPortrait = Boolean(portraitUrl?.startsWith("http"));
  const isWild = variant === "wild";
  const hasChildren = Boolean(children);
  const placeIconUrl = encounterPlace?.iconUrl ?? null;

  if (compact && isWild && (encounterPlace || featuredLevel != null)) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-black/30 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        {encounterPlace ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-hidden
              className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-secondary/40 bg-secondary/20 shadow-[0_0_12px_color-mix(in_srgb,var(--theme-secondary)_40%,transparent)]"
            >
              <span className="absolute inset-0 rounded-full bg-secondary/25 blur-md" />
              {placeIconUrl ? (
                <Image
                  src={placeIconUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="relative h-full w-full object-cover"
                  sizes="32px"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="relative h-3.5 w-3.5 text-secondary"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 2.5c.4 2.8 2.2 5 4.8 6.2-1.6.7-2.8 2-3.4 3.6-.6-1.6-1.8-2.9-3.4-3.6C12.6 7.5 14.4 5.3 12 2.5Zm0 10.2c1.7 1.4 2.8 3.5 2.8 5.8 0 1.8-1.3 3.5-2.8 3.5s-2.8-1.7-2.8-3.5c0-2.3 1.1-4.4 2.8-5.8Z" />
                </svg>
              )}
            </span>
            <div className="min-w-0">
              <p
                title={encounterPlace.title}
                className="truncate text-[11px] font-bold leading-tight text-white/92"
              >
                {encounterPlace.title}
              </p>
              {encounterPlace.subtitle ? (
                <p
                  title={encounterPlace.subtitle}
                  className="truncate text-[10px] font-medium leading-tight text-secondary"
                >
                  {encounterPlace.subtitle}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        {hasChildren ? (
          <div className="flex shrink-0 items-stretch gap-1">{children}</div>
        ) : null}
        <div className="flex shrink-0 items-center gap-1.5">
          {featuredSpriteUrl ? (
            <span className="relative flex h-10 w-10 items-center justify-center">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full bg-secondary/25 blur-md"
              />
              <Image
                src={featuredSpriteUrl}
                alt=""
                width={40}
                height={40}
                className="relative h-9 w-9 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
                unoptimized
              />
            </span>
          ) : null}
          <div className="min-w-0 text-left">
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-secondary">
              {t("wildTag")}
            </p>
            <p
              title={name}
              className="max-w-[6.5rem] truncate text-[11px] font-bold uppercase leading-tight text-white"
            >
              {name}
            </p>
            {featuredLevel != null ? (
              <p className="text-[9px] leading-tight text-white/55">
                {t("level", { level: featuredLevel })}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-black/30 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        <div className="flex w-[3.25rem] shrink-0 flex-col items-center gap-0.5">
          {isWild && featuredSpriteUrl ? (
            <span className="relative flex h-10 w-10 items-center justify-center">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full bg-primary/25 blur-md"
              />
              <Image
                src={featuredSpriteUrl}
                alt=""
                width={40}
                height={40}
                className="relative h-9 w-9 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
                unoptimized
              />
            </span>
          ) : (
            <span className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-1 rounded-[28%] bg-primary/20 blur-md"
              />
              <TrainerAvatar
                name={name}
                src={portraitUrl}
                size="sm"
                pixel={pixelPortrait}
                className="relative"
              />
            </span>
          )}
          <p
            title={name}
            className="w-full truncate text-center text-[9px] font-bold leading-tight text-white/90"
          >
            {name}
          </p>
        </div>
        {hasChildren ? (
          <div className="flex min-w-0 flex-1 items-stretch gap-1.5">{children}</div>
        ) : null}
      </div>
    );
  }

  if (isWild) {
    const placeIcon = encounterPlace?.iconUrl ?? null;
    return (
      <div className="flex h-full min-w-0 flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.055] via-[#12141a]/92 to-black/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_32px_rgba(0,0,0,0.35)]">
        {encounterPlace ? (
          <div className="flex min-w-0 items-center gap-2 border-b border-white/[0.07] pb-2.5">
            <span
              aria-hidden
              className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-secondary/40 bg-secondary/20 shadow-[0_0_12px_color-mix(in_srgb,var(--theme-secondary)_40%,transparent)]"
            >
              <span className="absolute inset-0 rounded-full bg-secondary/25 blur-md" />
              {placeIcon ? (
                <Image
                  src={placeIcon}
                  alt=""
                  width={36}
                  height={36}
                  className="relative h-full w-full object-cover"
                  sizes="36px"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="relative h-3.5 w-3.5 text-secondary"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 2.5c.4 2.8 2.2 5 4.8 6.2-1.6.7-2.8 2-3.4 3.6-.6-1.6-1.8-2.9-3.4-3.6C12.6 7.5 14.4 5.3 12 2.5Zm0 10.2c1.7 1.4 2.8 3.5 2.8 5.8 0 1.8-1.3 3.5-2.8 3.5s-2.8-1.7-2.8-3.5c0-2.3 1.1-4.4 2.8-5.8Z" />
                </svg>
              )}
            </span>
            <div className="min-w-0">
              <p
                title={encounterPlace.title}
                className="truncate text-[12px] font-bold leading-tight text-white/92"
              >
                {encounterPlace.title}
              </p>
              {encounterPlace.subtitle ? (
                <p
                  title={encounterPlace.subtitle}
                  className="truncate text-[10px] font-medium leading-tight text-secondary"
                >
                  {encounterPlace.subtitle}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-secondary">
            {t("wildTag")}
          </p>
          <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-[-6%] rounded-full bg-secondary/14 blur-2xl"
            />
            {featuredSpriteUrl ? (
              <Image
                src={featuredSpriteUrl}
                alt=""
                width={96}
                height={96}
                className="relative h-[92%] w-[92%] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)]"
                unoptimized
              />
            ) : (
              <PokeballIcon className="relative h-8 w-8 opacity-35" />
            )}
          </div>
          <div className="min-w-0 px-1 text-center">
            <p
              title={name}
              className="truncate text-[13px] font-bold uppercase leading-tight tracking-wide text-white"
            >
              {name}
            </p>
            {featuredLevel != null ? (
              <p className="mt-0.5 text-[11px] font-medium text-white/55">
                {t("level", { level: featuredLevel })}
              </p>
            ) : null}
          </div>
        </div>

        {hasChildren ? (
          <div className="flex justify-center gap-1.5 border-t border-white/[0.07] pt-2.5">
            {children}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-primary/[0.08] via-[#12141a]/94 to-black/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_36px_rgba(0,0,0,0.4)]">
      <div className="flex flex-col items-center gap-2.5 border-b border-white/[0.07] pb-3">
        <span className="relative shrink-0">
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-2 rounded-[32%] bg-primary/25 blur-xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[28%] ring-1 ring-primary/35"
          />
          <TrainerAvatar
            name={name}
            src={portraitUrl}
            size="xl"
            pixel={pixelPortrait}
            className="relative shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          />
        </span>
        <p
          title={name}
          className="line-clamp-2 max-w-full px-0.5 text-center text-[13px] font-bold leading-snug tracking-wide text-white"
        >
          {name}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-x-1 gap-y-2.5">{children}</div>
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
  if (compact) {
    return (
      <div
        title={name}
        className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 ${fainted ? "opacity-55" : ""}`}
      >
        <div
          className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md ${
            active
              ? "bg-primary/15 ring-1 ring-primary/70 shadow-[0_0_10px_color-mix(in_srgb,var(--color-pokeball-red)_30%,transparent)]"
              : "bg-white/[0.04]"
          }`}
        >
          {spriteUrl ? (
            <Image
              src={spriteUrl}
              alt={name}
              width={40}
              height={40}
              className={`h-[92%] w-[92%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
                fainted ? "grayscale-[0.55]" : ""
              }`}
            />
          ) : (
            <PokeballIcon className="h-4 w-4 opacity-40" />
          )}
          {fainted ? (
            <span className="material-symbols-outlined absolute right-0 top-0 text-[9px]! text-error drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              skull
            </span>
          ) : null}
        </div>
        {typeof hpPct === "number" && !fainted ? (
          <PartyHpLine hpPct={hpPct} />
        ) : fainted ? (
          <div className="mx-[10%] h-[3px] w-[80%] rounded-[1px] bg-error/35" />
        ) : (
          <div className="mx-[10%] h-[3px] w-[80%] rounded-[1px] bg-white/[0.06]" />
        )}
      </div>
    );
  }

  return (
    <div
      title={name}
      className={`relative flex flex-col items-center gap-1 ${fainted ? "opacity-55" : ""}`}
    >
      <div
        className={`relative flex aspect-square w-full items-center justify-center ${
          active
            ? "rounded-xl bg-primary/12 ring-1 ring-primary/65 shadow-[0_0_14px_color-mix(in_srgb,var(--color-pokeball-red)_28%,transparent)]"
            : ""
        }`}
      >
        {spriteUrl ? (
          <Image
            src={spriteUrl}
            alt={name}
            width={44}
            height={44}
            className={`h-[88%] w-[88%] object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.55)] ${
              fainted ? "grayscale-[0.55]" : ""
            }`}
          />
        ) : (
          <PokeballIcon className="h-5 w-5 opacity-40" />
        )}
        {fainted ? (
          <span className="material-symbols-outlined absolute right-0 top-0 text-[11px]! text-error drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            skull
          </span>
        ) : null}
      </div>
      {typeof hpPct === "number" && !fainted ? (
        <PartyHpLine hpPct={hpPct} />
      ) : fainted ? (
        <div className="mx-[10%] h-[3px] w-[80%] rounded-[1px] bg-error/35" />
      ) : (
        <div className="mx-[10%] h-[3px] w-[80%] rounded-[1px] bg-white/[0.06]" />
      )}
    </div>
  );
}

export function EmptyPartySlot({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
        <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-white/[0.08] bg-white/[0.02]">
          <PokeballIcon className="h-3.5 w-3.5 opacity-20" />
        </div>
        <div className="mx-[10%] h-[3px] w-[80%] rounded-[1px] bg-white/[0.04]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex aspect-square w-full items-center justify-center">
        <PokeballIcon className="h-4 w-4 opacity-20" />
      </div>
      <div className="mx-[10%] h-[3px] w-[80%] rounded-[1px] bg-white/[0.04]" />
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
  const hpClass = hpTone(hpPct);
  const critical = hpPct > 0 && hpPct <= 20;

  return (
    <div
      className={`hp-plate${align === "right" ? " hp-plate--mirror" : ""}${
        critical ? " hp-plate--critical" : ""
      } ${className}`}
    >
      <div className="hp-plate__shell">
        <div className="hp-plate__panel">
          <div className="hp-plate__content">
            <div
              className={`flex items-center gap-1.5 md:gap-2 ${
                align === "right" ? "flex-row-reverse" : ""
              }`}
            >
              <span className="min-w-0 truncate text-[11px] font-bold capitalize tracking-tight text-white md:text-[13px]">
                {name}
              </span>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50 md:text-[11px]">
                {levelLabel}
              </span>
              {status ? <StatusBadge status={status} /> : null}
            </div>

            <div className="hp-plate__bar">
              <div className="hp-plate__bar-track">
                <div
                  className={`hp-plate__bar-fill health-bar-fill ${hpClass}${
                    critical ? " hp-bar-critical" : ""
                  }`}
                  style={{ width: `${hpPct}%` }}
                />
                <span className="hp-plate__bar-sheen" aria-hidden />
              </div>
            </div>

            <p
              className={`mt-0.5 text-[9px] font-semibold tabular-nums tracking-wide md:text-[10px] ${
                align === "right" ? "text-right" : ""
              } ${critical ? "text-error" : "text-white/55"}`}
            >
              {Math.round(hpPct)}% · {currentHp}/{maxHp}
            </p>
            {stages ? <StageBadges stages={stages} align={align} /> : null}
          </div>
        </div>
      </div>
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
