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
 * Objetivos de ruta en mobile: pista de misiones + recompensa final.
 * **Sólo mobile** (`lg:hidden`); en desktop sigue el panel con pestañas.
 *
 * Entrenadores incompletos abren el sheet de pelea (sin ir a Campaign).
 */
export function HomeObjectivesRail({
  objectives,
  title,
  rewardTitle,
  claimLabel,
  claimedLabel,
  fightLabel,
  onClaim,
  onOpenTrainers,
}: {
  objectives: HomeObjective[];
  title: string;
  rewardTitle: string;
  claimLabel: string;
  claimedLabel: string;
  fightLabel: string;
  /** Devuelve la recompensa a mostrar en el centro, o null si falló. */
  onClaim: (
    objectiveId: string,
    origin: { x: number; y: number },
  ) => Promise<Reward | null>;
  /** Abre el sheet de entrenadores de la zona. */
  onOpenTrainers?: () => void;
}) {
  const [buzzing, setBuzzing] = useState<string | null>(null);
  const [center, setCenter] = useState<Reward | null>(null);

  if (objectives.length === 0) return null;

  const done = objectives.filter((o) => o.done || o.claimed).length;
  const total = objectives.length;
  const allDone = done >= total;
  const giftReady = allDone && objectives.some((o) => o.claimable);

  async function handleTap(objective: HomeObjective, el: HTMLElement) {
    const isTrainers = objective.id === "trainers";
    const canFight =
      isTrainers &&
      !objective.claimable &&
      !objective.claimed &&
      objective.current < objective.target &&
      Boolean(onOpenTrainers);

    if (!objective.claimable && !canFight) return;

    const rect = el.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    setBuzzing(objective.id);
    playUiSfx("badge");
    navigator.vibrate?.(18);
    window.setTimeout(() => setBuzzing(null), 420);

    if (canFight) {
      onOpenTrainers?.();
      return;
    }

    const reward = await onClaim(objective.id, origin);
    if (!reward) return;
    setCenter(reward);
    window.setTimeout(() => setCenter(null), CENTER_REVEAL_MS);
  }

  return (
    <section className="objectives-rail lg:hidden">
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
            const canFight =
              o.id === "trainers" &&
              !o.claimable &&
              !o.claimed &&
              o.current < o.target &&
              Boolean(onOpenTrainers);
            const actionable = o.claimable || canFight;
            return (
              <li key={o.id} className="objectives-rail__item">
                <button
                  type="button"
                  className={[
                    "objective-ring",
                    complete ? "objective-ring--done" : "",
                    o.claimable ? "objective-ring--ready" : "",
                    canFight ? "objective-ring--fight" : "",
                    buzzing === o.id ? "objective-ring--buzz" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ "--ring-pct": `${pct}` } as CSSProperties}
                  disabled={!actionable}
                  onClick={(e) => void handleTap(o, e.currentTarget)}
                  aria-label={`${o.labelKey} ${o.current}/${o.target}`}
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
                {o.claimable ? (
                  <span className="objective-ring__cta">{claimLabel}</span>
                ) : canFight ? (
                  <span className="objective-ring__cta">{fightLabel}</span>
                ) : o.claimed ? (
                  <span className="objective-ring__claimed">{claimedLabel}</span>
                ) : (
                  <span className="objective-ring__pct">
                    {o.current}/{o.target}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div
          className={`objectives-reward${giftReady ? " objectives-reward--ready" : ""}`}
        >
          <Image
            src={REWARD_ICON}
            alt=""
            width={72}
            height={72}
            className={`objectives-reward__chest${
              giftReady ? " objectives-reward__chest--ready" : ""
            }`}
            unoptimized
          />
          <span className="objectives-reward__meter" aria-hidden>
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
