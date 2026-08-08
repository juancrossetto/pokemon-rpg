"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { typeColor } from "@/lib/type-colors";
import { gymBadgeImageUrl } from "@/lib/gym-art";
import { avatarById, avatarDisplayName } from "@/lib/avatars";
import { itemDisplayUrl } from "@/lib/item-sprites";
import type { GymFirstWinReward } from "@/actions/battle-move";

const COIN_HD = "/items/hd/poke-coin.png";

/** Cuántos retratos se muestran antes de resumir el resto en "+N". */
const AVATAR_PREVIEW = 5;

type GymBadgePopupProps = {
  gymType: string;
  gymName: string | null;
  leaderName: string | null;
  badgeName: string | null;
  portraitUrl: string | null;
  /** Botín de la primera victoria. `null` en revancha: sólo se celebra la medalla. */
  rewards: GymFirstWinReward | null;
  labels: {
    badgeEarned: string;
    rewardsTitle: string;
    coins: string;
    tmEarned: string | null;
    heldEarned: string | null;
    avatarsEarned: string | null;
    avatarsHint: string;
    skip: string;
    continue: string;
  };
  onContinue: () => void;
};

type RewardRow =
  | { kind: "coins"; amount: number }
  | { kind: "item"; itemName: string; label: string }
  | { kind: "avatars"; slugs: string[]; label: string };

/** Contador que sube hasta `value`. El oro se siente ganado, no informado. */
function useCountUp(value: number, active: boolean, durationMs = 650): number {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!active || value <= 0) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      // easeOutCubic: arranca rápido y frena, como un contador de arcade.
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, active, durationMs]);

  return active ? shown : 0;
}

/**
 * Celebración de medalla + botín.
 *
 * Se revela por etapas (medalla → oro → MT → objeto → avatares) en vez de
 * mostrar todo junto: la medalla ya no es lo único que se ve, y cada premio
 * llega con su propio golpe de atención. Tocar el fondo antes de que termine
 * revela todo de una; recién cuando está todo a la vista cierra.
 *
 * Portal a `document.body`: el resumen aplica `transform` en `.result-in`,
 * y eso rompe `position: fixed` si el popup queda como hijo del card.
 */
export function GymBadgePopup({
  gymType,
  gymName,
  leaderName,
  badgeName,
  portraitUrl,
  rewards,
  labels,
  onContinue,
}: GymBadgePopupProps) {
  const accent = typeColor(gymType);
  const title = badgeName ?? labels.badgeEarned;
  const [mounted, setMounted] = useState(false);
  /** 0 = medalla aterrizando; 1..n = premios revelados. */
  const [stage, setStage] = useState(0);

  // rAF en vez de `setMounted(true)` directo: el setState síncrono en el cuerpo
  // de un efecto es error de `react-hooks/set-state-in-effect`.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const rows = useMemo<RewardRow[]>(() => {
    const out: RewardRow[] = [];
    if (rewards && rewards.coins > 0) out.push({ kind: "coins", amount: rewards.coins });
    if (rewards?.tmName && labels.tmEarned) {
      out.push({ kind: "item", itemName: rewards.tmName, label: labels.tmEarned });
    }
    if (rewards?.heldName && labels.heldEarned) {
      out.push({ kind: "item", itemName: rewards.heldName, label: labels.heldEarned });
    }
    if (rewards && rewards.avatarSlugs.length > 0 && labels.avatarsEarned) {
      out.push({
        kind: "avatars",
        slugs: rewards.avatarSlugs,
        label: labels.avatarsEarned,
      });
    }
    return out;
  }, [rewards, labels.tmEarned, labels.heldEarned, labels.avatarsEarned]);

  const allRevealed = stage >= rows.length;

  // Un timeout por etapa. El `setState` vive en el callback del timer (no en el
  // cuerpo del efecto), que es lo que pide `react-hooks/set-state-in-effect`.
  useEffect(() => {
    if (allRevealed) return;
    const delay = stage === 0 ? 620 : 460;
    const id = window.setTimeout(() => setStage((s) => s + 1), delay);
    return () => window.clearTimeout(id);
  }, [stage, allRevealed]);

  function handleBackdrop() {
    // Primer toque: adelantar el revelado. Segundo: cerrar.
    if (!allRevealed) {
      setStage(rows.length);
      return;
    }
    onContinue();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto px-margin-mobile py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gym-badge-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/78 backdrop-blur-sm"
        aria-label={allRevealed ? labels.continue : labels.skip}
        onClick={handleBackdrop}
      />

      <div
        className="evolve-card-in relative z-10 my-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-[#0c1018] px-5 py-7 text-center shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
        style={{ borderColor: `${accent}66` }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-95"
          style={{
            background: `
              radial-gradient(ellipse 80% 55% at 50% 32%, ${accent}38, transparent 68%),
              radial-gradient(circle at 50% 48%, rgba(255,255,255,0.12), transparent 52%),
              linear-gradient(180deg, ${accent}14, transparent 55%)
            `,
          }}
        />
        <div
          className="evolve-ray pointer-events-none absolute left-1/2 top-[36%] h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 opacity-35"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.16) 16deg, transparent 34deg, transparent 180deg, ${accent}33 198deg, transparent 216deg)`,
          }}
        />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <span
            key={i}
            className="evolve-spark pointer-events-none absolute h-1 w-1 rounded-full"
            style={{
              left: `${10 + i * 12}%`,
              bottom: `${20 + (i % 4) * 9}%`,
              background: accent,
              animationDelay: `${0.12 * i}s`,
              boxShadow: `0 0 6px ${accent}`,
            }}
          />
        ))}

        <div className="evolve-reveal-pop relative flex flex-col items-center">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            {labels.badgeEarned}
          </p>

          {(gymName || leaderName) && (
            <div className="mt-3 flex items-center gap-2.5">
              {portraitUrl && (
                <div
                  className="h-11 w-9 overflow-hidden rounded-md border bg-black/40"
                  style={{ borderColor: `${accent}55` }}
                >
                  <Image
                    src={portraitUrl}
                    alt={leaderName ?? ""}
                    width={36}
                    height={44}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
              )}
              <div className="text-left">
                {gymName && (
                  <p className="text-[12px] font-semibold text-white/90">{gymName}</p>
                )}
                {leaderName && (
                  <p className="text-[11px] text-white/45">{leaderName}</p>
                )}
              </div>
            </div>
          )}

          {/* La medalla cae y golpea; el anillo de impacto sale de ese golpe. */}
          <div className="relative mt-6 flex h-32 w-32 items-center justify-center">
            <span
              className="absolute inset-0 rounded-full blur-2xl"
              style={{ background: `${accent}40` }}
            />
            <span
              className="absolute inset-3 rounded-full border opacity-60"
              style={{ borderColor: `${accent}77`, boxShadow: `0 0 28px ${accent}55` }}
            />
            <span
              aria-hidden
              className="gym-badge-shock absolute inset-2 rounded-full border-2"
              style={{ borderColor: accent }}
            />
            <div
              className="evolve-pad absolute -bottom-1 left-1/2 h-2.5 w-[55%] -translate-x-1/2 rounded-[100%] blur-[2px]"
              style={{ background: `${accent}88` }}
            />
            <Image
              src={gymBadgeImageUrl(gymType)}
              alt={title}
              width={88}
              height={88}
              className="gym-badge-slam relative h-[88px] w-[88px] object-contain drop-shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
            />
          </div>

          <h2
            id="gym-badge-title"
            className="mt-5 text-xl font-bold tracking-tight text-white sm:text-2xl"
            style={{ textShadow: `0 0 24px ${accent}66` }}
          >
            {title}
          </h2>

          {rows.length > 0 && (
            <div className="mt-5 w-full">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
                {labels.rewardsTitle}
              </p>
              <ul className="flex flex-col gap-2">
                {rows.map((row, i) => (
                  <RewardTile
                    key={`${row.kind}-${i}`}
                    row={row}
                    accent={accent}
                    revealed={stage > i}
                    avatarsHint={labels.avatarsHint}
                    coinsLabel={labels.coins}
                  />
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={allRevealed ? onContinue : () => setStage(rows.length)}
            className="mt-6 w-full rounded-xl px-4 py-3 text-[13px] font-bold tracking-wide text-white transition hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, #111))`,
              boxShadow: `0 0 24px ${accent}44`,
            }}
          >
            {allRevealed ? labels.continue : labels.skip}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RewardTile({
  row,
  accent,
  revealed,
  avatarsHint,
  coinsLabel,
}: {
  row: RewardRow;
  accent: string;
  revealed: boolean;
  avatarsHint: string;
  coinsLabel: string;
}) {
  const coins = useCountUp(row.kind === "coins" ? row.amount : 0, revealed);

  return (
    <li
      className={`gym-reward-tile flex items-center gap-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-left ${
        revealed ? "gym-reward-tile--in" : "gym-reward-tile--hidden"
      }`}
      style={{ borderColor: revealed ? `${accent}44` : undefined }}
      aria-hidden={!revealed}
    >
      {row.kind === "coins" ? (
        <>
          <Image
            src={COIN_HD}
            alt=""
            width={34}
            height={34}
            unoptimized
            className="h-[34px] w-[34px] shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
          />
          <span className="min-w-0 flex-1">
            <span className="font-mono text-[16px] font-bold tabular-nums text-electric-yellow">
              +{coins}
            </span>{" "}
            <span className="text-[12px] text-white/55">{coinsLabel}</span>
          </span>
        </>
      ) : row.kind === "item" ? (
        <>
          <Image
            src={itemDisplayUrl(row.itemName, "hd")}
            alt=""
            width={34}
            height={34}
            unoptimized
            className="h-[34px] w-[34px] shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
          />
          <span className="min-w-0 flex-1 text-[12px] leading-snug text-white/85">
            {row.label}
          </span>
        </>
      ) : (
        <>
          <span className="flex shrink-0 -space-x-2">
            {row.slugs.slice(0, AVATAR_PREVIEW).map((slug, i) => {
              const option = avatarById(slug);
              if (!option) return null;
              return (
                <span
                  key={slug}
                  className="gym-reward-avatar relative h-9 w-9 overflow-hidden rounded-full border-2 bg-[#12141c]"
                  style={{
                    borderColor: `${accent}88`,
                    animationDelay: `${i * 90}ms`,
                    zIndex: AVATAR_PREVIEW - i,
                  }}
                  title={avatarDisplayName(slug)}
                >
                  <Image
                    src={option.src}
                    alt=""
                    width={36}
                    height={36}
                    className="h-full w-full object-cover object-top"
                  />
                </span>
              );
            })}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold leading-snug text-white/90">
              {row.label}
            </span>
            <span className="block text-[11px] leading-snug text-white/45">
              {avatarsHint}
            </span>
          </span>
          {row.slugs.length > AVATAR_PREVIEW ? (
            <span
              className="shrink-0 font-mono text-[12px] font-bold tabular-nums"
              style={{ color: accent }}
            >
              +{row.slugs.length - AVATAR_PREVIEW}
            </span>
          ) : null}
        </>
      )}
    </li>
  );
}
