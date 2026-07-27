"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { spriteFor } from "@/lib/shiny";

type EvolvePopupProps = {
  fromName: string;
  fromSpriteUrl: string | null;
  toName: string;
  toSpriteUrl: string;
  labels: {
    title: string;
    into: string;
    continue: string;
  };
  onContinue: () => void;
};

/**
 * Celebración fullscreen al evolucionar (piedra o nivel desde la ficha).
 * Portal a document.body: las cards del equipo usan transform/overflow y
 * atraparían un `fixed` hijo (el aviso quedaba dentro del slot).
 */
export function EvolvePopup({
  fromName,
  fromSpriteUrl,
  toName,
  toSpriteUrl,
  labels,
  onContinue,
}: EvolvePopupProps) {
  const accent = "#f2c000";
  const fromSrc = fromSpriteUrl ? spriteFor(fromSpriteUrl, false) : null;
  const toSrc = spriteFor(toSpriteUrl, false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-margin-mobile"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evolve-popup-title"
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
            id="evolve-popup-title"
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            {labels.title}
          </p>

          <div className="mt-6 flex items-end justify-center gap-3 sm:gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative flex h-20 w-20 items-center justify-center opacity-70">
                {fromSrc ? (
                  <Image
                    src={fromSrc}
                    alt={fromName}
                    width={80}
                    height={80}
                    className="h-20 w-20 object-contain"
                    unoptimized
                  />
                ) : null}
              </div>
              <p className="max-w-[5.5rem] truncate text-[11px] capitalize text-white/55">
                {fromName}
              </p>
            </div>

            <span
              className="evolve-arrow mb-8 material-symbols-outlined text-[28px]!"
              style={{ color: accent }}
              aria-hidden
            >
              arrow_forward
            </span>

            <div className="flex flex-col items-center gap-1.5">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <span
                  className="absolute inset-2 rounded-full blur-xl"
                  style={{ background: `${accent}40` }}
                />
                <Image
                  src={toSrc}
                  alt={toName}
                  width={112}
                  height={112}
                  className="relative h-28 w-28 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
                  unoptimized
                />
              </div>
              <p className="max-w-[6.5rem] truncate text-[13px] font-semibold capitalize text-white">
                {toName}
              </p>
            </div>
          </div>

          <p className="mt-5 text-[13px] leading-snug text-white/80">
            {labels.into}
          </p>

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
    </div>,
    document.body,
  );
}
