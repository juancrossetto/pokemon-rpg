"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { battleSfxForMove, playUiSfx } from "@/lib/battle-sfx";
import { formatMoveName } from "@/lib/format-move-name";
import { typeColor } from "@/lib/type-colors";
import { TypeSymbol } from "@/components/type-symbol";
import { showdownCategoryIconUrl } from "@/lib/type-icons";
import type { MoveCategoryKind } from "@/lib/level-up-read";

/** Duración total bloqueada: la celebración no se puede saltear. */
export const MOVE_LEARNED_LOCK_MS = 3400;
/** Fundido de salida al final. */
const OUTRO_MS = 600;

type Props = {
  /** Pokémon que lo aprendió. */
  pokemonName: string;
  moveName: string;
  moveType: string;
  category: MoveCategoryKind;
  power: number | null;
  accuracy: number | null;
  pp: number;
  onFinished: () => void;
};

/* Fijas, no aleatorias: `Math.random()` rompe la hidratación (server ≠ cliente). */
const MOTES = [
  { x: 10, dur: 2.4, delay: 0, drift: 18, size: 4 },
  { x: 24, dur: 2.9, delay: 0.5, drift: -12, size: 3 },
  { x: 38, dur: 2.2, delay: 1.0, drift: 14, size: 5 },
  { x: 52, dur: 2.7, delay: 0.3, drift: -8, size: 3 },
  { x: 66, dur: 2.4, delay: 0.8, drift: 16, size: 4 },
  { x: 80, dur: 3.0, delay: 1.3, drift: -18, size: 3 },
  { x: 92, dur: 2.6, delay: 0.6, drift: 10, size: 4 },
] as const;

/**
 * Celebración de movimiento aprendido — no dismissible, cierra sola.
 *
 * Sin card: el nombre del poder ocupa el centro y todo el efecto (impacto,
 * ondas, rayos, barrido) se tiñe con el color del tipo del movimiento, así
 * un Lanzallamas y un Rayo Hielo no se celebran igual.
 */
export function MoveLearnedPopup({
  pokemonName,
  moveName,
  moveType,
  category,
  power,
  accuracy,
  pp,
  onFinished,
}: Props) {
  const t = useTranslations("levelUp");
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let finished = false;
    const timers: number[] = [];
    const id = requestAnimationFrame(() => {
      setMounted(true);
      // El impacto suena con el tipo del movimiento; la fanfarria remata.
      playUiSfx(battleSfxForMove(moveType, category));
      timers.push(window.setTimeout(() => playUiSfx("levelUp"), 420));
      timers.push(
        window.setTimeout(() => setClosing(true), MOVE_LEARNED_LOCK_MS - OUTRO_MS),
      );
      timers.push(
        window.setTimeout(() => {
          if (finished) return;
          finished = true;
          onFinished();
        }, MOVE_LEARNED_LOCK_MS),
      );
    });
    return () => {
      finished = true;
      cancelAnimationFrame(id);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [onFinished, moveType, category]);

  if (!mounted) return null;

  const accent = typeColor(moveType);

  return createPortal(
    <div
      className={`learned-overlay fixed inset-0 z-[140] flex items-center justify-center px-margin-mobile${
        closing ? " learned-overlay--out" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-learned-title"
      aria-busy="true"
      style={{ "--learned-accent": accent } as CSSProperties}
    >
      <div className="learned-scrim absolute inset-0" aria-hidden />
      <div className="learned-flash absolute inset-0" aria-hidden />
      <div className="learned-rays absolute inset-0" aria-hidden />

      <span className="learned-motes absolute inset-0" aria-hidden>
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="learned-mote"
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

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
        <p className="learned-kicker">{t("newMove")}</p>

        <div className="learned-name-wrap">
          <span className="learned-ring" aria-hidden />
          <span className="learned-ring learned-ring--b" aria-hidden />
          <h2
            id="move-learned-title"
            className="learned-name"
            data-name={formatMoveName(moveName)}
          >
            {formatMoveName(moveName)}
          </h2>
        </div>

        <div className="learned-chips">
          <span className="learned-chip learned-chip--type">
            <TypeSymbol type={moveType} size={18} className="h-[18px] w-[18px]" />
            {moveType}
          </span>
          <span className="learned-chip">
            <Image
              src={showdownCategoryIconUrl(category)}
              alt=""
              width={26}
              height={18}
              className="h-[18px] w-[26px] object-contain"
              unoptimized
            />
            {t(`category.${category}`)}
          </span>
        </div>

        <dl className="learned-stats">
          <div>
            <dt>{t("power")}</dt>
            <dd>{power ?? "—"}</dd>
          </div>
          <div>
            <dt>{t("accuracy")}</dt>
            <dd>{accuracy == null ? t("neverMisses") : `${accuracy}%`}</dd>
          </div>
          <div>
            <dt>{t("pp")}</dt>
            <dd>{pp}</dd>
          </div>
        </dl>

        <p className="learned-owner">{pokemonName}</p>
      </div>
    </div>,
    document.body,
  );
}
