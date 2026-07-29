"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Image from "next/image";
import { LevelUpOffersPanel } from "@/components/level-up-offers";
import { uiSpriteUrl } from "@/lib/sprites";
import { playBattleSfx } from "@/lib/battle-sfx";
import { startResultBgm, stopResultBgm } from "@/lib/battle-bgm";
import type { XpSummaryEntry } from "@/actions/battle-move";

export type ResultMode = "won" | "lost" | "caught" | "fled" | "trainer_cleared";

export type ResultFighter = {
  name: string;
  speciesName: string;
  level: number;
  spriteUrl: string;
};

type Tag = { label: string; icon: string; tone: "win" | "ko" | "caught" | "neutral" } | null;

const EXIT_MS = 420;

type LeaveTarget = string | (() => void | Promise<void>);

const BattleResultLeaveContext = createContext<(target: LeaveTarget) => void>(() => {});

/** Sale del resumen con fade y luego navega o ejecuta la acción. */
export function useBattleResultLeave() {
  return useContext(BattleResultLeaveContext);
}

export function SoftLeaveButton({
  href,
  className,
  children,
  onAction,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
  onAction?: () => void | Promise<void>;
}) {
  const leave = useBattleResultLeave();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (onAction) leave(onAction);
        else if (href) leave(href);
      }}
    >
      {children}
    </button>
  );
}

const TONE_CLASS: Record<"win" | "ko" | "caught" | "neutral", string> = {
  win: "border-tertiary/50 bg-tertiary/15 text-tertiary",
  ko: "border-error/50 bg-error/15 text-error",
  caught: "border-pokeball-red/50 bg-pokeball-red/15 text-pokeball-red",
  neutral: "border-white/15 bg-white/5 text-on-surface-variant",
};

function FighterCard({
  fighter,
  tag,
  defeated,
  highlight,
}: {
  fighter: ResultFighter;
  tag: Tag;
  defeated: boolean;
  highlight: boolean;
}) {
  const t = useTranslations("battle");

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div className="relative flex h-24 w-24 items-center justify-center md:h-28 md:w-28">
        {highlight && (
          <>
            <span className="absolute inset-0 rounded-full bg-tertiary/15 blur-2xl" />
            <span className="victory-ring absolute inset-1 rounded-full border border-tertiary/40" />
          </>
        )}
        {/* Render 3D de HOME, no el GIF pixel de la arena: el resumen es una
            pieza de vitrina y aguanta el detalle. La flotación es CSS, así que
            se mantiene aunque la imagen sea estática. */}
        <Image
          src={uiSpriteUrl(fighter.spriteUrl)}
          alt={fighter.name}
          width={128}
          height={128}
          unoptimized
          className={`relative h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] ${
            defeated ? "translate-y-1 opacity-45 grayscale" : "result-float"
          }`}
        />
        {defeated && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-error/60 to-transparent" />
        )}
      </div>

      <div className="min-w-0 text-center">
        <p className="truncate text-label-md font-bold capitalize text-on-surface">{fighter.name}</p>
        <p className="text-label-sm text-on-surface-variant">
          {t("level", { level: fighter.level })}
        </p>
      </div>

      {tag && (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-label-sm font-bold uppercase tracking-wider ${TONE_CLASS[tag.tone]}`}
        >
          <span className="material-symbols-outlined text-[14px]!">{tag.icon}</span>
          {tag.label}
        </span>
      )}
    </div>
  );
}

function LevelUpFanfare({
  entries,
  player,
}: {
  entries: XpSummaryEntry[];
  player: ResultFighter;
}) {
  const t = useTranslations("battle");
  const leveled = entries.filter((e) => e.leveledUpTo != null);

  useEffect(() => {
    if (leveled.length === 0) return;
    playBattleSfx("levelUp");
  }, [leveled.length]);

  if (leveled.length === 0) return null;

  return (
    <section
      className="level-up-fanfare level-up-glow relative mt-3 overflow-hidden rounded-2xl border border-tertiary/35 bg-tertiary/10 px-3 py-3 md:px-4 md:py-4"
      aria-live="polite"
    >
      <span className="level-up-burst pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tertiary/25 blur-2xl" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="level-up-spark pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-tertiary"
          style={{
            left: `${12 + i * 14}%`,
            bottom: `${18 + (i % 3) * 10}%`,
            animationDelay: `${0.12 * i}s`,
          }}
        />
      ))}
      <p className="relative text-center text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary">
        {t("levelUpFanfare")}
      </p>
      <div className="relative mt-2 flex flex-wrap items-center justify-center gap-3">
        {leveled.map((entry) => (
          <div key={entry.instanceId} className="flex items-center gap-2">
            <Image
              src={uiSpriteUrl(entry.fromSpriteUrl)}
              alt={entry.name}
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 object-contain"
            />
            <div className="text-left">
              <p className="text-label-md font-bold capitalize text-on-surface">{entry.name}</p>
              <p className="font-mono text-label-sm text-tertiary">
                {t("level", { level: entry.previousLevel })} → {t("level", { level: entry.leveledUpTo! })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BattleResult({
  mode,
  resultText,
  subText,
  player,
  foe,
  xpSummary,
  coinsGained,
  children,
}: {
  mode: ResultMode;
  resultText: string;
  subText?: string | null;
  player: ResultFighter;
  foe: ResultFighter;
  xpSummary: XpSummaryEntry[] | null;
  coinsGained: number;
  children: ReactNode;
}) {
  const t = useTranslations("battle");
  const router = useRouter();
  const playerWon = mode === "won" || mode === "trainer_cleared" || mode === "caught";
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
      stopResultBgm();
    };
  }, []);

  useEffect(() => {
    if (playerWon) {
      playBattleSfx("badge");
      startResultBgm("victory");
    } else if (mode === "lost") {
      playBattleSfx("faint");
      startResultBgm("defeat");
    } else {
      playBattleSfx("miss");
    }
    return () => stopResultBgm();
  }, [mode, playerWon]);

  const leave = useCallback(
    (target: LeaveTarget) => {
      if (leaving) return;
      setLeaving(true);
      stopResultBgm();
      leaveTimer.current = window.setTimeout(() => {
        if (typeof target === "string") router.push(target);
        else void target();
      }, EXIT_MS);
    },
    [leaving, router],
  );

  const playerTag: Tag =
    mode === "lost"
      ? { label: t("koTag"), icon: "close", tone: "ko" }
      : mode === "fled"
        ? { label: t("fledTag"), icon: "directions_run", tone: "neutral" }
        : { label: t("victoryTag"), icon: "trophy", tone: "win" };

  const foeTag: Tag =
    mode === "lost"
      ? { label: t("victoryTag"), icon: "trophy", tone: "win" }
      : mode === "caught"
        ? { label: t("caughtTag"), icon: "sports_baseball", tone: "caught" }
        : mode === "fled"
          ? null
          : { label: t("koTag"), icon: "close", tone: "ko" };

  const headlineTone = playerWon ? "win" : mode === "lost" ? "lose" : "neutral";
  const outcomePillLabel =
    mode === "lost"
      ? t("defeatTag")
      : mode === "caught"
        ? t("caughtTag")
        : mode === "fled"
          ? t("fledTag")
          : t("victoryTag");
  const outcomePillIcon =
    mode === "lost"
      ? "sentiment_very_dissatisfied"
      : mode === "caught"
        ? "sports_baseball"
        : mode === "fled"
          ? "directions_run"
          : "trophy";

  const accentGlow = playerWon
    ? "bg-tertiary/25"
    : mode === "lost"
      ? "bg-pokeball-red/25"
      : "bg-white/10";

  const cardTopGlow = playerWon
    ? "bg-tertiary/25"
    : mode === "lost"
      ? "bg-pokeball-red/30"
      : "bg-white/5";

  const cardBorder = playerWon
    ? "border-tertiary/25"
    : mode === "lost"
      ? "border-pokeball-red/30"
      : "border-white/12";

  if (!mounted) return null;

  return createPortal(
    <BattleResultLeaveContext.Provider value={leave}>
    <div
      className={`battle-result-overlay fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto overscroll-contain px-margin-mobile py-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]${
        leaving ? " is-leaving" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="battle-result-title"
    >
      <div className="fixed inset-0 bg-black/78 backdrop-blur-sm" aria-hidden />
      <div className={`pointer-events-none fixed inset-0 ${accentGlow} blur-3xl opacity-50`} aria-hidden />

      <div
        className={`result-in relative z-10 my-auto flex max-h-[min(92dvh,48rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-[#0c1018] shadow-[0_24px_80px_rgba(0,0,0,0.65)] ${cardBorder}`}
      >
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-36 ${cardTopGlow} blur-2xl`} />

        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6 md:py-6">
          <div className="flex flex-col items-center gap-2.5">
            <span className={`result-outcome-pill result-outcome-pill--${headlineTone}`}>
              <span className="material-symbols-outlined text-[14px]!">{outcomePillIcon}</span>
              {outcomePillLabel}
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
              {t("resultEyebrow")}
            </p>
            <h1
              id="battle-result-title"
              className={`result-title result-title--${headlineTone} text-center`}
            >
              {resultText}
            </h1>
            {subText && (
              <p className="mx-auto max-w-md text-center text-[0.95rem] leading-snug text-white/55">
                {subText}
              </p>
            )}
          </div>

          <section className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-3 md:mt-6 md:p-4">
            <div className="relative grid grid-cols-[1fr_auto_1fr] items-start gap-2 md:gap-3">
              <FighterCard
                fighter={player}
                tag={playerTag}
                defeated={mode === "lost"}
                highlight={playerWon}
              />
              <div className="flex flex-col items-center gap-1 pt-8 md:pt-9">
                <span className="text-label-sm font-bold tracking-[0.2em] text-on-surface-variant/60">
                  VS
                </span>
                <span className="h-8 w-px bg-gradient-to-b from-white/15 to-transparent md:h-10" />
              </div>
              <FighterCard
                fighter={foe}
                tag={foeTag}
                defeated={mode !== "lost" && mode !== "fled"}
                highlight={mode === "lost"}
              />
            </div>
          </section>

          {xpSummary ? <LevelUpFanfare entries={xpSummary} player={player} /> : null}

          {xpSummary ? (
            <div className="mt-3">
              <LevelUpOffersPanel
                key={xpSummary
                  .map(
                    (e) =>
                      `${e.instanceId}:${e.leveledUpTo}:${e.evolveOffer?.toSpeciesId ?? 0}`,
                  )
                  .join("|")}
                entries={xpSummary.map((e) => ({
                  instanceId: e.instanceId,
                  name: e.name,
                  leveledUpTo: e.leveledUpTo,
                  fromSpriteUrl: e.fromSpriteUrl,
                  autoTaught: e.autoTaught ?? [],
                  pendingMoves: e.pendingMoves ?? [],
                  evolveOffer: e.evolveOffer ?? null,
                  knownMoves: e.knownMoves ?? [],
                }))}
              />
            </div>
          ) : null}

          {(coinsGained > 0 || (xpSummary && xpSummary.length > 0)) && (
            <section className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3 md:p-4">
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                  {t("rewardsTitle")}
                </p>
                {coinsGained > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-electric-yellow/25 bg-electric-yellow/10 px-2.5 py-0.5 font-mono text-label-sm text-electric-yellow">
                    <span className="material-symbols-outlined text-[16px]!">paid</span>+{coinsGained}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                {xpSummary?.map((entry) => (
                  <div
                    key={entry.instanceId}
                    className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"
                  >
                    <span className="min-w-0 flex-1 truncate text-label-md capitalize text-on-surface">
                      {entry.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-label-md text-tertiary">
                        +{entry.xpGained} XP
                      </span>
                      {entry.leveledUpTo && (
                        <span className="level-up-chip inline-flex items-center gap-1 rounded-full border border-tertiary/40 bg-tertiary/10 px-2 py-0.5 text-label-sm text-tertiary">
                          <span className="material-symbols-outlined text-[14px]!">arrow_upward</span>
                          {t("leveledUp", { level: entry.leveledUpTo })}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="relative shrink-0 border-t border-white/10 bg-black/40 px-4 py-3 md:px-6 md:py-4">
          <div className="flex flex-col items-center gap-2">{children}</div>
        </div>
      </div>
    </div>
    </BattleResultLeaveContext.Provider>,
    document.body,
  );
}
