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
import { itemHdIconUrl } from "@/lib/item-hd-icons";
import type { XpSummaryEntry } from "@/actions/battle-move";
import { XpGainPanel } from "@/components/battle/xp-gain-panel";
import { playLootCollectFx, rewardToLootPiece } from "@/lib/loot-fly-fx";
import { flushPendingCoinDelta } from "@/lib/coin-fx";
import { BattleHighlightReel } from "@/components/battle/battle-highlight-reel";
import type { BattleHighlight } from "@/lib/battle-highlights";
import type { BattleItemUsage } from "@/lib/battle-item-usage";
import { PokemonImage } from "@/components/pokemon-image";

export type ResultMode = "won" | "lost" | "caught" | "fled" | "trainer_cleared";

export type ResultFighter = {
  name: string;
  speciesName: string;
  level: number;
  spriteUrl: string;
};

type Tag = { label: string; icon: string; tone: "win" | "ko" | "caught" | "neutral" } | null;

const EXIT_MS = 420;
const COIN_ICON = itemHdIconUrl("Gold Coin") ?? "/items/hd/gold-coin.png";
const POKE_BALL_CLOSED = "/items/hd/poke-ball-3d-closed.png";
const POKE_BALL_OPEN = "/items/hd/poke-ball-3d-open.png";

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
  win: "text-emerald-400",
  ko: "text-error",
  caught: "text-pokeball-red",
  neutral: "text-on-surface-variant",
};

function FighterCard({
  fighter,
  tag,
  defeated,
  highlight,
  compact = false,
}: {
  fighter: ResultFighter;
  tag: Tag;
  defeated: boolean;
  highlight: boolean;
  /** Mobile victoria: sprites más chicos para caber sin scroll. */
  compact?: boolean;
}) {
  const t = useTranslations("battle");

  return (
    <div className={`flex min-w-0 flex-col items-center ${compact ? "gap-0.5" : "gap-1"}`}>
      <div
        className={`relative flex items-center justify-center ${
          compact ? "h-12 w-12 sm:h-20 sm:w-20" : "h-16 w-16 sm:h-20 sm:w-20"
        }`}
      >
        {highlight && (
          <>
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/18 blur-lg" />
            <span className="victory-ring pointer-events-none absolute inset-1 rounded-full border border-emerald-300/25" />
          </>
        )}
        <Image
          src={uiSpriteUrl(fighter.spriteUrl)}
          alt={fighter.name}
          width={96}
          height={96}
          unoptimized
          className={`relative z-10 h-full w-full object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] ${
            defeated ? "translate-y-1 opacity-45 grayscale" : ""
          }`}
        />
        {defeated && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-px bg-linear-to-r from-transparent via-error/60 to-transparent" />
        )}
      </div>

      <div className="min-w-0 max-w-full text-center">
        <p
          className={`truncate font-semibold capitalize text-white ${
            compact ? "text-[11px] sm:text-[12px]" : "text-[12px]"
          }`}
        >
          {fighter.name}
        </p>
        <p className="text-[10px] text-white/45">{t("level", { level: fighter.level })}</p>
      </div>

      {tag ? (
        <span
          className={`inline-flex max-w-full items-center gap-0.5 truncate text-[9px] font-bold uppercase tracking-wider ${TONE_CLASS[tag.tone]}`}
        >
          <span className="material-symbols-outlined text-[12px]!">{tag.icon}</span>
          {tag.label}
        </span>
      ) : null}
    </div>
  );
}

function LevelUpFanfare({
  entries,
}: {
  entries: XpSummaryEntry[];
  player: ResultFighter;
}) {
  const t = useTranslations("battle");
  const leveled = entries.filter((e) => e.leveledUpTo != null);

  // El SFX de level-up lo dispara la barra de XP al cruzar el umbral.
  if (leveled.length === 0) return null;

  return (
    <section
      className="level-up-fanfare level-up-glow relative mt-3 overflow-hidden rounded-2xl border border-emerald-400/25 bg-emerald-400/8 px-3 py-3 md:px-4 md:py-4"
      aria-live="polite"
    >
      <span className="level-up-burst pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/20 blur-2xl" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="level-up-spark pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-emerald-300"
          style={{
            left: `${12 + i * 14}%`,
            bottom: `${18 + (i % 3) * 10}%`,
            animationDelay: `${0.12 * i}s`,
          }}
        />
      ))}
      <p className="relative text-center text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
        {t("levelUpFanfare")}
      </p>
      <div className="relative mt-2 flex flex-wrap items-center justify-center gap-3">
        {/* Cada Pokémon que subió entra con su propio pop, escalonado. El chip
            ya trae 0.35s de delay para caer después del fanfare; el índice lo
            corre un poco más para que no aparezcan todos de golpe. */}
        {leveled.map((entry, i) => (
          <div
            key={entry.instanceId}
            className="level-up-chip flex items-center gap-2"
            style={{ animationDelay: `${(0.35 + i * 0.09).toFixed(2)}s` }}
          >
            <Image
              src={uiSpriteUrl(entry.fromSpriteUrl, entry.isShiny)}
              alt={entry.name}
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 object-contain"
            />
            <div className="text-left">
              <p className="text-[13px] font-semibold capitalize text-white">{entry.name}</p>
              <p className="font-mono text-[12px] text-emerald-300">
                {t("level", { level: entry.previousLevel })} →{" "}
                {t("level", { level: entry.leveledUpTo! })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BattleItemUsageSummary({ items }: { items: BattleItemUsage[] }) {
  const t = useTranslations("battle");

  return (
    <section className="result-stagger result-stagger--5 mt-2 rounded-xl border border-white/8 bg-black/25 px-2.5 py-2 sm:mt-3 sm:px-3 sm:py-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
        <span className="material-symbols-outlined text-[13px]!" aria-hidden>
          backpack
        </span>
        {t("itemsUsedTitle")}
      </p>

      <div className="divide-y divide-white/6">
        {items.map((entry) => {
          const itemIcon = itemHdIconUrl(entry.itemName) ?? "/items/hd/potion.png";
          return (
            <div
              key={`${entry.itemName}:${entry.targetInstanceId}:${entry.kind}:${entry.automatic}`}
              className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5 first:pt-0 last:pb-0"
            >
              <Image
                src={itemIcon}
                alt=""
                width={32}
                height={32}
                unoptimized
                className="h-8 w-8 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.45)]"
              />

              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[11px] font-semibold text-white sm:text-[12px]">
                    {entry.itemName}
                  </p>
                  {entry.quantity > 1 ? (
                    <span className="shrink-0 font-mono text-[10px] font-bold text-white/55">
                      x{entry.quantity}
                    </span>
                  ) : null}
                  {entry.automatic ? (
                    <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[7px] font-black tracking-[0.1em] text-primary">
                      AUTO
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1">
                  <span className="material-symbols-outlined text-[11px]! text-white/30" aria-hidden>
                    arrow_forward
                  </span>
                  <PokemonImage
                    src={entry.targetSpriteUrl}
                    alt=""
                    width={22}
                    height={22}
                    unoptimized
                    className="h-[22px] w-[22px] shrink-0 object-contain"
                  />
                  <span className="truncate text-[10px] font-medium capitalize text-white/60">
                    {entry.targetName}
                  </span>
                </div>
              </div>

              <span className="whitespace-nowrap font-mono text-[11px] font-bold text-emerald-300 sm:text-[12px]">
                {entry.kind === "revive"
                  ? t("itemsUsedRevived", { hp: entry.totalAmount })
                  : t("itemsUsedHealed", { hp: entry.totalAmount })}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function BattleResult({
  mode,
  lossReason = null,
  resultText,
  subText,
  player,
  foe,
  xpSummary,
  coinsGained,
  pvpRating = null,
  highlights = [],
  farmStreak = 0,
  itemUsage = [],
  children,
}: {
  mode: ResultMode;
  /** Derrota por reloj: tag y sprite distintos a un K.O. */
  lossReason?: "faint" | "idle" | null;
  resultText: string;
  subText?: string | null;
  player: ResultFighter;
  foe: ResultFighter;
  xpSummary: XpSummaryEntry[] | null;
  coinsGained: number;
  /** Elo PvP ranked: fila compacta en Recompensas (sin barra). */
  pvpRating?: { before: number; after: number } | null;
  highlights?: BattleHighlight[];
  farmStreak?: number;
  itemUsage?: BattleItemUsage[];
  children: ReactNode;
}) {
  const t = useTranslations("battle");
  const router = useRouter();
  const playerWon = mode === "won" || mode === "trainer_cleared" || mode === "caught";
  const idleLoss = mode === "lost" && lossReason === "idle";
  // Con oferta de move/evo la card de level-up es la prioridad: ocultar VS + fanfare
  // evita el scroll forzado por apilar todo en un modal de altura limitada.
  const needsLevelUpChoices =
    xpSummary?.some(
      (e) =>
        e.leveledUpTo != null &&
        ((e.pendingMoves?.length ?? 0) > 0 ||
          (e.autoTaught?.length ?? 0) > 0 ||
          e.evolveOffer != null),
    ) ?? false;
  const [offersSettled, setOffersSettled] = useState(false);
  const hasLevelUpChoices = needsLevelUpChoices && !offersSettled;
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  const coinOriginRef = useRef<HTMLSpanElement>(null);
  const coinFxPlayedRef = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => {
      cancelAnimationFrame(raf);
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    };
  }, []);

  // Monedas: vuelan al header cuando se ve la fila de recompensas (no al KO).
  useEffect(() => {
    if (!mounted || coinsGained <= 0 || hasLevelUpChoices || coinFxPlayedRef.current) {
      return;
    }

    let cancelled = false;
    let tries = 0;
    let retryTimer = 0;

    function playFromOrigin() {
      if (cancelled || coinFxPlayedRef.current) return;
      const el = coinOriginRef.current;
      if (!el) {
        // El portal monta en el frame siguiente; reintentar un poco.
        if (tries++ < 12) {
          retryTimer = window.setTimeout(playFromOrigin, 50);
          return;
        }
        flushPendingCoinDelta();
        coinFxPlayedRef.current = true;
        return;
      }
      coinFxPlayedRef.current = true;
      const r = el.getBoundingClientRect();
      playLootCollectFx({
        origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
        pieces: [rewardToLootPiece({ kind: "coins", amount: coinsGained })],
        // Ya sembramos el pending al ganar: flush al aterrizar (sin sumar 2×).
        onFirstLanding: () => flushPendingCoinDelta(),
      });
    }

    const kick = window.setTimeout(playFromOrigin, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(kick);
      window.clearTimeout(retryTimer);
    };
  }, [mounted, coinsGained, hasLevelUpChoices]);

  useEffect(() => {
    let playGen = 0;
    if (playerWon) {
      playGen = startResultBgm("victory");
    } else if (mode === "lost") {
      playBattleSfx(idleLoss ? "miss" : "faint");
      playGen = startResultBgm("defeat");
    } else {
      playBattleSfx("miss");
    }
    return () => stopResultBgm(playGen);
  }, [mode, playerWon, idleLoss]);

  const leave = useCallback(
    (target: LeaveTarget) => {
      if (leaving) return;
      setLeaving(true);
      stopResultBgm();
      // Si el jugador se va antes del vuelo, no dejes el badge trabado en pending.
      if (!coinFxPlayedRef.current && coinsGained > 0) {
        coinFxPlayedRef.current = true;
        flushPendingCoinDelta();
      }
      leaveTimer.current = window.setTimeout(() => {
        if (typeof target === "string") router.push(target);
        else void target();
      }, EXIT_MS);
    },
    [leaving, router, coinsGained],
  );

  const playerTag: Tag =
    mode === "lost"
      ? idleLoss
        ? { label: t("timeOutTag"), icon: "timer_off", tone: "ko" }
        : { label: t("koTag"), icon: "close", tone: "ko" }
      : mode === "fled"
        ? { label: t("fledTag"), icon: "directions_run", tone: "neutral" }
        : { label: t("victoryTag"), icon: "star", tone: "win" };

  const foeTag: Tag =
    mode === "lost"
      ? { label: t("victoryTag"), icon: "star", tone: "win" }
      : mode === "caught"
        ? { label: t("caughtTag"), icon: "sports_baseball", tone: "caught" }
        : mode === "fled"
          ? null
          : { label: t("koTag"), icon: "close", tone: "ko" };

  const headlineTone = playerWon ? "win" : mode === "lost" ? "lose" : "neutral";
  const outcomePillLabel =
    mode === "lost"
      ? idleLoss
        ? t("timeOutDefeatTag")
        : t("defeatTag")
      : mode === "caught"
        ? t("caughtTag")
        : mode === "fled"
          ? t("fledTag")
          : t("victoryTag");
  const outcomePillIcon =
    mode === "lost"
      ? idleLoss
        ? "timer_off"
        : "sentiment_very_dissatisfied"
      : mode === "caught"
        ? "sports_baseball"
        : mode === "fled"
          ? "directions_run"
          : "star";

  const accentGlow = playerWon
    ? "bg-white/6"
    : mode === "lost"
      ? "bg-pokeball-red/20"
      : "bg-white/8";

  const cardTopGlow = playerWon
    ? "bg-emerald-400/10"
    : mode === "lost"
      ? "bg-pokeball-red/25"
      : "bg-white/5";

  const cardSurface = playerWon
    ? "border-white/12 bg-[#12141c]/97"
    : mode === "lost"
      ? "border-pokeball-red/30 bg-[#140e10]/96"
      : "border-white/12 bg-[#12141c]/96";

  if (!mounted) return null;

  return createPortal(
    <BattleResultLeaveContext.Provider value={leave}>
      <div
        className={`battle-result-overlay fixed inset-0 z-[90] flex items-center justify-center overflow-x-clip overflow-y-auto px-3 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:px-4${
          leaving ? " is-leaving" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="battle-result-title"
      >
        <div className="fixed inset-0 bg-black/78 backdrop-blur-sm" aria-hidden />
        <div
          className={`pointer-events-none fixed inset-0 ${accentGlow} opacity-40 blur-3xl`}
          aria-hidden
        />

        {/*
          max-h resta safe-area + usa --app-vh (innerHeight): en iOS PWA
          100dvh no coincide con el área visible y los CTAs quedaban bajo el
          home indicator. En mobile anclamos abajo (items-end) para que los
          botones no se corten.
        */}
        <div
          className={`result-in relative z-10 my-auto flex max-h-[calc(var(--app-vh,100dvh)-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem)] w-full min-w-0 flex-col overflow-x-clip overflow-hidden rounded-[1.25rem] border shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl ${
            playerWon ? "result-in--win" : ""
          } ${!hasLevelUpChoices && playerWon ? "result-in--compact" : ""} ${cardSurface} ${hasLevelUpChoices ? "max-w-3xl" : "max-w-md"}`}
        >
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-28 ${cardTopGlow} blur-2xl`}
            aria-hidden
          />
          {playerWon ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-emerald-300/35 to-transparent"
            />
          ) : null}

          <div className="relative min-h-0 flex-1 overflow-x-clip overflow-y-auto overscroll-contain px-3.5 py-3.5 md:px-5 md:py-4">
            {/*
              Si hay que aprender un movimiento / evolucionar, esa UI manda
              sola: sin sello VICTORIA, momentos clave ni botones abajo.
              Al resolver las ofertas (`offersSettled`) aparece el resumen.
            */}
            {hasLevelUpChoices ? (
              <>
                <h1 id="battle-result-title" className="sr-only">
                  {resultText}
                </h1>
                {xpSummary ? (
                  <div className="result-stagger result-stagger--1">
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
                        isShiny: e.isShiny,
                        autoTaught: e.autoTaught ?? [],
                        pendingMoves: e.pendingMoves ?? [],
                        evolveOffer: e.evolveOffer ?? null,
                        knownMoves: e.knownMoves ?? [],
                      }))}
                      onSettled={() => setOffersSettled(true)}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <>
            <div className="result-stagger result-stagger--1 flex flex-col items-center gap-0.5 sm:gap-1.5">
              {playerWon ? (
                <div className="result-win-seal flex flex-col items-center gap-0.5 sm:gap-1.5">
                  <Image
                    src={mode === "caught" ? POKE_BALL_OPEN : POKE_BALL_CLOSED}
                    alt=""
                    width={72}
                    height={72}
                    className="result-win-seal__ball h-10 w-10 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
                    unoptimized
                    priority
                  />
                  <span className="result-win-seal__label text-[0.65rem] font-bold uppercase tracking-[0.14em] text-emerald-300/95 sm:text-[0.7rem]">
                    {outcomePillLabel}
                  </span>
                </div>
              ) : (
                <span
                  className={`result-outcome-pill result-outcome-pill--${headlineTone}`}
                >
                  <span className="material-symbols-outlined text-[14px]!">
                    {outcomePillIcon}
                  </span>
                  {outcomePillLabel}
                </span>
              )}
              <h1
                id="battle-result-title"
                className={`result-title result-title--${headlineTone} text-center`}
              >
                {resultText}
              </h1>
              {/* En mobile el subtítulo “Batalla finalizada” solo alarga; en sm+ sí. */}
              {subText ? (
                <p className="result-lede mx-auto hidden max-w-sm text-center text-[12px] leading-snug text-white/55 sm:block md:text-[0.88rem]">
                  {subText}
                </p>
              ) : (
                <p className="hidden text-[11px] font-medium text-white/40 sm:block">
                  {t("resultEyebrow")}
                </p>
              )}
            </div>

            <section className="result-stagger result-stagger--2 relative mt-2 overflow-hidden rounded-xl border border-white/8 bg-black/35 p-2 sm:mt-3 sm:p-3 md:mt-3.5 md:p-3">
                <div className="relative grid grid-cols-[1fr_auto_1fr] items-start gap-1.5">
                  <div className="result-duel-player min-w-0">
                    <FighterCard
                      fighter={player}
                      tag={playerWon ? null : playerTag}
                      defeated={mode === "lost" && !idleLoss}
                      highlight={playerWon}
                      compact={playerWon}
                    />
                  </div>
                  <div className="result-duel-vs flex flex-col items-center gap-1 pt-3 sm:pt-5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                      vs
                    </span>
                    <span className="h-4 w-px bg-linear-to-b from-white/15 to-transparent sm:h-6" />
                  </div>
                  <div className="result-duel-foe min-w-0">
                    <FighterCard
                      fighter={foe}
                      tag={foeTag}
                      defeated={mode !== "lost" && mode !== "fled"}
                      highlight={mode === "lost"}
                      compact={playerWon}
                    />
                  </div>
                </div>
              </section>

            {playerWon && (highlights.length > 0 || farmStreak >= 2) ? (
              <div className="result-stagger result-stagger--3 mt-2 sm:mt-3">
                {farmStreak >= 2 ? (
                  <p className="battle-farm-streak mb-1.5 text-center text-[11px] font-semibold text-amber-200/90 sm:mb-2 sm:text-[12px]">
                    {t("farmStreak", { count: farmStreak })}
                  </p>
                ) : null}
                {highlights.length > 0 ? (
                  <BattleHighlightReel
                    title={t("highlightReelTitle")}
                    items={highlights}
                    compact
                    labels={{
                      crit: t("highlightCrit"),
                      superEffective: t("highlightSuperEffective"),
                      ko: t("highlightKo"),
                      ohko: t("highlightOhko"),
                      multiHit: (count) => t("highlightMultiHit", { count }),
                      seStreak: (count) => t("highlightSeStreak", { count }),
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            {/* Subió de nivel: en mobile lo dice la barra de EXP; en desktop
                queda el fanfare. Evita una card duplicada y el scroll. */}
            {xpSummary ? (
              <div className="result-stagger result-stagger--4 hidden md:block">
                <LevelUpFanfare entries={xpSummary} player={player} />
              </div>
            ) : null}

            {(coinsGained > 0 ||
              Boolean(pvpRating) ||
              (xpSummary && xpSummary.length > 0)) && (
              <section className="result-stagger result-stagger--5 result-rewards-card mt-2 rounded-2xl border border-white/8 bg-black/40 p-2.5 sm:mt-3 sm:p-3 md:p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40 sm:mb-3">
                  {t("rewardsTitle")}
                </p>

                <div className="flex flex-col gap-2 sm:gap-2.5">
                  {coinsGained > 0 ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium text-white/70">{t("coins")}</span>
                      <span
                        ref={coinOriginRef}
                        className="inline-flex items-center gap-1.5 font-mono text-[15px] font-bold tabular-nums text-white"
                      >
                        <Image
                          src={COIN_ICON}
                          alt=""
                          width={28}
                          height={28}
                          className="h-6 w-6 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:h-7 sm:w-7"
                          unoptimized
                        />
                        +{coinsGained}
                      </span>
                    </div>
                  ) : null}

                  {pvpRating ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium text-white/70">
                        {t("pvpRating")}
                      </span>
                      <span className="inline-flex items-baseline gap-1.5 font-mono text-[15px] font-bold tabular-nums text-white">
                        <span>{pvpRating.after}</span>
                        <span
                          className={
                            pvpRating.after - pvpRating.before >= 0
                              ? "text-emerald-400"
                              : "text-error"
                          }
                        >
                          ({pvpRating.after - pvpRating.before >= 0 ? "+" : ""}
                          {pvpRating.after - pvpRating.before})
                        </span>
                      </span>
                    </div>
                  ) : null}

                  {xpSummary && xpSummary.length > 0 ? (
                    <XpGainPanel entries={xpSummary} showTitle={false} />
                  ) : null}
                </div>
              </section>
            )}

            {itemUsage.length > 0 ? (
              <BattleItemUsageSummary items={itemUsage} />
            ) : null}
              </>
            )}
          </div>

          {!hasLevelUpChoices ? (
            <div className="result-stagger result-stagger--6 relative shrink-0 border-t border-white/8 px-3 py-2.5 sm:px-4 sm:py-3 md:px-6 md:py-4">
              <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-1.5 sm:gap-2">
                {children}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </BattleResultLeaveContext.Provider>,
    document.body,
  );
}
