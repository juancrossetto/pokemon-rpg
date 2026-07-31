"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { claimAchievement } from "@/actions/claim-achievement";
import { RewardList } from "@/components/events/reward-chip";
import { ProgressRail } from "@/components/trainer-profile-parts";
import { announceCoinDelta } from "@/lib/coin-fx";
import type { RewardDef } from "@/lib/events/rewards";
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
  claim: string;
  claiming: string;
  claimAll: string;
  claimed: string;
  claimError: string;
  rewardUnits: { coins: string; energy: string; gems: string };
  achievement: Record<string, { name: string; hint: string }>;
  collection: Record<string, string>;
  rarity: Record<string, string>;
};

type VaultTab = "badges" | "achievements" | "collections";

/** Acento del vault — naranja flúor, alineado con las barras del perfil. */
const VAULT_ORANGE = "#ff6a00";
const VAULT_YELLOW = "#ffe566";

/** Rarezas en la misma familia ámbar/pizarra — sin arcoíris por rareza. */
const ACH_RARITY_TONE: Record<AchievementRarity, { ring: string; text: string }> = {
  common: { ring: "rgba(168,174,186,0.45)", text: "text-white/55" },
  rare: { ring: "rgba(255,140,40,0.5)", text: "text-orange-300/90" },
  epic: { ring: "rgba(255,106,0,0.55)", text: "text-orange-200" },
  legendary: { ring: "rgba(255,229,102,0.6)", text: "text-yellow-200" },
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
  achievements: initialAchievements,
  collections,
  labels,
}: {
  badges: VaultBadge[];
  achievements: Achievement[];
  collections: CollectionSlice[];
  labels: VaultLabels;
}) {
  const locale = useLocale();
  const [tab, setTab] = useState<VaultTab>("badges");
  const [achievements, setAchievements] = useState(initialAchievements);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastGranted, setLastGranted] = useState<RewardDef[] | null>(null);

  useEffect(() => {
    setAchievements(initialAchievements);
  }, [initialAchievements]);

  const claimableCount = achievements.filter((a) => a.claimable).length;

  function markClaimed(ids: string[]) {
    const set = new Set(ids);
    setAchievements((prev) =>
      prev
        .map((a) =>
          set.has(a.id)
            ? { ...a, claimed: true, claimable: false }
            : a,
        )
        .sort((a, b) => {
          if (a.claimable !== b.claimable) return a.claimable ? -1 : 1;
          if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
          return b.pct - a.pct;
        }),
    );
  }

  function claim(id: string | "all") {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await claimAchievement(locale, id);
      if (!result.ok) {
        setError(labels.claimError);
        return;
      }
      if (result.coinsDelta !== 0) announceCoinDelta(result.coinsDelta);
      markClaimed(result.claimedIds);
      setLastGranted(result.granted);
    });
  }

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
                <span
                  className="absolute inset-x-3 bottom-0 h-0.5 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${VAULT_ORANGE}, ${VAULT_YELLOW})`,
                    boxShadow: `0 0 8px ${VAULT_ORANGE}99`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3">
        {tab === "badges" && <BadgeCase badges={badges} labels={labels} />}
        {tab === "achievements" && (
          <AchievementList
            achievements={achievements}
            labels={labels}
            claimableCount={claimableCount}
            pending={pending}
            error={error}
            lastGranted={lastGranted}
            onClaim={claim}
          />
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
  claimableCount,
  pending,
  error,
  lastGranted,
  onClaim,
}: {
  achievements: Achievement[];
  labels: VaultLabels;
  claimableCount: number;
  pending: boolean;
  error: string | null;
  lastGranted: RewardDef[] | null;
  onClaim: (id: string | "all") => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {claimableCount >= 2 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onClaim("all")}
          className="self-end rounded-lg border border-[#ff6a00]/40 bg-[#ff6a00]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white transition hover:bg-[#ff6a00]/25 disabled:opacity-50"
        >
          {pending
            ? labels.claiming
            : labels.claimAll.replace("{count}", String(claimableCount))}
        </button>
      )}

      {lastGranted && lastGranted.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
          <RewardList
            rewards={lastGranted}
            size="sm"
            unitLabels={{
              coins: labels.rewardUnits.coins,
              energy: labels.rewardUnits.energy,
            }}
          />
        </div>
      )}

      {error && (
        <p className="text-[10px] text-error" role="alert">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {achievements.map((ach, i) => {
          const tone = ACH_RARITY_TONE[ach.rarity];
          const text = labels.achievement[ach.id];
          return (
            <li
              key={ach.id}
              className={`tp-tap flex items-center gap-2.5 rounded-xl border p-2 transition ${
                ach.claimable
                  ? "border-[#ff6a00]/35 bg-[#ff6a00]/[0.08]"
                  : ach.unlocked
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
                  color={ach.unlocked ? VAULT_ORANGE : "rgba(255,255,255,0.25)"}
                  toColor={ach.unlocked ? VAULT_YELLOW : undefined}
                  height={3}
                  delayMs={i * 45}
                />
              </div>

              {ach.claimable ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onClaim(ach.id)}
                  className="shrink-0 rounded-md border border-[#ff6a00]/50 bg-[#ff6a00]/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white disabled:opacity-50"
                >
                  {pending ? labels.claiming : labels.claim}
                </button>
              ) : ach.claimed ? (
                <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-white/35">
                  {labels.claimed}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
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
            className="absolute -right-4 -top-4 h-14 w-14 rounded-full opacity-25 blur-xl"
            style={{ background: VAULT_ORANGE }}
          />
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/85">
              {labels.collection[col.id] ?? col.id}
            </p>
            <span
              className="shrink-0 font-mono text-[13px] font-bold tabular-nums"
              style={{ color: VAULT_YELLOW }}
            >
              {Math.round(col.pct * 100)}%
            </span>
          </div>
          <ProgressRail
            pct={col.pct}
            color={VAULT_ORANGE}
            toColor={VAULT_YELLOW}
            height={5}
            delayMs={i * 70}
          />
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
