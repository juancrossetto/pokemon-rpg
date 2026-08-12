"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { XpSummaryEntry } from "@/actions/battle-move";
import { playUiSfx } from "@/lib/battle-sfx";
import { uiSpriteUrl } from "@/lib/sprites";
import { MAX_POKEMON_LEVEL, xpForLevel } from "@/lib/stats";

const XP_ICON = "/ui/exp.png";
const ORB_FLIGHT_MS = 720;
const IMPACT_MS = 320;
const CHARGE_MS = 320;

function progressInLevel(totalXp: number, level: number): number {
  if (level >= MAX_POKEMON_LEVEL) return 1;
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const span = ceil - floor;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (totalXp - floor) / span));
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

type Segment = {
  level: number;
  from: number;
  to: number;
  durationMs: number;
  levelUpAfter: boolean;
};

/** Duración según cuánto de la barra se mueve — siempre lenta para apreciarse. */
function segmentDurationMs(from: number, to: number, baseMs: number): number {
  const delta = Math.abs(to - from);
  return Math.round(baseMs + delta * 1400);
}

function buildSegments(entry: XpSummaryEntry): Segment[] {
  const endLevel = entry.leveledUpTo ?? entry.previousLevel;
  const segments: Segment[] = [];
  let level = entry.previousLevel;

  if (endLevel <= entry.previousLevel) {
    const from = progressInLevel(entry.xpBefore, level);
    const to = progressInLevel(entry.xpAfter, level);
    segments.push({
      level,
      from,
      to,
      durationMs: segmentDurationMs(from, to, 1100),
      levelUpAfter: false,
    });
    return segments;
  }

  {
    const from = progressInLevel(entry.xpBefore, level);
    segments.push({
      level,
      from,
      to: 1,
      durationMs: segmentDurationMs(from, 1, 900),
      levelUpAfter: true,
    });
  }
  level += 1;

  while (level < endLevel) {
    segments.push({
      level,
      from: 0,
      to: 1,
      durationMs: segmentDurationMs(0, 1, 850),
      levelUpAfter: true,
    });
    level += 1;
  }

  {
    const to = progressInLevel(entry.xpAfter, endLevel);
    segments.push({
      level: endLevel,
      from: 0,
      to,
      durationMs: segmentDurationMs(0, to, 1000),
      levelUpAfter: false,
    });
  }
  return segments;
}

type OrbFlight = {
  left: number;
  top: number;
  dx: number;
  dy: number;
  midDx: number;
  midDy: number;
};

function XpGainRow({
  entry,
  staggerMs,
  compact,
  orbIconSrc = XP_ICON,
}: {
  entry: XpSummaryEntry;
  staggerMs: number;
  compact: boolean;
  orbIconSrc?: string;
}) {
  const t = useTranslations("battle");
  const segments = buildSegments(entry);
  const startPct = segments[0] ? segments[0].from * 100 : 0;
  const [barPct, setBarPct] = useState(startPct);
  const [displayLevel, setDisplayLevel] = useState(entry.previousLevel);
  const [shownXp, setShownXp] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [done, setDone] = useState(false);
  const [phase, setPhase] = useState<"idle" | "charge" | "fly" | "impact" | "fill">("idle");
  const [orb, setOrb] = useState<OrbFlight | null>(null);
  const cancelRef = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const amountIconRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cancelRef.current = false;
    const finalLevel = entry.leveledUpTo ?? entry.previousLevel;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let timeout = 0;

    const wait = (ms: number) =>
      new Promise<void>((r) => {
        timeout = window.setTimeout(r, ms);
      });

    const animateValue = (
      from: number,
      to: number,
      durationMs: number,
      onFrame: (v: number) => void,
    ) =>
      new Promise<void>((resolve) => {
        const t0 = performance.now();
        const tick = (now: number) => {
          if (cancelRef.current) {
            resolve();
            return;
          }
          const u = Math.min(1, (now - t0) / durationMs);
          onFrame(from + (to - from) * easeInOutCubic(u));
          if (u < 1) raf = requestAnimationFrame(tick);
          else resolve();
        };
        raf = requestAnimationFrame(tick);
      });

    const measureOrbFlight = (): OrbFlight | null => {
      const row = rowRef.current;
      const fromEl = amountIconRef.current;
      const track = trackRef.current;
      if (!row || !fromEl || !track) return null;
      const rowBox = row.getBoundingClientRect();
      const fromBox = fromEl.getBoundingClientRect();
      const trackBox = track.getBoundingClientRect();
      const startX = fromBox.left + fromBox.width / 2 - rowBox.left;
      const startY = fromBox.top + fromBox.height / 2 - rowBox.top;
      const tipX =
        trackBox.left + (trackBox.width * Math.max(4, startPct)) / 100 - rowBox.left;
      const tipY = trackBox.top + trackBox.height / 2 - rowBox.top;
      return {
        left: startX,
        top: startY,
        dx: tipX - startX,
        dy: tipY - startY,
        midDx: (tipX - startX) * 0.48,
        midDy: (tipY - startY) * 0.42 - 26,
      };
    };

    const runReduced = () => {
      setBarPct(progressInLevel(entry.xpAfter, finalLevel) * 100);
      setDisplayLevel(finalLevel);
      setShownXp(entry.xpGained);
      setDone(true);
      setPhase("fill");
      if (entry.leveledUpTo != null) setCelebrating(true);
    };

    const runFill = async () => {
      setPhase("fill");
      const totalMs = Math.max(
        1400,
        segments.reduce((s, seg) => s + seg.durationMs, 0),
      );
      const xpPromise = animateValue(0, entry.xpGained, totalMs, (v) =>
        setShownXp(Math.round(v)),
      );

      for (const seg of segments) {
        if (cancelRef.current) return;
        setDisplayLevel(seg.level);
        setBarPct(seg.from * 100);
        await animateValue(seg.from, seg.to, seg.durationMs, (v) => setBarPct(v * 100));
        if (seg.levelUpAfter) {
          playUiSfx("levelUp");
          setCelebrating(true);
          setDisplayLevel(seg.level + 1);
          setBarPct(0);
          await wait(280);
        }
      }

      await xpPromise;
      if (cancelRef.current) return;
      setShownXp(entry.xpGained);
      setDisplayLevel(finalLevel);
      setBarPct(progressInLevel(entry.xpAfter, finalLevel) * 100);
      setDone(true);
      setOrb(null);
    };

    const waitPaint = () =>
      new Promise<void>((resolve) => {
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(() => resolve());
        });
      });

    const run = async () => {
      await wait(staggerMs);
      if (cancelRef.current) return;

      // Charge: la bolita late un instante antes de volar.
      setPhase("charge");
      setShownXp(entry.xpGained);
      await wait(CHARGE_MS);
      if (cancelRef.current) return;

      // Medir tras el charge (layout estable) y esperar paint del orb.
      await waitPaint();
      if (cancelRef.current) return;
      const flight = measureOrbFlight();
      if (flight) {
        setOrb(flight);
        setPhase("fly");
        playUiSfx("energy");
        await waitPaint();
        if (cancelRef.current) return;
        await wait(ORB_FLIGHT_MS);
        if (cancelRef.current) return;

        setPhase("impact");
        playUiSfx("heal");
        await wait(IMPACT_MS);
        if (cancelRef.current) return;
        setOrb(null);
      }

      setShownXp(0);
      await runFill();
    };

    // Primer tick post-montaje: evita setState síncrono en el cuerpo del effect.
    raf = requestAnimationFrame(() => {
      if (cancelRef.current) return;
      if (reduced) runReduced();
      else void run();
    });

    return () => {
      cancelRef.current = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identity via parent key + campos de XP
  }, [entry.instanceId, entry.xpBefore, entry.xpAfter, entry.xpGained, entry.previousLevel, entry.leveledUpTo, staggerMs]);

  const leveled = entry.leveledUpTo != null;
  const maxed = displayLevel >= MAX_POKEMON_LEVEL;
  const amountHidden = phase === "fly" || phase === "impact";

  return (
    <div
      ref={rowRef}
      className={`xp-gain-row relative overflow-visible${celebrating ? " xp-gain-row--levelup" : ""}${
        done ? " xp-gain-row--done" : ""
      }${compact ? " xp-gain-row--compact" : ""}${
        phase === "impact" ? " xp-gain-row--impact" : ""
      }${phase === "charge" ? " xp-gain-row--charge" : ""}${
        phase === "fly" ? " xp-gain-row--fly" : ""
      }`}
    >
      {orb ? (
        <span
          className={`xp-gain-orb${phase === "fly" ? " xp-gain-orb--fly" : ""}${
            phase === "impact" ? " xp-gain-orb--absorb" : ""
          }`}
          style={
            {
              left: orb.left,
              top: orb.top,
              "--xp-orb-dx": `${orb.dx}px`,
              "--xp-orb-dy": `${orb.dy}px`,
              "--xp-orb-mid-dx": `${orb.midDx}px`,
              "--xp-orb-mid-dy": `${orb.midDy}px`,
            } as CSSProperties
          }
          aria-hidden
        >
          <Image
            src={orbIconSrc}
            alt=""
            width={36}
            height={36}
            className="relative z-[1] h-9 w-9 object-contain"
            unoptimized
          />
          <span className="xp-gain-orb__glow" />
          {phase === "fly" ? <span className="xp-gain-orb__trail" /> : null}
        </span>
      ) : null}

      <div className="flex items-center gap-2.5">
        <div className="relative shrink-0">
          <Image
            src={uiSpriteUrl(entry.fromSpriteUrl, entry.isShiny)}
            alt=""
            width={compact ? 36 : 44}
            height={compact ? 36 : 44}
            unoptimized
            className={`object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] ${
              compact ? "h-9 w-9" : "h-11 w-11"
            }`}
          />
          {celebrating ? <span className="xp-gain-spark" aria-hidden /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] font-semibold capitalize text-white">
              {entry.name}
            </p>
            <span
              className={`xp-gain-amount inline-flex shrink-0 items-center gap-1.5 font-mono text-[13px] font-bold tabular-nums${
                phase === "charge" ? " xp-gain-amount--charge" : ""
              }${amountHidden ? " xp-gain-amount--ghost" : ""}`}
            >
              <span ref={amountIconRef} className="inline-flex">
                <Image
                  src={orbIconSrc}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.55)]"
                  unoptimized
                />
              </span>
              +{shownXp}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`shrink-0 font-mono text-[11px] font-bold tabular-nums ${
                celebrating ? "text-cyan-300" : "text-white/55"
              }`}
            >
              {t("level", { level: displayLevel })}
              {leveled && done ? (
                <span className="ml-1 text-cyan-300">
                  ↑{entry.leveledUpTo}
                </span>
              ) : null}
            </span>
            <div className="relative min-w-0 flex-1">
              <div
                ref={trackRef}
                className={`xp-gain-track relative w-full overflow-hidden ${
                  compact ? "h-2.5" : "h-3.5"
                }${phase === "impact" ? " xp-gain-track--impact" : ""}${
                  phase === "fill" || done ? " xp-gain-track--filling" : ""
                }`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(barPct)}
                aria-label={t("xpBarLabel", { name: entry.name })}
              >
                <div
                  className="xp-gain-fill absolute inset-y-0 left-0"
                  style={{ width: `${barPct}%` }}
                />
                {phase === "impact" || celebrating ? (
                  <span className="xp-gain-sheen" aria-hidden />
                ) : null}
              </div>
              {phase === "impact"
                ? [0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="xp-gain-burst-dot"
                      style={
                        {
                          left: `${Math.max(6, startPct)}%`,
                          "--burst-i": i,
                        } as CSSProperties
                      }
                      aria-hidden
                    />
                  ))
                : null}
            </div>
            {!maxed ? (
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/35">
                {Math.round(barPct)}%
              </span>
            ) : (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">
                MAX
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function XpGainPanel({
  entries,
  compact = false,
  showTitle = true,
  orbIconSrc = XP_ICON,
}: {
  entries: XpSummaryEntry[];
  compact?: boolean;
  showTitle?: boolean;
  /** Ícono del orbe/fila de XP (p. ej. Rare Candy en el resumen). */
  orbIconSrc?: string;
}) {
  const t = useTranslations("battle");
  if (entries.length === 0) return null;

  return (
    <section
      className={`xp-gain-panel${compact ? " xp-gain-panel--compact" : ""}`}
      aria-label={t("xpGainsTitle")}
    >
      {showTitle && !compact ? (
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          {t("xpGainsTitle")}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {entries.map((entry, i) => (
          <XpGainRow
            key={`${entry.instanceId}:${entry.xpBefore}:${entry.xpAfter}`}
            entry={entry}
            staggerMs={compact ? 120 + i * 160 : 200 + i * 280}
            compact={compact}
            orbIconSrc={orbIconSrc}
          />
        ))}
      </div>
    </section>
  );
}


