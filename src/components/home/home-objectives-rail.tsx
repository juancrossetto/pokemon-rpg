"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { playUiSfx } from "@/lib/battle-sfx";
import type { HomeObjective } from "@/lib/home-hub";

/** Ícono por objetivo. Todos existen ya en `/public/nav`. */
const OBJECTIVE_ICON: Record<string, string> = {
  stages: "/nav/compass-icon.png",
  trainers: "/nav/battle-icon.png",
  pokedex: "/nav/collection-icon.png",
};
const FALLBACK_ICON = "/nav/adventure-icon.png";
/** Cofre de la recompensa final — el usuario pidió este asset. */
const REWARD_ICON = "/nav/event-icon.png";

/** Debe coincidir con `objective-reward-center` en globals.css. */
const CENTER_REVEAL_MS = 1250;

type Reward = { src: string; label: string };

/**
 * Objetivos de ruta en mobile: carrusel de anillos de progreso + la
 * recompensa final. **Sólo mobile** (`lg:hidden`); en desktop sigue el panel
 * con pestañas, que tiene semanales y evento limitado además de estos.
 *
 * Antes esto era una lista de texto al fondo del home: el dato estaba pero no
 * se miraba. Un anillo con su ícono se lee de un vistazo y es tocable.
 */
export function HomeObjectivesRail({
  objectives,
  title,
  rewardTitle,
  claimLabel,
  claimedLabel,
  onClaim,
}: {
  objectives: HomeObjective[];
  title: string;
  rewardTitle: string;
  claimLabel: string;
  claimedLabel: string;
  /** Devuelve la recompensa a mostrar en el centro, o null si falló. */
  onClaim: (
    objectiveId: string,
    origin: { x: number; y: number },
  ) => Promise<Reward | null>;
}) {
  /** Objetivo que está "vibrando" tras el tap. */
  const [buzzing, setBuzzing] = useState<string | null>(null);
  /** Recompensa mostrándose en el centro de la pantalla. */
  const [center, setCenter] = useState<Reward | null>(null);

  if (objectives.length === 0) return null;

  const done = objectives.filter((o) => o.done || o.claimed).length;
  const total = objectives.length;

  async function handleClaim(objective: HomeObjective, el: HTMLElement) {
    if (!objective.claimable) return;
    const rect = el.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    setBuzzing(objective.id);
    playUiSfx("badge");
    // Háptica donde exista (Android / Chrome). En iOS no hace nada y no rompe.
    navigator.vibrate?.(18);
    window.setTimeout(() => setBuzzing(null), 420);

    const reward = await onClaim(objective.id, origin);
    if (!reward) return;
    // La recompensa aparece grande en el centro antes de irse al header.
    setCenter(reward);
    window.setTimeout(() => setCenter(null), CENTER_REVEAL_MS);
  }

  return (
    <section className="objectives-rail lg:hidden">
      {/*
        Un solo grid de 2 columnas × 3 filas para que los dos títulos compartan
        la fila 1 y el regalo caiga en la misma fila que los discos de los
        anillos. Antes "Recompensas" vivía dentro de su columna, una fila más
        abajo, y el PNG quedaba desalineado contra los íconos.
      */}
      <div className="objectives-rail__grid">
        <h2 className="objectives-rail__title">{title}</h2>
        <p className="objectives-reward__title">{rewardTitle}</p>

        <ul className="objectives-rail__track">
          {objectives.map((o) => {
            const pct =
              o.target > 0
                ? Math.max(0, Math.min(100, Math.round((o.current / o.target) * 100)))
                : 0;
            const complete = o.done || o.claimed;
            return (
              <li key={o.id} className="objectives-rail__item">
                <button
                  type="button"
                  className={[
                    "objective-ring",
                    complete ? "objective-ring--done" : "",
                    o.claimable ? "objective-ring--ready" : "",
                    buzzing === o.id ? "objective-ring--buzz" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ "--ring-pct": `${pct}` } as CSSProperties}
                  disabled={!o.claimable}
                  onClick={(e) => void handleClaim(o, e.currentTarget)}
                  aria-label={`${o.current}/${o.target}`}
                >
                  <span className="objective-ring__track" aria-hidden />
                  <span className="objective-ring__disc">
                    <Image
                      src={OBJECTIVE_ICON[o.labelKey] ?? FALLBACK_ICON}
                      alt=""
                      width={34}
                      height={34}
                      className="objective-ring__icon"
                      unoptimized
                    />
                  </span>
                </button>
                <span
                  className={`objective-ring__pct${complete ? " is-done" : ""}`}
                >
                  {pct}%
                </span>
                {o.claimable ? (
                  <span className="objective-ring__cta">{claimLabel}</span>
                ) : o.claimed ? (
                  <span className="objective-ring__claimed">{claimedLabel}</span>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="objectives-reward">
          <Image
            src={REWARD_ICON}
            alt=""
            width={72}
            height={72}
            className={`objectives-reward__chest${
              done >= total ? " objectives-reward__chest--ready" : ""
            }`}
            unoptimized
          />
          {/* Estrella al pie de la barra, como en la referencia: marca el
              premio y le da un punto de anclaje a la izquierda. */}
          <span className="objectives-reward__meter" aria-hidden>
            <span className="objectives-reward__star" />
            <span className="objectives-reward__bar">
            <span
              className="objectives-reward__fill"
              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
            />
              <span className="objectives-reward__count">
                {done}/{total}
              </span>
            </span>
          </span>
        </div>
      </div>

      {/* Revelación al centro: la recompensa se ve antes de volar al header. */}
      {center
        ? createPortal(
            <div className="objective-reward-center" aria-hidden>
              <span className="objective-reward-center__burst" />
              <Image
                src={center.src}
                alt=""
                width={160}
                height={160}
                className="objective-reward-center__art"
                unoptimized
              />
              <p className="objective-reward-center__label">{center.label}</p>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
