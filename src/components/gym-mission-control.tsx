"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import { showdownTypeSymbolUrl } from "@/lib/type-icons";
import type { GymMissionItem, GymMissionStatusKind } from "@/lib/gym-mission";
import { KANTO_MAP_IMAGE, KANTO_MAP_ASPECT } from "@/lib/gym-map";
import { marketFeeDiscount, obedienceLevelCap } from "@/lib/badge-perks";
import { GYM_BATTLE_ENERGY_COST } from "@/lib/energy";
import { SkipGymCooldownButton } from "@/components/skip-gym-cooldown-button";
import { HandbookLink } from "@/components/handbook/handbook-trigger";
import { GameCtaButton } from "@/components/game-cta-button";
import { showToast } from "@/lib/app-toast";
import {
  DEFAULT_GYM_REGION_ID,
  gymRegionDef,
  type GymRegionId,
} from "@/lib/gym-regions";

const ENERGY_ICON = "/items/hd/energy.png";
const COIN_ICON = "/items/hd/poke-coin.png";
const PROGRESS_FILL =
  "linear-gradient(90deg, var(--color-tertiary) 0%, var(--theme-tertiary-bright) 52%, #5ef0ff 100%)";
const PROGRESS_GLOW =
  "0 0 10px color-mix(in srgb, var(--theme-tertiary-bright) 55%, transparent)";

export type GymRegionTab = {
  id: GymRegionId;
  available: boolean;
  playable: boolean;
  badgeTarget: number;
  badgeCount: number;
};

type Props = {
  itemsByRegion: Partial<Record<GymRegionId, GymMissionItem[]>>;
  gems: number;
  eliteHrefByRegion?: Partial<Record<GymRegionId, string | null>>;
  /** Ligas del hub (las disponibles se listan; sin playable quedan bloqueadas). */
  regions: GymRegionTab[];
  initialRegionId?: GymRegionId;
};

const STATUS_STYLES: Record<
  GymMissionStatusKind,
  { dot: string; text: string; border: string; bg: string }
> = {
  available: {
    dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]",
    text: "text-emerald-300",
    border: "border-emerald-400/40",
    bg: "bg-emerald-400/10",
  },
  cooldown: {
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
    text: "text-amber-300",
    border: "border-amber-400/40",
    bg: "bg-amber-400/10",
  },
  locked: {
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.55)]",
    text: "text-red-300",
    border: "border-red-500/35",
    bg: "bg-red-500/10",
  },
  stages: {
    dot: "bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]",
    text: "text-white",
    border: "border-white/35",
    bg: "bg-white/10",
  },
  closed: {
    dot: "bg-slate-400",
    text: "text-slate-300",
    border: "border-white/20",
    bg: "bg-white/5",
  },
  cleared: {
    dot: "bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]",
    text: "text-white",
    border: "border-white/35",
    bg: "bg-white/10",
  },
};

function DifficultyStars({ value, color }: { value: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="text-[13px] leading-none"
          style={{ color: i < value ? color : "rgba(255,255,255,0.22)" }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/** Chip de tipo: símbolo Showdown + fondo degradé compacto. */
function TypeChip({
  type,
  label,
  size = "sm",
  iconOnly = false,
}: {
  type: string;
  label: string;
  size?: "xs" | "sm";
  /** Solo el símbolo; el nombre va en `title` (hover / long-press). */
  iconOnly?: boolean;
}) {
  const color = typeColor(type);
  const iconPx = size === "xs" ? 12 : 14;
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-center border ${
        iconOnly
          ? size === "xs"
            ? "rounded-md p-0.5"
            : "rounded-lg p-1"
          : size === "xs"
            ? "gap-1 rounded-md px-1.5 py-0.5"
            : "gap-1 rounded-lg px-2 py-1"
      }`}
      style={{
        color,
        borderColor: `${color}40`,
        background: `linear-gradient(155deg, ${color}32 0%, rgba(10,12,18,0.88) 70%)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <span
        className={`relative inline-flex shrink-0 items-center justify-center ${
          size === "xs" ? "h-4 w-4 rounded" : "h-5 w-5 rounded-md"
        }`}
        style={{
          background: `linear-gradient(145deg, ${color}, ${color}99)`,
          boxShadow: `0 0 10px ${color}33`,
        }}
      >
        <Image
          src={showdownTypeSymbolUrl(type)}
          alt=""
          width={iconPx}
          height={iconPx}
          unoptimized
          className="object-contain brightness-110 contrast-125"
        />
      </span>
      {!iconOnly && (
        <span
          className={`font-bold uppercase tracking-wide ${
            size === "xs" ? "text-[9px]" : "text-[10px]"
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} />;
}

/** Misma silueta que la Pokédex en regiones catalogadas pero no jugables. */
const LOCKED_SILHOUETTE =
  "brightness-0 invert opacity-[0.42] drop-shadow-[0_0_6px_rgba(255,255,255,0.12)]";

/** Misma silueta que el hub activo, para no saltar el layout al cambiar de liga. */
function GymRegionSkeletonHero({
  regionLabel,
  lockedTitle,
  lockedBody,
}: {
  regionLabel: string;
  lockedTitle: string;
  lockedBody: string;
}) {
  return (
    <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-white/10 bg-black/40 md:min-h-[380px]">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "linear-gradient(125deg, rgba(255,255,255,0.06) 0%, transparent 40%), linear-gradient(to top, rgba(6,8,14,0.95) 10%, rgba(6,8,14,0.55) 100%)",
        }}
      />
      <div className="relative z-10 flex h-full flex-col justify-between gap-6 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <SkeletonBlock className="h-7 w-28" />
          <SkeletonBlock className="h-7 w-16" />
        </div>
        <div className="grid items-end gap-5 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0 space-y-2.5">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="h-9 w-[70%] max-w-xs" />
            <SkeletonBlock className="h-4 w-48" />
            <SkeletonBlock className="h-4 w-40" />
          </div>
          <SkeletonBlock className="mx-auto h-40 w-32 rounded-xl sm:mx-0 sm:h-48 sm:w-36" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-8 w-28 rounded-xl" />
            </div>
          </div>
          <SkeletonBlock className="h-11 w-full rounded-xl sm:w-44" />
        </div>
      </div>

      <div className="absolute inset-x-4 bottom-4 z-20 sm:inset-x-6 sm:bottom-6">
        <div className="rounded-xl border border-white/12 bg-black/70 px-4 py-3 text-center backdrop-blur-md">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
            {regionLabel}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-white">{lockedTitle}</p>
          <p className="mt-1 text-[12px] text-on-surface-variant">{lockedBody}</p>
        </div>
      </div>
    </div>
  );
}

function GymRegionSkeletonAside() {
  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl sm:p-6">
      <SkeletonBlock className="h-3 w-28" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-2"
          >
            <SkeletonBlock className="h-10 w-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <SkeletonBlock className="h-3.5 w-24" />
              <SkeletonBlock className="h-5 w-20" />
            </div>
            <SkeletonBlock className="h-3 w-10" />
          </div>
        ))}
      </div>
      <SkeletonBlock className="h-3 w-24" />
      <div className="flex flex-wrap gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-7 w-16 rounded-lg" />
        ))}
      </div>
      <SkeletonBlock className="mt-auto h-10 w-full rounded-md" />
    </aside>
  );
}

function GymRegionSkeletonOps({ operationsLabel }: { operationsLabel: string }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SkeletonBlock className="h-3 w-24" />
        <span className="text-label-sm text-on-surface-variant/50">{operationsLabel}</span>
      </div>
      <div className="flex gap-2.5 overflow-hidden sm:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="min-h-[132px] w-[min(72vw,200px)] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/35 sm:min-h-[148px] sm:w-[210px]"
          >
            <div className="flex h-full flex-col justify-between p-3.5">
              <div className="flex justify-between">
                <SkeletonBlock className="h-5 w-8" />
                <SkeletonBlock className="h-5 w-12" />
              </div>
              <div className="space-y-1.5">
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="h-3 w-24" />
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <SkeletonBlock className="h-5 w-14" />
                <SkeletonBlock className="h-5 w-5 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoinReward({ amount, compact = false }: { amount: number; compact?: boolean }) {
  const icon = compact ? 16 : 22;
  return (
    <span
      className={`inline-flex items-center ${
        compact ? "gap-1" : "gap-1.5"
      }`}
    >
      <Image
        src={COIN_ICON}
        alt=""
        width={icon}
        height={icon}
        className={`object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] ${
          compact ? "h-4 w-4" : "h-[22px] w-[22px]"
        }`}
        unoptimized
      />
      <span
        className={`font-mono font-bold tabular-nums text-white ${
          compact ? "text-[11px] sm:text-[12px]" : "text-lg"
        }`}
      >
        +{amount.toLocaleString()}
      </span>
    </span>
  );
}

function StatusBadge({
  kind,
  label,
}: {
  kind: GymMissionStatusKind;
  label: string;
}) {
  const style = STATUS_STYLES[kind];

  return (
    <span
      className={`inline-flex max-w-[min(100%,14.5rem)] items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase leading-tight tracking-wide sm:max-w-none sm:gap-2 sm:px-2.5 sm:text-[11px] ${style.border} ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2 ${style.dot}`} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function statusLabel(
  item: GymMissionItem,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (item.status) {
    case "cleared":
      return t("statusReadyCleared");
    case "locked":
      return t("statusReadyLocked");
    case "stages":
      return t("statusReadyStages");
    case "cooldown":
      return t("statusReadyCooldown", { hours: item.hoursLeft });
    case "closed":
      return t("statusReadyClosed");
    default:
      return t("statusReadyAvailable");
  }
}

function statusIcon(kind: GymMissionStatusKind): string {
  switch (kind) {
    case "cleared":
      return "check_circle";
    case "locked":
      return "lock";
    case "stages":
      return "hiking";
    case "cooldown":
      return "timer";
    case "closed":
      return "schedule";
    default:
      return "radio_button_checked";
  }
}

/** Hint de subordinados sin ocupar una fila: solo un `i`. */
function EnemyTeamHint({ label }: { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        showToast(label, "info");
      }}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-on-surface-variant/80 transition hover:border-white/25 hover:text-white"
    >
      <span className="material-symbols-outlined text-[14px]!">info</span>
    </button>
  );
}

function HoloGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.12]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(125,211,252,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.35) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
      }}
    />
  );
}

function MissionSparks() {
  const sparks = useMemo(() => {
    const cols = 8;
    const out = [];
    for (let i = 0; i < 36; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      out.push({
        left: `${4 + col * 12 + ((i * 17) % 5)}%`,
        top: `${8 + row * 16 + ((i * 11) % 7)}%`,
        delay: -((i * 0.27) % 4),
        duration: 3.4 + (i % 6) * 0.35,
      });
    }
    return out;
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {sparks.map((spark, i) => (
        <span
          key={i}
          className="auth-spark"
          style={{
            left: spark.left,
            top: spark.top,
            width: 1.5,
            height: 1.5,
            animationDelay: `${spark.delay}s`,
            animationDuration: `${spark.duration}s`,
            opacity: 0.55,
          }}
        />
      ))}
    </div>
  );
}

export function GymMissionControl({
  itemsByRegion,
  gems,
  eliteHrefByRegion = {},
  regions,
  initialRegionId = DEFAULT_GYM_REGION_ID,
}: Props) {
  const t = useTranslations("gyms");
  const tTypes = useTranslations("pokedex.pokemonTypes");
  const [regionId, setRegionId] = useState<GymRegionId>(initialRegionId);
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  // Vista de operaciones: cards o mapa de región. Antes el mapa era la ruta
  // /gyms/map, una segunda pantalla con exactamente los mismos datos.
  const [view, setView] = useState<"list" | "map">("list");
  const heroRef = useRef<HTMLDivElement>(null);

  const activeRegion = regions.find((r) => r.id === regionId) ?? regions[0];
  const regionAvailable = activeRegion?.available ?? false;
  const regionPlayable = activeRegion?.playable ?? false;
  const regionLocked = regionAvailable && !regionPlayable;
  const items = useMemo(() => {
    const raw = itemsByRegion[regionId] ?? [];
    if (!regionLocked) return raw;
    return raw.map((gym) => ({
      ...gym,
      locked: true,
      stagesIncomplete: false,
      onCooldown: false,
      closed: false,
      status: "locked" as const,
    }));
  }, [itemsByRegion, regionId, regionLocked]);

  const badgeCount = items.filter((g) => g.badgeEarned).length;
  const eliteHref = regionPlayable ? (eliteHrefByRegion[regionId] ?? null) : null;
  const firstUnlocked = items.find((g) => !g.locked && !g.badgeEarned) ?? items[0];
  const [selectedId, setSelectedId] = useState(firstUnlocked?.id ?? items[0]?.id ?? "");

  // Al cambiar de liga, apuntar al primer gimnasio útil de esa región.
  const regionItemsKey = items.map((g) => g.id).join(",");
  const [lastRegionItemsKey, setLastRegionItemsKey] = useState(regionItemsKey);
  if (lastRegionItemsKey !== regionItemsKey) {
    setLastRegionItemsKey(regionItemsKey);
    const next = items.find((g) => !g.locked && !g.badgeEarned) ?? items[0];
    setSelectedId(next?.id ?? "");
  }

  // `selected` ya cae en items[0] cuando el id guardado no existe, así que el
  // efecto que "corregía" selectedId no cambiaba nada de lo que se renderiza:
  // sólo disparaba un render extra. El resto del componente usa `selected`.
  const selected = items.find((g) => g.id === selectedId) ?? items[0];
  const color = selected ? typeColor(selected.type) : "#68A090";
  const regionLabel = t(`regions.${gymRegionDef(regionId).id}`);
  const badgeTotal = activeRegion?.badgeTarget || items.length || 8;
  const regionBadgeCount = regionPlayable
    ? badgeCount
    : regionAvailable
      ? 0
      : (activeRegion?.badgeCount ?? 0);
  const progressPct = Math.min(100, Math.round((regionBadgeCount / badgeTotal) * 100));

  function typeLabel(type: string) {
    const key = type.toLowerCase();
    return tTypes.has(key as "fire") ? tTypes(key as "fire") : type;
  }

  function badgeLabel(gym: Pick<GymMissionItem, "regionId" | "order" | "badgeName">) {
    const byRegion = `badgesByRegion.${gym.regionId}.${gym.order}`;
    if (t.has(byRegion)) return t(byRegion);
    if (gym.regionId === "kanto") {
      const key = `badges.${gym.order}`;
      if (t.has(key)) return t(key);
    }
    return gym.badgeName;
  }

  function gymNameLabel(gym: Pick<GymMissionItem, "regionId" | "order" | "name">) {
    const byRegion = `namesByRegion.${gym.regionId}.${gym.order}`;
    if (t.has(byRegion)) return t(byRegion);
    if (gym.regionId === "kanto") {
      const key = `names.${gym.order}`;
      if (t.has(key)) return t(key);
    }
    return gym.name;
  }

  function selectGym(next: GymMissionItem) {
    if (!selected || next.id === selected.id) return;
    setSlideDir(next.order >= selected.order ? "right" : "left");
    setSelectedId(next.id);
    // En mobile el carrusel queda abajo: al tocar una card, el hero vuelve a vista.
    // Doble rAF: el hero se remonta por `key` y el ref apunta al nodo nuevo.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        heroRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
  }

  const canChallenge = selected
    ? regionPlayable &&
      !selected.locked &&
      !selected.stagesIncomplete &&
      !selected.onCooldown &&
      !selected.closed
    : false;
  const challengeHref = selected ? `/gyms/${selected.id}` : "/gyms";
  const selectedTypeLabel = selected ? typeLabel(selected.type) : "";
  const selectedBadgeLabel = selected ? badgeLabel(selected) : "";
  const selectedGymName = selected ? gymNameLabel(selected) : "";

  function renderChallengeAction(opts?: { className?: string; compact?: boolean }) {
    if (!selected) return null;
    const wrap = opts?.className ?? "";
    const compact = opts?.compact === true;
    if (regionLocked) {
      return (
        <GameCtaButton
          type="button"
          disabled
          variant="gold"
          className={wrap}
          icon="lock"
        >
          {t("regionUnavailableCta")}
        </GameCtaButton>
      );
    }
    if (canChallenge || selected.badgeEarned) {
      // En la barra sticky mobile el ancho es corto: "Desafiar" cabe en una
      // línea; "Desafiar gimnasio" se partía contra el costo de energía.
      const label = selected.badgeEarned
        ? t("rematch")
        : compact
          ? t("challenge")
          : t("challengeGym");
      return (
        <Link
          href={challengeHref}
          className={`game-cta game-cta--red mb-0! gap-2 whitespace-nowrap sm:gap-2.5 ${compact ? "min-h-11 w-auto! px-3.5 py-2.5 text-[0.72rem]" : ""} ${wrap}`.trim()}
        >
          <span className="game-cta__label whitespace-nowrap">{label}</span>
          <span aria-hidden className="h-4 w-px shrink-0 bg-white/25" />
          <span className={`inline-flex shrink-0 items-center gap-1 font-sans font-semibold tabular-nums tracking-normal text-white normal-case ${compact ? "text-[12px]" : "text-[13px]"}`}>
            <Image
              src={ENERGY_ICON}
              alt=""
              width={compact ? 18 : 20}
              height={compact ? 18 : 20}
              className={`${compact ? "h-[18px] w-[18px]" : "h-5 w-5"} object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]`}
              unoptimized
            />
            <span>−{GYM_BATTLE_ENERGY_COST}</span>
          </span>
        </Link>
      );
    }
    if (selected.onCooldown) {
      return (
        <SkipGymCooldownButton
          gymId={selected.id}
          hoursLeft={selected.hoursLeft}
          remainingMs={selected.remainingMs}
          gems={gems}
          compact
        />
      );
    }
    return (
      <GameCtaButton
        type="button"
        disabled
        variant="gold"
        className={wrap}
        icon={
          selected.locked
            ? "lock"
            : selected.stagesIncomplete
              ? "hiking"
              : "schedule"
        }
      >
        {selected.locked
          ? t("statusReadyLocked")
          : selected.stagesIncomplete
            ? t("statusReadyStages")
            : t("statusReadyClosed")}
      </GameCtaButton>
    );
  }

  return (
    <div className="relative isolate flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(238,21,21,0.08),transparent_55%)]" />
      <HoloGrid />
      <MissionSparks />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 py-2.5 pb-[4.75rem] sm:gap-5 sm:px-margin-desktop sm:py-6 sm:pb-6 md:gap-6 md:py-8 xl:pb-8">
        {/* HEADER — compacto en mobile para llegar antes a la card */}
        <header className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              <p className="mb-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-secondary sm:mb-1.5 sm:text-[11px]">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-secondary" />
                {t("missionEyebrow")}
                <span className="text-white/20">/</span>
                <span className="font-semibold tracking-[0.18em] text-on-surface-variant">
                  {regionLabel}
                </span>
              </p>
              <h1 className="page-title text-[clamp(1.35rem,5vw,2.75rem)] text-white">
                {t("title")}
              </h1>
            </div>
            {regionAvailable && (
              <button
                type="button"
                onClick={() => setView((v) => (v === "list" ? "map" : "list"))}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
              >
                <span className="material-symbols-outlined text-[15px]!">
                  {view === "list" ? "map" : "view_list"}
                </span>
                {view === "list" ? t("viewMap") : t("backToList")}
              </button>
            )}
          </div>
          <p className="mt-1.5 hidden text-[13px] text-white/55 sm:mt-2 sm:block sm:truncate">
            {t("subtitle", { region: regionLabel })}
          </p>
          <div className="mt-2.5 hidden sm:block">
            <HandbookLink chapter="journey" />
          </div>
        </header>

        {regionAvailable && eliteHref && (
          <section className="relative overflow-hidden rounded-2xl border border-electric-yellow/35 bg-gradient-to-r from-electric-yellow/[0.14] via-black/40 to-black/50 p-4">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric-yellow/70 to-transparent"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-electric-yellow/40 bg-electric-yellow/10 text-electric-yellow"
                >
                  <span className="material-symbols-outlined text-[24px]!">
                    workspace_premium
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-electric-yellow">
                    {t("eliteEyebrow")}
                  </p>
                  <h2 className="mt-0.5 text-[17px] font-semibold leading-tight text-white">
                    {t("eliteTitle")}
                  </h2>
                  <p className="mt-1 max-w-lg text-label-sm text-on-surface-variant">
                    {t("eliteBody")}
                  </p>
                </div>
              </div>
              <GameCtaButton href={eliteHref} variant="gold" icon="workspace_premium">
                {t("eliteCta")}
              </GameCtaButton>
            </div>
          </section>
        )}

        {/*
          Mobile order: ligas → progreso (taps) → hero → equipo.
          Desktop: 2×2 — ligas|progreso / hero|equipo.
        */}
        {regionLocked && (
          <p className="rounded-md border border-white/8 bg-black/20 px-3 py-2 text-label-sm text-on-surface-variant">
            <span className="material-symbols-outlined mr-1 align-middle text-[16px]!">
              lock
            </span>
            {t("regionLockedHint")}
          </p>
        )}
        <section className="grid gap-x-6 gap-y-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)] lg:grid-rows-[auto_auto] lg:gap-x-7 lg:gap-y-2">
          <div
            className="grid grid-cols-4 gap-1 sm:gap-1.5 lg:col-start-1 lg:row-start-1"
            role="tablist"
            aria-label={t("regionsLabel")}
          >
            {regions.map((region) => {
              const active = region.id === regionId;
              const label = t(`regions.${region.id}`);
              return (
                <button
                  key={region.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setRegionId(region.id);
                    if (region.available) setView("list");
                  }}
                  className={[
                    "flex min-h-11 min-w-0 flex-col justify-center rounded-lg border px-1.5 py-2 text-left transition sm:min-h-0 sm:px-2.5 sm:py-1.5",
                    active
                      ? "border-white/20 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "border-white/8 bg-black/20 text-on-surface-variant hover:border-white/16 hover:text-on-surface",
                  ].join(" ")}
                >
                  <span className="truncate text-[10px] font-semibold leading-tight tracking-wide sm:text-[12px]">
                    {label}
                  </span>
                  <span className="truncate font-mono text-[8px] leading-tight tabular-nums opacity-65 sm:text-[10px]">
                    {!region.available
                      ? t("regionComingSoon")
                      : !region.playable
                        ? t("regionUnavailableCta")
                        : `${region.badgeCount}/${region.badgeTarget}`}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="min-w-0 lg:col-start-2 lg:row-start-1">
            <div className="w-full rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 backdrop-blur-md sm:px-4 sm:py-3.5">
              <div className="mb-1.5 flex items-center justify-between gap-3 sm:mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant sm:text-[11px]">
                  {t("progressLabel")}
                </span>
                <span className="font-mono text-[12px] font-semibold text-tertiary sm:text-label-sm">
                  {regionAvailable
                    ? t("badgeProgress", { count: regionBadgeCount, total: badgeTotal })
                    : t("badgeProgress", { count: 0, total: badgeTotal })}
                </span>
              </div>
              <div
                className="mb-2 h-1 overflow-hidden rounded-full bg-white/10 sm:mb-3 sm:h-1.5"
                role="progressbar"
                aria-valuenow={regionAvailable ? regionBadgeCount : 0}
                aria-valuemin={0}
                aria-valuemax={badgeTotal}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: regionAvailable ? `${progressPct}%` : "0%",
                    background: PROGRESS_FILL,
                    boxShadow: regionAvailable && progressPct > 0 ? PROGRESS_GLOW : undefined,
                  }}
                />
              </div>
              <div className="relative grid grid-cols-8 gap-0.5 sm:gap-1">
                {regionAvailable
                  ? items.map((gym) => (
                      <button
                        key={gym.id}
                        type="button"
                        onClick={() => selectGym(gym)}
                        title={`${gymNameLabel(gym)} · ${badgeLabel(gym)}`}
                        className={`relative z-10 flex aspect-square w-full items-center justify-center rounded-md border transition sm:rounded-full ${
                          gym.badgeEarned && regionPlayable
                            ? "border-tertiary/55 bg-tertiary/15"
                            : "border-white/10 bg-[#0c1018]/90 opacity-55"
                        } ${
                          selected?.id === gym.id
                            ? "ring-2 ring-pokeball-red/70"
                            : "hover:opacity-100"
                        }`}
                      >
                        <Image
                          src={gym.badgeUrl}
                          alt={badgeLabel(gym)}
                          width={20}
                          height={20}
                          className={`h-[55%] w-[55%] object-contain ${
                            gym.badgeEarned && regionPlayable
                              ? "drop-shadow-[0_0_6px_rgba(242,192,0,0.55)]"
                              : "grayscale opacity-70"
                          }`}
                        />
                      </button>
                    ))
                  : Array.from({ length: badgeTotal }, (_, i) => (
                      <span
                        key={i}
                        className="flex aspect-square w-full items-center justify-center rounded-md border border-white/8 bg-white/[0.03] sm:rounded-full"
                      >
                        <SkeletonBlock className="h-[45%] w-[45%] rounded-full" />
                      </span>
                    ))}
              </div>
              {regionPlayable && regionBadgeCount > 0 && (
                <p className="mt-1.5 hidden text-[10px] leading-snug text-on-surface-variant/80 sm:mt-2.5 sm:block sm:text-[11px]">
                  {t("obedienceCap", { level: obedienceLevelCap(regionBadgeCount) })}
                  <span className="mx-1 text-white/20">·</span>
                  {t("marketDiscount", {
                    pct: Math.round(marketFeeDiscount(regionBadgeCount) * 100),
                  })}
                </p>
              )}
              {regionLocked && (
                <p className="mt-1.5 text-[10px] text-on-surface-variant/65 sm:mt-2.5 sm:text-[11px]">
                  {t("regionLockedHint")}
                </p>
              )}
              {!regionAvailable && (
                <p className="mt-1.5 text-[10px] text-on-surface-variant/65 sm:mt-2.5 sm:text-[11px]">
                  {t("regionComingSoon")}
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            {!regionAvailable && (
              <GymRegionSkeletonHero
                regionLabel={regionLabel}
                lockedTitle={t("regionLockedTitle", { region: regionLabel })}
                lockedBody={t("regionLockedBody")}
              />
            )}

            {regionAvailable && selected && (
          <div
            ref={heroRef}
            key={selected.id}
            className={`gym-mission-hero relative overflow-hidden rounded-2xl border border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.45)] ${
              slideDir === "right" ? "gym-mission-slide-right" : "gym-mission-slide-left"
            } ${regionLocked ? "opacity-90" : ""}`}
            style={{
              boxShadow: `0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px ${color}33, 0 0 40px ${color}18`,
            }}
          >
            <div className="absolute inset-0">
              <Image
                src={selected.mapSrc}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 60vw, 100vw"
                className={`object-cover blur-[0.5px] ${
                  regionLocked ? "opacity-35 grayscale" : "opacity-55"
                }`}
                style={{
                  objectPosition: `${selected.mapFocusX}% ${selected.mapFocusY}%`,
                  transform: "scale(1.85)",
                  transformOrigin: `${selected.mapFocusX}% ${selected.mapFocusY}%`,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `
                    linear-gradient(115deg, ${color}55 0%, transparent 42%),
                    linear-gradient(90deg, rgba(6,8,14,0.88) 0%, rgba(6,8,14,0.52) 48%, rgba(6,8,14,0.18) 78%, rgba(6,8,14,0.28) 100%),
                    linear-gradient(to top, rgba(6,8,14,0.92) 0%, rgba(6,8,14,0.35) 45%, rgba(6,8,14,0.45) 100%)
                  `,
                }}
              />
            </div>

            <div
              className={`gym-mission-hero__body relative z-10 flex min-h-[13.5rem] flex-col gap-2 p-3 sm:min-h-[18.5rem] sm:gap-3 sm:p-5 md:min-h-[20rem] md:gap-4 md:p-6 ${
                regionLocked ? "pb-20 sm:pb-24" : ""
              }`}
            >
              {/* Líder a cuerpo completo a la derecha (mobile + desktop). */}
              {selected.portraitUrl ? (
                <div
                  aria-hidden={!regionLocked}
                  className="pointer-events-none absolute top-0 right-0 bottom-[7.5rem] z-[1] w-[46%] px-3 pt-4 pb-2 sm:inset-y-0 sm:bottom-0 sm:w-[40%] sm:px-5 sm:py-5 md:w-[36%]"
                >
                  <div
                    className="absolute bottom-[10%] left-1/2 h-[65%] w-[80%] -translate-x-1/2 rounded-[100%] opacity-70 blur-2xl"
                    style={{
                      background: `radial-gradient(ellipse at center, ${color}66 0%, transparent 70%)`,
                    }}
                  />
                  <div className="relative h-full w-full">
                    <Image
                      src={selected.portraitUrl}
                      alt={regionLocked ? t("regionLocked") : selected.leaderName}
                      fill
                      sizes="(max-width: 640px) 44vw, (max-width: 1024px) 34vw, 280px"
                      className={`object-contain object-bottom drop-shadow-[0_14px_22px_rgba(0,0,0,0.55)] sm:drop-shadow-[0_22px_36px_rgba(0,0,0,0.5)] ${
                        regionLocked ? LOCKED_SILHOUETTE : ""
                      }`}
                      style={
                        selected.portraitScale > 1
                          ? {
                              transform: `scale(${selected.portraitScale})`,
                              transformOrigin: "bottom center",
                            }
                          : undefined
                      }
                      priority
                    />
                    {regionLocked ? (
                      <span className="absolute inset-0 z-[2] flex items-center justify-center bg-black/20">
                        <span className="material-symbols-outlined text-[28px]! text-white/55 sm:text-[36px]!">
                          lock
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="relative z-[2] grid min-w-0 grid-cols-1 items-start gap-2.5 pr-[46%] sm:gap-4 sm:pr-[38%] md:pr-[34%]">
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/55 sm:text-[11px] sm:tracking-[0.2em]">
                    {t("operationLabel", { n: selected.order, total: badgeTotal })}
                    <span className="mx-1.5 text-white/25">·</span>
                    <span className="text-white/80">
                      {regionLocked ? t("unknownMember") : selected.leaderName}
                    </span>
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 sm:mt-1 sm:gap-2">
                    <h2 className="min-w-0 text-[20px] font-semibold leading-[1.1] text-white sm:text-[32px] sm:leading-tight">
                      {selectedGymName}
                    </h2>
                    <TypeChip
                      type={selected.type}
                      label={selectedTypeLabel}
                      size="xs"
                      iconOnly
                    />
                    <StatusBadge
                      kind={selected.status}
                      label={regionLocked ? t("regionLocked") : statusLabel(selected, t)}
                    />
                  </div>
                  <p className="mt-0.5 hidden text-label-md text-white/75 sm:mt-1 sm:block">
                    {regionLocked ? t("unknownMember") : selected.leaderName}
                    <span className="mx-2 text-white/25">·</span>
                    {t("specialist", { type: selectedTypeLabel })}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-white/80 sm:mt-2 sm:gap-x-4 sm:text-label-sm">
                    <span>
                      {regionLocked
                        ? t("unknownLevel")
                        : t("recommendedLevel", { level: selected.recommendedLevel })}
                    </span>
                    {!regionLocked && (
                      <span className="inline-flex items-center gap-1 sm:gap-2">
                        <span className="hidden sm:inline">{t("difficulty")}</span>
                        <DifficultyStars value={selected.difficulty} color={color} />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Medalla + rewards (columna izquierda, al lado del líder). */}
              <div className="relative z-[2] mt-auto flex flex-col gap-2 border-t border-white/10 pt-1.5 pr-[46%] sm:gap-2.5 sm:border-0 sm:pt-0 sm:pr-[40%] md:pr-[36%]">
                <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <Image
                      src={selected.badgeUrl}
                      alt={selectedBadgeLabel}
                      width={72}
                      height={72}
                      className={`h-9 w-9 object-contain sm:h-[52px] sm:w-[52px] ${
                        selected.badgeEarned && regionPlayable
                          ? "drop-shadow-[0_0_16px_rgba(242,192,0,0.55)]"
                          : "opacity-70 grayscale"
                      }`}
                    />
                    <p className="max-w-[7.5rem] truncate text-center text-[9px] font-bold uppercase tracking-[0.1em] text-primary sm:max-w-[8.5rem] sm:text-[10px] sm:tracking-[0.12em]">
                      {selectedBadgeLabel}
                    </p>
                  </div>
                  {!regionLocked ? (
                    <>
                      <div
                        className="hidden h-11 w-px shrink-0 self-center bg-white/15 sm:block"
                        aria-hidden
                      />
                      <div className="flex min-w-0 flex-col justify-center gap-0.5 sm:gap-1">
                        <p className="hidden text-[10px] font-mono uppercase tracking-wider text-white/45 sm:block">
                          {t("rewards")}
                        </p>
                        <span className="sm:hidden">
                          <CoinReward amount={selected.coinReward} compact />
                        </span>
                        <span className="hidden sm:inline-flex">
                          <CoinReward amount={selected.coinReward} />
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="hidden w-full max-w-[17rem] sm:block">
                  {renderChallengeAction({ className: "w-full" })}
                </div>
              </div>

              {/* Mobile: equipo abajo, ancho completo — no pelea con el líder. */}
              <div className="relative z-[2] mt-1.5 border-t border-white/10 pt-1.5 lg:hidden">
                <div className="mb-1 flex items-center gap-1.5">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/55">
                    {t("enemyTeam")}
                  </p>
                  {regionLocked ? (
                    <span className="ml-auto inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/45">
                      <span className="material-symbols-outlined text-[12px]!">lock</span>
                      {t("regionLocked")}
                    </span>
                  ) : (
                    <EnemyTeamHint
                      label={t("trainerCount", { count: selected.trainerCount })}
                    />
                  )}
                </div>
                <ul className="no-scrollbar -mx-0.5 flex gap-2.5 overflow-x-auto px-0.5 pb-0.5">
                  {selected.team.map((member) => (
                    <li
                      key={member.id}
                      className="flex w-[2.75rem] shrink-0 flex-col items-center gap-0.5"
                      title={regionLocked ? t("unknownMember") : member.name}
                    >
                      <div className="relative h-8 w-8">
                        {member.spriteUrl && (
                          <Image
                            src={member.spriteUrl}
                            alt={regionLocked ? t("unknownMember") : member.name}
                            fill
                            sizes="32px"
                            className={`object-contain ${
                              regionLocked ? LOCKED_SILHOUETTE : ""
                            }`}
                          />
                        )}
                      </div>
                      <span className="font-mono text-[8px] tabular-nums text-white/55">
                        {regionLocked
                          ? t("unknownLevel")
                          : t("levelLabel", { level: member.level })}
                      </span>
                    </li>
                  ))}
                </ul>
                {!regionLocked && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="mr-0.5 text-[9px] font-mono uppercase tracking-wider text-white/45">
                      {t("weaknesses")}
                    </span>
                    {selected.weaknesses.map((type) => (
                      <TypeChip
                        key={type}
                        type={type}
                        label={typeLabel(type)}
                        size="xs"
                        iconOnly
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {regionLocked && (
              <div className="absolute inset-x-3 bottom-3 z-20 sm:inset-x-6 sm:bottom-5">
                <div className="rounded-xl border border-white/12 bg-black/75 px-3 py-2.5 text-center backdrop-blur-md sm:px-4 sm:py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                    {regionLabel}
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold text-white sm:text-[15px]">
                    {t("regionLocked")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-on-surface-variant sm:text-[12px]">
                    {t("regionLockedHint")}
                  </p>
                </div>
              </div>
            )}
          </div>
            )}
          </div>

          <div className="hidden min-w-0 lg:col-start-2 lg:row-start-2 lg:block">
            {!regionAvailable && <GymRegionSkeletonAside />}

            {regionAvailable && selected && (
          <aside
            key={`panel-${selected.id}`}
            className={`gym-mission-panel flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-black/40 p-3.5 backdrop-blur-xl sm:p-4 ${
              regionLocked ? "opacity-90" : ""
            }`}
          >
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant">
                  {t("enemyTeam")}
                </p>
                {regionLocked ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/80">
                    <span className="material-symbols-outlined text-[14px]!">lock</span>
                    {t("regionLocked")}
                  </span>
                ) : (
                  <EnemyTeamHint
                    label={t("trainerCount", { count: selected.trainerCount })}
                  />
                )}
              </div>

              <ul className="space-y-1.5">
                {selected.team.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center gap-2.5 rounded-md border border-white/8 bg-white/[0.03] px-2 py-1.5"
                  >
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-surface-container-high">
                      {member.spriteUrl && (
                        <Image
                          src={member.spriteUrl}
                          alt={regionLocked ? t("unknownMember") : member.name}
                          fill
                          sizes="32px"
                          className={`object-contain p-0.5 ${
                            regionLocked ? LOCKED_SILHOUETTE : ""
                          }`}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] capitalize text-on-surface">
                        {regionLocked ? t("unknownMember") : member.name}
                      </p>
                      {!regionLocked && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {member.types.map((type) => (
                            <TypeChip
                              key={type}
                              type={type}
                              label={typeLabel(type)}
                              size="xs"
                              iconOnly
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">
                      {regionLocked
                        ? t("unknownLevel")
                        : t("levelLabel", { level: member.level })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {!regionLocked && (
              <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant">
                  {t("weaknesses")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {selected.weaknesses.map((type) => (
                    <TypeChip
                      key={type}
                      type={type}
                      label={typeLabel(type)}
                      size="xs"
                      iconOnly
                    />
                  ))}
                </div>
              </div>
            )}

            {regionLocked && (
              <p className="rounded-md border border-white/8 bg-black/20 px-2.5 py-2 text-[11px] text-on-surface-variant">
                {t("regionLockedHint")}
              </p>
            )}
          </aside>
            )}
          </div>
        </section>

        {!regionAvailable && (
          <GymRegionSkeletonOps operationsLabel={t("operations")} />
        )}

        {regionAvailable && (
        <section className="mt-0.5 sm:mt-0">
          <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-on-surface-variant sm:text-[11px]">
              {view === "list"
                ? t("operations")
                : t("mapTitle", { region: regionLabel })}
            </h3>
            <p className="hidden text-label-sm text-on-surface-variant/70 sm:block">
              {t("operationsHint")}
            </p>
          </div>

          {view === "map" ? (
            <div className="glass-panel p-2 sm:p-3">
              <div
                className="relative w-full overflow-hidden rounded-lg bg-[#0b1424]"
                style={{ aspectRatio: KANTO_MAP_ASPECT }}
              >
                <Image
                  src={selected?.mapSrc ?? KANTO_MAP_IMAGE}
                  alt={t("mapTitle", { region: regionLabel })}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className={`object-contain ${regionLocked ? "grayscale opacity-70" : ""}`}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35" />
                {regionLocked && (
                  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-lg border border-white/12 bg-black/70 px-3 py-2 text-center backdrop-blur-md sm:inset-x-4 sm:bottom-4">
                    <p className="text-[11px] font-semibold text-white">{t("regionLocked")}</p>
                    <p className="mt-0.5 text-[10px] text-on-surface-variant">
                      {t("regionLockedHint")}
                    </p>
                  </div>
                )}

                {items.map((gym) => {
                  const gymColor = typeColor(gym.type);
                  const active = gym.id === selected.id;
                  return (
                    <button
                      key={gym.id}
                      type="button"
                      onClick={() => selectGym(gym)}
                      title={
                        regionLocked
                          ? `${gymNameLabel(gym)} — ${t("regionLocked")}`
                          : `${gymNameLabel(gym)} — ${gym.leaderName}${gym.badgeName ? ` · ${badgeLabel(gym)}` : ""}`
                      }
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${gym.mapFocusX}%`, top: `${gym.mapFocusY}%` }}
                    >
                      <span
                        className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background/90 backdrop-blur-sm transition-transform sm:h-10 sm:w-10 ${
                          gym.locked ? "opacity-70" : "hover:scale-110"
                        } ${active ? "ring-2 ring-pokeball-red/70" : ""}`}
                        style={{
                          borderColor: gymColor,
                          boxShadow: gym.badgeEarned
                            ? `0 0 14px ${gymColor}aa`
                            : gym.locked
                              ? undefined
                              : `0 0 10px ${gymColor}55`,
                        }}
                      >
                        <Image
                          src={gym.badgeUrl}
                          alt={badgeLabel(gym) || gym.name}
                          width={28}
                          height={28}
                          className={`h-5 w-5 object-contain sm:h-6 sm:w-6 ${
                            gym.locked && !gym.badgeEarned ? "opacity-45 grayscale" : ""
                          } ${gym.badgeEarned ? "drop-shadow-[0_0_6px_rgba(242,192,0,0.65)]" : ""}`}
                        />
                        {gym.locked && !gym.badgeEarned && (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/20 bg-background sm:h-4 sm:w-4">
                            <span className="material-symbols-outlined text-[10px]! leading-none text-on-surface-variant sm:text-[11px]!">
                              lock
                            </span>
                          </span>
                        )}
                        {gym.badgeEarned && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-tertiary text-surface sm:h-4 sm:w-4">
                            <span className="material-symbols-outlined text-[10px]! leading-none sm:text-[11px]!">
                              check
                            </span>
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[#07090f] to-transparent sm:w-8"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[#07090f] to-transparent sm:w-8"
              />
              <div className="no-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto sm:gap-3">
                {items.map((gym) => {
                  const gymColor = typeColor(gym.type);
                  const active = gym.id === selected.id;
                  const style = STATUS_STYLES[gym.status];

                  return (
                    <button
                      key={gym.id}
                      type="button"
                      onClick={() => selectGym(gym)}
                      className={`gym-mission-card group relative min-h-[102px] w-[min(64vw,188px)] shrink-0 snap-start overflow-hidden rounded-xl border text-left transition duration-300 sm:min-h-[148px] sm:w-[210px] ${
                        active
                          ? "border-pokeball-red/70 shadow-[0_0_24px_rgba(238,21,21,0.28)]"
                          : "border-white/10 hover:border-pokeball-red/50 hover:shadow-[0_0_22px_rgba(238,21,21,0.22)] hover:scale-[1.02]"
                      } ${gym.locked && !active ? "opacity-70" : ""}`}
                    >
                      <div className="absolute inset-0">
                        <Image
                          src={gym.mapSrc}
                          alt=""
                          fill
                          sizes="220px"
                          className={`object-cover transition duration-500 group-hover:opacity-55 ${
                            regionLocked ? "opacity-30 grayscale" : "opacity-40"
                          }`}
                          style={{
                            objectPosition: `${gym.mapFocusX}% ${gym.mapFocusY}%`,
                            transform: "scale(1.9)",
                            transformOrigin: `${gym.mapFocusX}% ${gym.mapFocusY}%`,
                          }}
                        />
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `linear-gradient(160deg, ${gymColor}40 0%, transparent 45%), linear-gradient(to top, rgba(8,10,16,0.96) 20%, rgba(8,10,16,0.55) 100%)`,
                          }}
                        />
                      </div>

                      <div className="relative z-10 flex h-full flex-col justify-between gap-1 p-2.5 sm:gap-0 sm:p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          {gym.status === "cleared" ? (
                            <Image
                              src="/ui/daily-reward-check-sm.png"
                              alt=""
                              width={40}
                              height={40}
                              unoptimized
                              className="h-4 w-4 object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)] sm:h-6 sm:w-6"
                            />
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-1 py-0.5 text-[9px] font-semibold uppercase sm:px-1.5 sm:text-[10px] ${style.border} ${style.bg} ${style.text}`}
                            >
                              <span className="material-symbols-outlined text-[11px]! sm:text-[12px]!">
                                {statusIcon(gym.status)}
                              </span>
                            </span>
                          )}
                          <TypeChip
                            type={gym.type}
                            label={typeLabel(gym.type)}
                            size="xs"
                            iconOnly
                          />
                        </div>

                        <div>
                          <p className="truncate text-[13px] font-semibold leading-tight text-white sm:text-[15px]">
                            {gymNameLabel(gym)}
                          </p>
                          <p className="truncate text-[10px] leading-snug text-white/65 sm:text-label-sm">
                            {regionLocked ? t("unknownMember") : gym.leaderName}
                            <span className="mx-1 text-white/25 sm:mx-1.5">·</span>
                            {regionLocked
                              ? t("unknownLevel")
                              : t("levelLabel", { level: gym.recommendedLevel })}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-1.5 sm:pt-2">
                          {regionLocked ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant sm:text-[10px]">
                              <span className="material-symbols-outlined text-[12px]! sm:text-[14px]!">lock</span>
                              {t("regionLocked")}
                            </span>
                          ) : (
                            <CoinReward amount={gym.coinReward} compact />
                          )}
                          <Image
                            src={gym.badgeUrl}
                            alt=""
                            width={22}
                            height={22}
                            className={`h-[18px] w-[18px] object-contain sm:h-[22px] sm:w-[22px] ${
                              gym.badgeEarned && regionPlayable ? "" : "opacity-70 grayscale"
                            }`}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
        )}
      </div>

      {/* CTA siempre al alcance del pulgar, encima de la bottom nav. */}
      {regionAvailable && selected && (
        <div className="gym-mission-sticky-cta sm:hidden">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2.5 px-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-white">
                {selectedGymName}
              </p>
              <p className="truncate text-[10px] text-white/55">
                {regionLocked ? (
                  t("regionLockedHint")
                ) : (
                  <>
                    {selected.leaderName}
                    <span className="mx-1 text-white/25">·</span>
                    {t("recommendedLevel", { level: selected.recommendedLevel })}
                  </>
                )}
              </p>
            </div>
            <div className="shrink-0">
              {renderChallengeAction({ compact: true })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
