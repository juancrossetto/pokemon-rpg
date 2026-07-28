"use client";

import Image from "next/image";
import { useState } from "react";
import { ProgressRail } from "@/components/trainer-profile-parts";
import { gymBadgeImageUrl } from "@/lib/gym-art";
import { uiSpriteUrl } from "@/lib/sprites";
import type { Achievement, AchievementRarity, CollectionSlice } from "@/lib/trainer-profile";

export type VaultBadge = {
  id: string;
  gymName: string;
  badgeName: string;
  leaderName: string | null;
  type: string;
  accent: string;
  earnedAt: string;
};

export type VaultLabels = {
  tabBadges: string;
  tabAchievements: string;
  tabCollections: string;
  noBadges: string;
  locked: string;
  earnedOn: string;
  achievement: Record<string, { name: string; hint: string }>;
  collection: Record<string, string>;
  rarity: Record<string, string>;
};

type VaultTab = "badges" | "achievements" | "collections";

const ACH_RARITY_TONE: Record<AchievementRarity, { ring: string; text: string }> = {
  common: { ring: "rgba(148,163,184,0.5)", text: "text-slate-300" },
  rare: { ring: "rgba(56,189,248,0.55)", text: "text-sky-300" },
  epic: { ring: "rgba(167,139,250,0.55)", text: "text-violet-300" },
  legendary: { ring: "rgba(245,203,70,0.6)", text: "text-electric-yellow" },
};

/**
 * Bóveda: medallas, logros y colecciones en un solo bloque con pestañas.
 *
 * Iban a ser tres secciones apiladas. Las fusioné porque responden a la misma
 * pregunta —"qué conseguí"— y separarlas obligaba a scrollear tres cabeceras
 * casi idénticas para comparar cosas que el jugador lee juntas. Como bloque
 * único además puede ocupar una columna alta en desktop y equilibrar la
 * composición contra la línea de tiempo.
 */
export function TrainerVault({
  badges,
  achievements,
  collections,
  labels,
}: {
  badges: VaultBadge[];
  achievements: Achievement[];
  collections: CollectionSlice[];
  labels: VaultLabels;
}) {
  const [tab, setTab] = useState<VaultTab>("badges");

  const tabs: { id: VaultTab; label: string; count: number }[] = [
    { id: "badges", label: labels.tabBadges, count: badges.length },
    {
      id: "achievements",
      label: labels.tabAchievements,
      count: achievements.filter((a) => a.unlocked).length,
    },
    { id: "collections", label: labels.tabCollections, count: collections.length },
  ];

  return (
    <section className="tp-rise overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-md">
      <div className="flex border-b border-white/[0.07]" role="tablist">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`relative flex-1 px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                active ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {t.label}
              <span className="ml-1 font-mono text-[9px] tabular-nums opacity-60">
                {t.count}
              </span>
              {active && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-pokeball-red" />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3">
        {tab === "badges" && <BadgeCase badges={badges} labels={labels} />}
        {tab === "achievements" && (
          <AchievementList achievements={achievements} labels={labels} />
        )}
        {tab === "collections" && (
          <CollectionGrid collections={collections} labels={labels} />
        )}
      </div>
    </section>
  );
}

/**
 * Vitrina de medallas: arte real del gym, sin orbe ni brillo de fondo.
 */
function BadgeCase({ badges, labels }: { badges: VaultBadge[]; labels: VaultLabels }) {
  if (badges.length === 0) {
    return (
      <p className="py-8 text-center text-[11px] text-on-surface-variant/60">
        {labels.noBadges}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
      {badges.map((badge) => (
        <div
          key={badge.id}
          title={`${badge.badgeName}${badge.leaderName ? ` — ${badge.leaderName}` : ""}\n${labels.earnedOn} ${badge.earnedAt}`}
          className="flex flex-col items-center gap-1.5 rounded-xl p-2"
        >
          <Image
            src={gymBadgeImageUrl(badge.type)}
            alt={badge.badgeName}
            width={48}
            height={48}
            className="h-11 w-11 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          />
          <p className="w-full truncate text-center text-[8px] font-semibold uppercase tracking-wide text-on-surface-variant/70">
            {badge.badgeName}
          </p>
          <p className="font-mono text-[7px] tabular-nums text-on-surface-variant/40">
            {badge.earnedAt}
          </p>
        </div>
      ))}
    </div>
  );
}

function AchievementList({
  achievements,
  labels,
}: {
  achievements: Achievement[];
  labels: VaultLabels;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {achievements.map((ach, i) => {
        const tone = ACH_RARITY_TONE[ach.rarity];
        const text = labels.achievement[ach.id];
        return (
          <li
            key={ach.id}
            className={`tp-tap flex items-center gap-2.5 rounded-xl border p-2 transition ${
              ach.unlocked
                ? "border-white/[0.1] bg-white/[0.04]"
                : "border-white/[0.04] bg-white/[0.012]"
            }`}
          >
            <div
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: ach.unlocked ? `${tone.ring}22` : "rgba(255,255,255,0.03)",
                boxShadow: ach.unlocked ? `inset 0 0 0 1px ${tone.ring}` : undefined,
              }}
            >
              <span
                className={`material-symbols-outlined text-[18px]! ${
                  ach.unlocked ? tone.text : "text-white/20"
                }`}
              >
                {ach.unlocked ? ach.icon : "lock"}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={`truncate text-[12px] font-bold ${
                    ach.unlocked ? "text-white" : "text-white/45"
                  }`}
                >
                  {text?.name ?? ach.id}
                </p>
                <span className="shrink-0 font-mono text-[9px] tabular-nums text-on-surface-variant/60">
                  {Math.min(ach.current, ach.goal)}/{ach.goal}
                </span>
              </div>
              <p className="mb-1 truncate text-[9px] text-on-surface-variant/50">
                {text?.hint ?? ""}
              </p>
              <ProgressRail
                pct={ach.pct}
                color={ach.unlocked ? tone.ring : "rgba(255,255,255,0.25)"}
                height={3}
                delayMs={i * 45}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CollectionGrid({
  collections,
  labels,
}: {
  collections: CollectionSlice[];
  labels: VaultLabels;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {collections.map((col, i) => (
        <div
          key={col.id}
          className="tp-tap relative overflow-hidden rounded-xl border border-white/[0.07] bg-black/25 p-3 transition hover:border-white/20"
        >
          <span
            aria-hidden
            className="absolute -right-4 -top-4 h-14 w-14 rounded-full opacity-30 blur-xl"
            style={{ background: col.accent }}
          />
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/85">
              {labels.collection[col.id] ?? col.id}
            </p>
            <span
              className="shrink-0 font-mono text-[13px] font-bold tabular-nums"
              style={{ color: col.accent }}
            >
              {Math.round(col.pct * 100)}%
            </span>
          </div>
          <ProgressRail pct={col.pct} color={col.accent} height={5} delayMs={i * 70} />
          <p className="mt-1 font-mono text-[9px] tabular-nums text-on-surface-variant/55">
            {col.owned}/{col.total}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Mini-cards de capturas recientes: sprite, rareza, glow, hover. */
export function RecentCatchStrip({
  items,
  emptyLabel,
  levelLabel,
}: {
  items: {
    id: string;
    name: string;
    spriteUrl: string;
    accent: string;
    isShiny: boolean;
    level: number;
    rarityLabel: string;
  }[];
  emptyLabel: string;
  levelLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-[11px] text-on-surface-variant/60">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={it.id}
          title={it.name}
          className="tp-podium tp-rise group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0e14] p-2 transition hover:border-white/20"
          style={{
            animationDelay: `${i * 40}ms`,
            boxShadow: `inset 0 0 0 1px ${it.accent}22, 0 8px 18px rgba(0,0,0,0.28)`,
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background: `radial-gradient(70% 60% at 50% 30%, ${it.accent}44, transparent 70%)`,
            }}
          />
          {it.isShiny && (
            <span className="material-symbols-outlined absolute right-1 top-1 z-[2] text-[11px]! text-electric-yellow">
              auto_awesome
            </span>
          )}
          <div className="relative flex h-16 items-end justify-center">
            <span
              aria-hidden
              className="absolute bottom-0 h-3 w-10 rounded-[100%] opacity-50 blur-md"
              style={{ background: it.accent }}
            />
            <Image
              src={uiSpriteUrl(it.spriteUrl, it.isShiny)}
              alt={it.name}
              width={64}
              height={64}
              unoptimized
              className="relative h-14 w-14 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)] transition duration-300 group-hover:-translate-y-0.5"
            />
          </div>
          <p className="relative mt-1 truncate text-center text-[10px] font-bold capitalize text-white">
            {it.name}
          </p>
          <div className="relative mt-0.5 flex items-center justify-between gap-1 px-0.5">
            <span className="font-mono text-[8px] tabular-nums text-white/50">
              {levelLabel}
              {it.level}
            </span>
            <span
              className="truncate text-[7px] font-bold uppercase tracking-wide"
              style={{ color: it.accent }}
            >
              {it.rarityLabel}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
