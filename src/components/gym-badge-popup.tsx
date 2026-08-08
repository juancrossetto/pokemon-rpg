"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { typeColor } from "@/lib/type-colors";
import { gymBadgeImageUrl } from "@/lib/gym-art";

type GymBadgePopupProps = {
  gymType: string;
  gymName: string | null;
  leaderName: string | null;
  badgeName: string | null;
  portraitUrl: string | null;
  labels: {
    badgeEarned: string;
    tmEarned: string | null;
    heldEarned: string | null;
    continue: string;
  };
  onContinue: () => void;
};

/**
 * Celebración de medalla — mismo lenguaje visual que el popup de evolución
 * (rays, sparks, glow, card oscura centrada).
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
  labels,
  onContinue,
}: GymBadgePopupProps) {
  const accent = typeColor(gymType);
  const title = badgeName ?? labels.badgeEarned;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-margin-mobile"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gym-badge-title"
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

          <div className="relative mt-6 flex h-32 w-32 items-center justify-center">
            <span
              className="absolute inset-0 rounded-full blur-2xl"
              style={{ background: `${accent}40` }}
            />
            <span
              className="absolute inset-3 rounded-full border opacity-60"
              style={{ borderColor: `${accent}77`, boxShadow: `0 0 28px ${accent}55` }}
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
              className="relative h-[88px] w-[88px] object-contain drop-shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
            />
          </div>

          <h2
            id="gym-badge-title"
            className="mt-5 text-xl font-bold tracking-tight text-white sm:text-2xl"
            style={{ textShadow: `0 0 24px ${accent}66` }}
          >
            {title}
          </h2>

          {labels.tmEarned && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] text-white/70">
              <span className="material-symbols-outlined text-[14px]!" style={{ color: accent }}>
                memory
              </span>
              {labels.tmEarned}
            </p>
          )}
          {labels.heldEarned && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] text-white/70">
              <span className="material-symbols-outlined text-[14px]!" style={{ color: accent }}>
                bolt
              </span>
              {labels.heldEarned}
            </p>
          )}

          <button
            type="button"
            onClick={onContinue}
            className="mt-6 w-full rounded-xl px-4 py-3 text-[13px] font-bold tracking-wide text-white transition hover:brightness-110"
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
