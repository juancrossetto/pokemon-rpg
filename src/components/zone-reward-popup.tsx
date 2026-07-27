"use client";

import Image from "next/image";
import { itemSpriteUrl } from "@/lib/item-sprites";

export type ZoneRewardClaim = {
  objectiveLabel: string;
  coins: number;
  itemName: string;
  quantity: number;
};

type ZoneRewardPopupProps = {
  reward: ZoneRewardClaim;
  labels: {
    title: string;
    coins: string;
    continue: string;
  };
  onContinue: () => void;
};

/**
 * Celebración al reclamar un objetivo de zona — mismo lenguaje visual que
 * medalla / evolución (rays, sparks, glow, card oscura centrada).
 */
export function ZoneRewardPopup({ reward, labels, onContinue }: ZoneRewardPopupProps) {
  const accent = "#f2c000";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-margin-mobile"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zone-reward-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label={labels.continue}
        onClick={onContinue}
      />

      <div
        className="evolve-card-in relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border bg-[#0c1018] px-5 py-7 text-center shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
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
            {labels.title}
          </p>

          <p className="mt-2 max-w-[90%] text-[13px] leading-snug text-white/65">
            {reward.objectiveLabel}
          </p>

          <div className="mt-6 flex w-full items-stretch justify-center gap-3">
            <div className="relative flex min-w-0 flex-1 flex-col items-center rounded-xl border border-white/10 bg-black/35 px-3 py-4">
              <span
                className="absolute inset-0 rounded-xl opacity-40"
                style={{
                  background: `radial-gradient(circle at 50% 30%, ${accent}33, transparent 70%)`,
                }}
              />
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span
                  className="absolute inset-0 rounded-full blur-xl"
                  style={{ background: `${accent}35` }}
                />
                <Image
                  src={itemSpriteUrl(reward.itemName)}
                  alt={reward.itemName}
                  width={56}
                  height={56}
                  className="relative h-14 w-14 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
                  unoptimized
                />
              </div>
              <p className="relative mt-2 text-[12px] font-semibold text-white/90">
                {reward.itemName}
              </p>
              <p
                className="relative mt-0.5 font-mono text-lg font-bold tabular-nums"
                style={{ color: accent, textShadow: `0 0 16px ${accent}55` }}
              >
                ×{reward.quantity}
              </p>
            </div>

            <div className="relative flex min-w-0 flex-1 flex-col items-center rounded-xl border border-white/10 bg-black/35 px-3 py-4">
              <span
                className="absolute inset-0 rounded-xl opacity-40"
                style={{
                  background: `radial-gradient(circle at 50% 30%, ${accent}33, transparent 70%)`,
                }}
              />
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span
                  className="absolute inset-0 rounded-full blur-xl"
                  style={{ background: `${accent}35` }}
                />
                <span
                  className="material-symbols-outlined relative text-[48px]! drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
                  style={{ color: accent }}
                >
                  paid
                </span>
              </div>
              <p className="relative mt-2 text-[12px] font-semibold text-white/90">
                {labels.coins}
              </p>
              <p
                className="relative mt-0.5 font-mono text-lg font-bold tabular-nums"
                style={{ color: accent, textShadow: `0 0 16px ${accent}55` }}
              >
                +{reward.coins}
              </p>
            </div>
          </div>

          <h2
            id="zone-reward-title"
            className="sr-only"
          >
            {labels.title}
          </h2>

          <button
            type="button"
            onClick={onContinue}
            className="mt-6 w-full rounded-xl px-4 py-3 text-[13px] font-bold tracking-wide text-surface transition hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, #111))`,
              boxShadow: `0 0 24px ${accent}44`,
            }}
          >
            {labels.continue}
          </button>
        </div>
      </div>
    </div>
  );
}
