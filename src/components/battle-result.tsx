"use client";

import { useTranslations } from "next-intl";
import { BattleSprite } from "@/components/battle-sprite";
import type { XpSummaryEntry } from "@/actions/battle-move";

export type ResultMode = "won" | "lost" | "caught" | "fled" | "trainer_cleared";

export type ResultFighter = {
  name: string;
  speciesName: string;
  level: number;
  spriteUrl: string;
};

type Tag = { label: string; icon: string; tone: "win" | "ko" | "caught" | "neutral" } | null;

const TONE_CLASS: Record<"win" | "ko" | "caught" | "neutral", string> = {
  win: "border-tertiary/50 bg-tertiary/15 text-tertiary",
  ko: "border-error/50 bg-error/15 text-error",
  caught: "border-pokeball-red/50 bg-pokeball-red/15 text-pokeball-red",
  neutral: "border-white/15 bg-white/5 text-on-surface-variant",
};

function FighterCard({
  fighter,
  facing,
  tag,
  defeated,
  highlight,
}: {
  fighter: ResultFighter;
  facing: "front" | "back";
  tag: Tag;
  defeated: boolean;
  highlight: boolean;
}) {
  const t = useTranslations("battle");

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div className="relative flex h-28 w-28 items-center justify-center md:h-36 md:w-36">
        {highlight && (
          <>
            <span className="absolute inset-0 rounded-full bg-tertiary/15 blur-2xl" />
            <span className="victory-ring absolute inset-1 rounded-full border border-tertiary/40" />
          </>
        )}
        <BattleSprite
          speciesName={fighter.speciesName}
          facing={facing}
          fallbackUrl={fighter.spriteUrl}
          alt={fighter.name}
          width={144}
          height={144}
          className={`relative h-full w-full object-contain drop-shadow-lg ${
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
          <span className="material-symbols-outlined text-[14px]">{tag.icon}</span>
          {tag.label}
        </span>
      )}
    </div>
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
  children: React.ReactNode;
}) {
  const t = useTranslations("battle");
  const playerWon = mode === "won" || mode === "trainer_cleared" || mode === "caught";

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
        ? { label: t("caughtTag"), icon: "catching_pokemon", tone: "caught" }
        : mode === "fled"
          ? null
          : { label: t("koTag"), icon: "close", tone: "ko" };

  const headlineColor = playerWon
    ? "text-tertiary [text-shadow:0_0_28px_rgba(242,192,0,0.35)]"
    : mode === "lost"
      ? "text-error"
      : "text-on-surface";

  return (
    <div className="flex flex-1 items-center justify-center px-margin-mobile py-8">
      <div className="result-in w-full max-w-2xl">
        <p className="flex items-center justify-center gap-2 text-label-sm uppercase tracking-[0.2em] text-on-surface-variant">
          <span
            className={`h-1.5 w-1.5 rounded-full ${playerWon ? "bg-tertiary" : "bg-error"}`}
          />
          {t("resultEyebrow")}
        </p>
        <h1 className={`mt-2 text-center text-headline-lg ${headlineColor}`}>{resultText}</h1>
        {subText && (
          <p className="mx-auto mt-1 max-w-md text-center text-body-md text-on-surface-variant">
            {subText}
          </p>
        )}

        <section className="glass-panel relative mt-5 overflow-hidden rounded-2xl border border-white/10 p-4 shadow-lg md:p-6">
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-24 blur-2xl ${
              playerWon ? "bg-tertiary/10" : "bg-error/10"
            }`}
          />
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-start gap-2 md:gap-4">
            <FighterCard
              fighter={player}
              facing="front"
              tag={playerTag}
              defeated={mode === "lost"}
              highlight={playerWon}
            />
            <div className="flex flex-col items-center gap-1 pt-10">
              <span className="text-label-sm font-bold tracking-[0.2em] text-on-surface-variant/60">
                VS
              </span>
              <span className="h-10 w-px bg-gradient-to-b from-white/15 to-transparent" />
            </div>
            <FighterCard
              fighter={foe}
              facing="front"
              tag={foeTag}
              defeated={mode !== "lost" && mode !== "fled"}
              highlight={mode === "lost"}
            />
          </div>
        </section>

        {(coinsGained > 0 || (xpSummary && xpSummary.length > 0)) && (
          <section className="glass-panel mt-3 rounded-2xl border border-white/10 p-4">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                {t("rewardsTitle")}
              </p>
              {coinsGained > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-electric-yellow/25 bg-electric-yellow/10 px-2.5 py-0.5 font-mono text-label-sm text-electric-yellow">
                  <span className="material-symbols-outlined text-[16px]">paid</span>+{coinsGained}
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
                        <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                        {t("leveledUp", { level: entry.leveledUpTo })}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-4 flex flex-col items-center gap-3">{children}</div>
      </div>
    </div>
  );
}
