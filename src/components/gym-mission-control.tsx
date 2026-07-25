"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import { typeIcon } from "@/lib/type-icons";
import type { GymMissionItem, GymMissionStatusKind } from "@/lib/gym-mission";
import { marketFeeDiscount, obedienceLevelCap } from "@/lib/badge-perks";

type Props = {
  items: GymMissionItem[];
  badgeCount: number;
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
  closed: {
    dot: "bg-slate-400",
    text: "text-slate-300",
    border: "border-white/20",
    bg: "bg-white/5",
  },
  cleared: {
    dot: "bg-tertiary shadow-[0_0_8px_rgba(52,211,153,0.55)]",
    text: "text-tertiary",
    border: "border-tertiary/40",
    bg: "bg-tertiary/10",
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
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${style.border} ${style.bg} ${style.text}`}
    >
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {label}
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
    case "cooldown":
      return "timer";
    case "closed":
      return "schedule";
    default:
      return "radio_button_checked";
  }
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

export function GymMissionControl({ items, badgeCount }: Props) {
  const t = useTranslations("gyms");
  const firstUnlocked = items.find((g) => !g.locked && !g.badgeEarned) ?? items[0];
  const [selectedId, setSelectedId] = useState(firstUnlocked?.id ?? items[0]?.id ?? "");
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");

  // `selected` ya cae en items[0] cuando el id guardado no existe, así que el
  // efecto que "corregía" selectedId no cambiaba nada de lo que se renderiza:
  // sólo disparaba un render extra. El resto del componente usa `selected`.
  const selected = items.find((g) => g.id === selectedId) ?? items[0];
  const color = selected ? typeColor(selected.type) : "#68A090";

  function selectGym(next: GymMissionItem) {
    if (!selected || next.id === selected.id) return;
    setSlideDir(next.order >= selected.order ? "right" : "left");
    setSelectedId(next.id);
  }

  if (!selected) return null;

  const canChallenge = !selected.locked && !selected.onCooldown && !selected.closed;
  const challengeHref = `/gyms/${selected.id}`;

  return (
    <div className="relative isolate flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(238,21,21,0.08),transparent_55%)]" />
      <HoloGrid />
      <MissionSparks />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-margin-mobile py-6 md:gap-8 md:px-margin-desktop md:py-8">
        {/* HEADER */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-mono uppercase tracking-[0.22em] text-secondary/80">
              {t("missionEyebrow")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-headline-lg text-white md:text-display-lg">{t("title")}</h1>
              <Link
                href="/gyms/map"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/12 px-3 py-1.5 text-label-sm text-on-surface transition hover:border-pokeball-red/50"
              >
                <span className="material-symbols-outlined text-[16px]!">map</span>
                {t("viewMap")}
              </Link>
            </div>
            <p className="mt-1 max-w-xl text-label-sm text-on-surface-variant">{t("subtitle")}</p>
          </div>

          <div className="shrink-0 rounded-xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">
                {t("progressLabel")}
              </span>
              <span className="font-mono text-label-sm text-tertiary">
                {t("badgeProgress", { count: badgeCount })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {items.map((gym) => (
                <button
                  key={gym.id}
                  type="button"
                  onClick={() => selectGym(gym)}
                  title={`${gym.name} · ${gym.badgeName}`}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-md border transition ${
                    gym.badgeEarned
                      ? "border-tertiary/50 bg-tertiary/10"
                      : "border-white/10 bg-white/[0.03] opacity-55"
                  } ${selected.id === gym.id ? "ring-1 ring-pokeball-red/60" : ""}`}
                >
                  <Image
                    src={gym.badgeUrl}
                    alt={gym.badgeName}
                    width={22}
                    height={22}
                    className={`object-contain ${gym.badgeEarned ? "drop-shadow-[0_0_6px_rgba(242,192,0,0.55)]" : "grayscale"}`}
                  />
                </button>
              ))}
            </div>
            {badgeCount > 0 && (
              <p className="mt-2 max-w-xs text-[11px] text-on-surface-variant/80">
                {t("obedienceCap", { level: obedienceLevelCap(badgeCount) })}
                <span className="mx-1.5 text-white/20">·</span>
                {t("marketDiscount", { pct: Math.round(marketFeeDiscount(badgeCount) * 100) })}
              </p>
            )}
          </div>
        </header>

        {/* HERO + SIDE PANEL */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)] lg:gap-7">
          <div
            key={selected.id}
            className={`gym-mission-hero relative min-h-[320px] overflow-hidden rounded-2xl border border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.45)] md:min-h-[420px] ${
              slideDir === "right" ? "gym-mission-slide-right" : "gym-mission-slide-left"
            }`}
            style={{ boxShadow: `0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px ${color}33, 0 0 40px ${color}18` }}
          >
            {/* Backdrop: mapa de región enfocado en la ciudad */}
            <div className="absolute inset-0">
              <Image
                src={selected.mapSrc}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover opacity-55 blur-[0.5px]"
                style={{
                  objectPosition: `${selected.mapFocusX}% ${selected.mapFocusY}%`,
                  transform: "scale(1.85)",
                  transformOrigin: `${selected.mapFocusX}% ${selected.mapFocusY}%`,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(115deg, ${color}55 0%, transparent 42%), linear-gradient(to top, rgba(6,8,14,0.96) 8%, rgba(6,8,14,0.45) 48%, rgba(6,8,14,0.55) 100%)`,
                }}
              />
            </div>

            <div className="relative z-10 flex h-full flex-col justify-between gap-6 p-5 sm:p-7 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <StatusBadge kind={selected.status} label={statusLabel(selected, t)} />
                <span
                  className="rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: `${color}cc`, borderColor: `${color}` }}
                >
                  {selected.type}
                </span>
              </div>

              <div className="grid items-end gap-5 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">
                    {t("operationLabel", { n: selected.order })}
                  </p>
                  <h2 className="mt-1 text-[28px] font-semibold leading-tight text-white sm:text-[36px]">
                    {selected.name}
                  </h2>
                  <p className="mt-1 text-label-md text-white/75">
                    {selected.leaderName}
                    <span className="mx-2 text-white/25">·</span>
                    {t("specialist", { type: selected.type })}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-label-sm text-white/80">
                    <span>{t("recommendedLevel", { level: selected.recommendedLevel })}</span>
                    <span className="inline-flex items-center gap-2">
                      {t("difficulty")}
                      <DifficultyStars value={selected.difficulty} color={color} />
                    </span>
                  </div>
                </div>

                {selected.portraitUrl && (
                  <div
                    className="relative mx-auto h-40 w-32 overflow-hidden rounded-xl border-2 bg-black/30 sm:mx-0 sm:h-48 sm:w-36"
                    style={{ borderColor: `${color}aa`, boxShadow: `0 0 28px ${color}44` }}
                  >
                    <Image
                      src={selected.portraitUrl}
                      alt={selected.leaderName}
                      fill
                      sizes="144px"
                      className="object-cover object-top"
                      priority
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <Image
                      src={selected.badgeUrl}
                      alt={selected.badgeName}
                      width={72}
                      height={72}
                      className={`h-16 w-16 object-contain sm:h-[72px] sm:w-[72px] ${
                        selected.badgeEarned
                          ? "drop-shadow-[0_0_16px_rgba(242,192,0,0.55)]"
                          : "opacity-90"
                      }`}
                    />
                    <p className="mt-1 max-w-[9rem] text-center text-[10px] font-bold uppercase tracking-[0.14em] text-electric-yellow">
                      {selected.badgeName}
                    </p>
                  </div>
                  <div className="h-14 w-px bg-white/15" />
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-white/45">
                      {t("rewards")}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-lg font-mono font-semibold text-electric-yellow">
                        <span className="material-symbols-outlined text-[22px]!">paid</span>
                        {selected.coinReward}
                      </span>
                    </div>
                  </div>
                </div>

                {canChallenge || selected.badgeEarned ? (
                  <Link
                    href={challengeHref}
                    className="gym-challenge-btn inline-flex items-center justify-center gap-2 rounded-md bg-pokeball-red px-6 py-3 text-label-md font-semibold uppercase tracking-wide text-white transition"
                  >
                    <span className="material-symbols-outlined text-[18px]!">swords</span>
                    {selected.badgeEarned ? t("rematch") : t("challengeGym")}
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-6 py-3 text-label-md font-semibold uppercase tracking-wide text-white/45"
                  >
                    <span className="material-symbols-outlined text-[18px]!">
                      {selected.locked ? "lock" : "schedule"}
                    </span>
                    {selected.locked
                      ? t("statusReadyLocked")
                      : selected.onCooldown
                        ? t("statusReadyCooldown", { hours: selected.hoursLeft })
                        : t("statusReadyClosed")}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SIDE PANEL */}
          <aside
            key={`panel-${selected.id}`}
            className="gym-mission-panel flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl sm:p-6"
          >
            <div>
              <p className="mb-3 text-[11px] font-mono uppercase tracking-[0.18em] text-on-surface-variant">
                {t("enemyTeam")}
              </p>
              <ul className="space-y-2">
                {selected.team.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-2"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface-container-high">
                      {member.spriteUrl && (
                        <Image
                          src={member.spriteUrl}
                          alt={member.name}
                          fill
                          sizes="40px"
                          className="object-contain p-0.5"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-md capitalize text-on-surface">{member.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {member.types.map((type) => (
                          <span
                            key={type}
                            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] uppercase"
                            style={{
                              color: typeColor(type),
                              backgroundColor: `${typeColor(type)}22`,
                            }}
                          >
                            <span className="material-symbols-outlined text-[12px]!">
                              {typeIcon(type)}
                            </span>
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-label-sm text-on-surface-variant">
                      {t("levelLabel", { level: member.level })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.18em] text-on-surface-variant">
                {t("weaknesses")}
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.weaknesses.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-label-sm capitalize"
                    style={{
                      color: typeColor(type),
                      borderColor: `${typeColor(type)}55`,
                      backgroundColor: `${typeColor(type)}18`,
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]!">{typeIcon(type)}</span>
                    {type}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-auto rounded-md border border-white/8 bg-white/[0.03] px-3 py-2.5 text-label-sm text-on-surface-variant">
              {t("trainerCount", { count: selected.trainerCount })}
            </div>
          </aside>
        </section>

        {/* CAROUSEL */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-on-surface-variant">
              {t("operations")}
            </h3>
            <p className="text-label-sm text-on-surface-variant/70">
              {t("operationsHint")}
            </p>
          </div>

          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
            {items.map((gym) => {
              const gymColor = typeColor(gym.type);
              const active = gym.id === selected.id;
              const style = STATUS_STYLES[gym.status];

              return (
                <button
                  key={gym.id}
                  type="button"
                  onClick={() => selectGym(gym)}
                  className={`gym-mission-card group relative min-h-[148px] w-[220px] shrink-0 overflow-hidden rounded-xl border text-left transition duration-300 ${
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
                      className="object-cover opacity-40 transition duration-500 group-hover:opacity-55"
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

                  <div className="relative z-10 flex h-full flex-col justify-between p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${style.border} ${style.bg} ${style.text}`}
                      >
                        <span className="material-symbols-outlined text-[12px]!">
                          {statusIcon(gym.status)}
                        </span>
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{ backgroundColor: `${gymColor}cc`, color: "#fff" }}
                      >
                        {gym.type}
                      </span>
                    </div>

                    <div>
                      <p className="truncate text-[15px] font-semibold text-white">{gym.name}</p>
                      <p className="truncate text-label-sm text-white/65">
                        {gym.leaderName}
                        <span className="mx-1.5 text-white/25">·</span>
                        {t("levelLabel", { level: gym.recommendedLevel })}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
                      <span className="inline-flex items-center gap-1 font-mono text-[12px] text-electric-yellow">
                        <span className="material-symbols-outlined text-[14px]!">paid</span>
                        {gym.coinReward}
                      </span>
                      <Image
                        src={gym.badgeUrl}
                        alt=""
                        width={22}
                        height={22}
                        className={`object-contain ${gym.badgeEarned ? "" : "opacity-70 grayscale"}`}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
