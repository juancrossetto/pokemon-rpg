"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { spriteFor } from "@/lib/shiny";
import { playBattleSfx } from "@/lib/battle-sfx";

type EvolvePhase = "intro" | "morph" | "flash" | "reveal" | "done";

type EvolvePopupProps = {
  fromName: string;
  fromSpriteUrl: string | null;
  toName: string;
  toSpriteUrl: string;
  labels: {
    /** “¿Qué? ¡X está evolucionando!” */
    evolving: string;
    /** “¡Se convirtió en Y!” */
    into: string;
    continue: string;
  };
  onContinue: () => void;
};

/**
 * Animación tipo juegos clásicos:
 * forma actual → siluetas blancas que alternan (acelerando) → flash → revelación.
 * Usa los mismos official-artwork que ya tenemos (from / to).
 */
export function EvolvePopup({
  fromName,
  fromSpriteUrl,
  toName,
  toSpriteUrl,
  labels,
  onContinue,
}: EvolvePopupProps) {
  const fromSrc = fromSpriteUrl ? spriteFor(fromSpriteUrl, false) : null;
  const toSrc = spriteFor(toSpriteUrl, false);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<EvolvePhase>("intro");
  /** En morph: true = silueta “to”, false = silueta “from”. */
  const [showToSilhouette, setShowToSilhouette] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    playBattleSfx("evolve");

    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    // Intro: sprite original a color.
    at(1600, () => setPhase("morph"));

    // Morph: alterna siluetas blancas, cada vez más rápido (estilo gen 1–3).
    const morphBeats = [
      0, 420, 840, 1200, 1520, 1800, 2040, 2240, 2420, 2580, 2720, 2840, 2940, 3020, 3080,
    ];
    for (let i = 0; i < morphBeats.length; i++) {
      at(1600 + morphBeats[i], () => setShowToSilhouette(i % 2 === 1));
    }

    at(1600 + 3200, () => {
      setPhase("flash");
      playBattleSfx("evolve");
    });
    at(1600 + 3200 + 450, () => setPhase("reveal"));
    at(1600 + 3200 + 450 + 900, () => setPhase("done"));

    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [mounted]);

  if (!mounted) return null;

  const showFrom =
    phase === "intro" || (phase === "morph" && !showToSilhouette);
  const silhouette = phase === "morph" || phase === "flash";
  const activeSrc = showFrom ? fromSrc : toSrc;
  const activeName = showFrom ? fromName : toName;
  const canDismiss = phase === "done";

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center px-margin-mobile"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evolve-popup-title"
    >
      <div className="absolute inset-0 bg-[#05070c]" aria-hidden />
      <div
        className={`evolve-stage-glow pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          phase === "intro" || phase === "morph" ? "opacity-100" : "opacity-40"
        }`}
        aria-hidden
      />
      {phase === "flash" || phase === "reveal" ? (
        <div
          className={`evolve-whiteout pointer-events-none absolute inset-0 ${
            phase === "flash" ? "evolve-whiteout-peak" : "evolve-whiteout-fade"
          }`}
          aria-hidden
        />
      ) : null}

      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-4 py-8 text-center">
        <p
          id="evolve-popup-title"
          className={`min-h-[3rem] text-base font-semibold leading-snug text-white transition-opacity duration-500 sm:text-lg ${
            phase === "flash" ? "opacity-0" : "opacity-100"
          }`}
        >
          {phase === "done" || phase === "reveal" ? labels.into : labels.evolving}
        </p>

        <div className="relative mt-8 flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
          <div
            className={`evolve-orbit pointer-events-none absolute inset-[-12%] rounded-full ${
              phase === "morph" ? "evolve-orbit-spin" : ""
            } ${phase === "done" || phase === "reveal" ? "opacity-50" : "opacity-80"}`}
          />
          <div
            className={`absolute inset-8 rounded-full blur-2xl transition-all duration-500 ${
              phase === "morph" || phase === "flash"
                ? "bg-white/35 scale-110"
                : phase === "reveal" || phase === "done"
                  ? "bg-tertiary/30 scale-100"
                  : "bg-white/10 scale-90"
            }`}
          />

          {activeSrc ? (
            <Image
              key={`${phase}-${showToSilhouette}-${activeName}`}
              src={activeSrc}
              alt={activeName}
              width={224}
              height={224}
              className={[
                "relative h-40 w-40 object-contain sm:h-48 sm:w-48",
                silhouette ? "evolve-silhouette" : "evolve-color-pop",
                phase === "morph" ? "evolve-morph-pulse" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              unoptimized
              priority
            />
          ) : null}
        </div>

        <p
          className={`mt-5 text-sm capitalize tracking-wide transition-opacity duration-500 ${
            phase === "done" || phase === "reveal"
              ? "font-bold text-tertiary opacity-100"
              : phase === "intro"
                ? "text-white/70 opacity-100"
                : "opacity-0"
          }`}
        >
          {phase === "done" || phase === "reveal" ? toName : fromName}
        </p>

        <button
          type="button"
          disabled={!canDismiss}
          onClick={onContinue}
          className={`mt-8 w-full max-w-xs rounded-xl bg-tertiary px-4 py-3 text-[13px] font-bold tracking-wide text-surface transition ${
            canDismiss
              ? "evolve-continue-in opacity-100 hover:brightness-110"
              : "pointer-events-none opacity-0"
          }`}
        >
          {labels.continue}
        </button>
      </div>
    </div>,
    document.body,
  );
}
