"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { spriteFor } from "@/lib/shiny";
import { playUiSfx } from "@/lib/battle-sfx";
import { startEvolutionBgm, stopEvolutionBgm } from "@/lib/battle-bgm";

type EvolvePhase = "intro" | "morph" | "flash" | "reveal" | "done";

/** Partículas ascendentes: fijas y no aleatorias para que SSR y cliente
 *  pinten lo mismo (Math.random() acá rompía la hidratación). */
const MOTES = [
  { x: 12, dur: 2.6, delay: 0, drift: 14 },
  { x: 26, dur: 2.1, delay: 0.35, drift: -10 },
  { x: 38, dur: 3.0, delay: 0.8, drift: 18 },
  { x: 50, dur: 2.3, delay: 0.15, drift: -6 },
  { x: 62, dur: 2.8, delay: 0.6, drift: 12 },
  { x: 74, dur: 2.0, delay: 1.0, drift: -16 },
  { x: 86, dur: 2.5, delay: 0.45, drift: 8 },
  { x: 20, dur: 3.2, delay: 1.3, drift: -12 },
  { x: 68, dur: 3.4, delay: 1.6, drift: 16 },
] as const;

type EvolvePopupProps = {
  fromName: string;
  fromSpriteUrl: string | null;
  toName: string;
  toSpriteUrl: string;
  isShiny?: boolean;
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
  isShiny = false,
  labels,
  onContinue,
}: EvolvePopupProps) {
  const fromSrc = fromSpriteUrl ? spriteFor(fromSpriteUrl, isShiny) : null;
  const toSrc = spriteFor(toSpriteUrl, isShiny);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<EvolvePhase>("intro");
  /** En morph: true = silueta “to”, false = silueta “from”. */
  const [showToSilhouette, setShowToSilhouette] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // El tema está compuesto contra estos mismos tiempos (ver
    // scripts/generate-evolution-theme.py): tensión durante el morph y
    // resolución mayor justo en el reveal.
    startEvolutionBgm();

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
      playUiSfx("evolve");
    });
    at(1600 + 3200 + 450, () => setPhase("reveal"));
    at(1600 + 3200 + 450 + 900, () => setPhase("done"));

    return () => {
      for (const id of timers) window.clearTimeout(id);
      stopEvolutionBgm();
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

        <div
          className={`evolve-stage evolve-stage--${phase} relative mt-8 flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56`}
        >
          <div className="evolve-rays" aria-hidden />
          <div className="evolve-vortex" aria-hidden />
          <div className="evolve-vortex evolve-vortex--reverse" aria-hidden />
          <div
            className={`evolve-orbit pointer-events-none absolute inset-[-12%] rounded-full ${
              phase === "morph" ? "evolve-orbit-spin" : ""
            } ${phase === "done" || phase === "reveal" ? "opacity-50" : "opacity-80"}`}
          />
          <div className="evolve-motes" aria-hidden>
            {MOTES.map((mote, i) => (
              <span
                key={i}
                className="evolve-mote"
                style={
                  {
                    "--mote-x": `${mote.x}%`,
                    "--mote-dur": `${mote.dur}s`,
                    "--mote-delay": `${mote.delay}s`,
                    "--mote-drift": `${mote.drift}px`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
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

          {phase === "reveal" ? (
            <>
              <span className="evolve-burst" aria-hidden />
              <span className="evolve-burst evolve-burst--b" aria-hidden />
              <span className="evolve-sparks" aria-hidden />
            </>
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
