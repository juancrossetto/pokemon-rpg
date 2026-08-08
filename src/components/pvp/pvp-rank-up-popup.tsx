"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { playUiSfx } from "@/lib/battle-sfx";
import { startRankUpBgm, stopRankUpBgm } from "@/lib/battle-bgm";
import { PvpRankBadge } from "@/components/pvp/pvp-rank-badge";
import {
  divisionRoman,
  tierGlowColor,
  type PvpDivision,
  type PvpTier,
} from "@/lib/pvp/tiers";

/** Duración total bloqueada: no se puede cerrar antes. */
export const PVP_RANK_UP_LOCK_MS = 5200;
/** Fundido de salida al final (imagen y música juntas). */
const RANK_UP_OUTRO_MS = 700;

type Props = {
  tier: PvpTier;
  division: PvpDivision;
  tierLabel: string;
  title: string;
  subtitle: string;
  /** Se llama solo cuando terminó la animación (auto). */
  onFinished: () => void;
};

/*
  Partículas fijas (no `Math.random()`): con valores aleatorios el HTML del
  server y el del cliente no coinciden y React tira mismatch de hidratación.
*/
const MOTES = [
  { x: 14, dur: 2.8, delay: 0, drift: 22, size: 4 },
  { x: 28, dur: 2.2, delay: 0.4, drift: -16, size: 3 },
  { x: 41, dur: 3.1, delay: 0.9, drift: 12, size: 5 },
  { x: 57, dur: 2.5, delay: 0.2, drift: -10, size: 3 },
  { x: 70, dur: 2.9, delay: 0.7, drift: 18, size: 4 },
  { x: 84, dur: 2.3, delay: 1.2, drift: -20, size: 3 },
  { x: 34, dur: 3.4, delay: 1.5, drift: 8, size: 4 },
  { x: 64, dur: 3.0, delay: 1.9, drift: -14, size: 5 },
] as const;

/**
 * Celebración de ascenso — no dismissible. Corre SFX + badge y cierra sola.
 *
 * Sin card ni panel: la insignia ocupa el centro de la pantalla y todo el
 * efecto (rayos, ondas, motas, barrido de luz) se construye alrededor, teñido
 * con el color del tier alcanzado.
 */
export function PvpRankUpPopup({
  tier,
  division,
  tierLabel,
  title,
  subtitle,
  onFinished,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let finished = false;
    let sfxTimer = 0;
    let outroTimer = 0;
    let closeTimer = 0;
    const id = requestAnimationFrame(() => {
      setMounted(true);
      // El golpe seco del impacto va como SFX; la fanfarria de victoria
      // sostiene los ~5 s que dura la celebración.
      playUiSfx("badge");
      startRankUpBgm();
      sfxTimer = window.setTimeout(() => playUiSfx("levelUp"), 320);
      outroTimer = window.setTimeout(() => {
        setClosing(true);
        stopRankUpBgm(RANK_UP_OUTRO_MS);
      }, PVP_RANK_UP_LOCK_MS - RANK_UP_OUTRO_MS);
      closeTimer = window.setTimeout(() => {
        if (finished) return;
        finished = true;
        onFinished();
      }, PVP_RANK_UP_LOCK_MS);
    });
    return () => {
      finished = true;
      cancelAnimationFrame(id);
      window.clearTimeout(sfxTimer);
      window.clearTimeout(outroTimer);
      window.clearTimeout(closeTimer);
      // Si se desmonta antes de tiempo (navegación), la música no queda sonando.
      stopRankUpBgm();
    };
  }, [onFinished]);

  if (!mounted) return null;

  const standing = `${tierLabel} ${divisionRoman(division)}`;

  return createPortal(
    <div
      className={`rankup-overlay fixed inset-0 z-[95] flex items-center justify-center px-margin-mobile${
        closing ? " rankup-overlay--out" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pvp-rankup-title"
      aria-busy="true"
      style={{ "--rankup-accent": tierGlowColor(tier) } as CSSProperties}
    >
      {/* Sin panel: el fondo es la escena en penumbra, no una card. */}
      <div className="rankup-scrim absolute inset-0" aria-hidden />
      <div className="rankup-flash absolute inset-0" aria-hidden />

      <div className="relative z-10 flex flex-col items-center text-center">
        <p id="pvp-rankup-title" className="rankup-title">
          {title}
        </p>
        <p className="rankup-subtitle">{subtitle}</p>

        <div className="rankup-stage">
          <span className="rankup-rays" aria-hidden />
          <span className="rankup-vortex" aria-hidden />
          <span className="rankup-glow" aria-hidden />

          <span className="rankup-motes" aria-hidden>
            {MOTES.map((m, i) => (
              <span
                key={i}
                className="rankup-mote"
                style={
                  {
                    "--m-x": `${m.x}%`,
                    "--m-dur": `${m.dur}s`,
                    "--m-delay": `${m.delay}s`,
                    "--m-drift": `${m.drift}px`,
                    "--m-size": `${m.size}px`,
                  } as CSSProperties
                }
              />
            ))}
          </span>

          <span className="rankup-ring" aria-hidden />
          <span className="rankup-ring rankup-ring--b" aria-hidden />
          <span className="rankup-sparks" aria-hidden />

          <span className="rankup-badge">
            <PvpRankBadge tier={tier} division={division} label={tierLabel} size="xl" />
            {/* Barrido de luz sobre el metal, en bucle. */}
            <span className="rankup-shine" aria-hidden />
          </span>
        </div>

        <p className="rankup-standing">{standing}</p>
      </div>
    </div>,
    document.body,
  );
}
