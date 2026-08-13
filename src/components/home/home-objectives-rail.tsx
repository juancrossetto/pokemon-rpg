"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { playUiSfx } from "@/lib/battle-sfx";
import type { HomeObjective } from "@/lib/home-hub";

/** Todos los anillos usan el mismo regalo (solo mobile). */
const GIFT_ICON = "/nav/event-icon.png";

const CENTER_REVEAL_MS = 1250;
/** Tras cobrar: el regalo deja de saltar con una animación corta. */
const CLAIM_SETTLE_MS = 520;
const LONG_PRESS_MS = 420;

type Reward = { src: string; label: string };

/**
 * Objetivos de ruta en mobile: cada misión es un regalo (mismo PNG).
 * Listo → salta hasta cobrar; al cobrar → se asienta.
 * Hover / long-press → tip con el desafío.
 */
export function HomeObjectivesRail({
  objectives,
  title,
  claimLabel,
  claimedLabel,
  fightLabel,
  objectiveLabels,
  progressLabel,
  rewardCoinsLabel,
  onClaim,
  onOpenTrainers,
}: {
  objectives: HomeObjective[];
  title: string;
  claimLabel: string;
  claimedLabel: string;
  fightLabel: string;
  objectiveLabels: Record<string, string>;
  /** "{current}/{target}" — tip de progreso. */
  progressLabel?: string;
  rewardCoinsLabel?: string;
  onClaim: (
    objectiveId: string,
    origin: { x: number; y: number },
  ) => Promise<Reward | null>;
  onOpenTrainers?: () => void;
}) {
  const [buzzing, setBuzzing] = useState<string | null>(null);
  const [settling, setSettling] = useState<Set<string>>(() => new Set());
  const [center, setCenter] = useState<Reward | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  useEffect(() => {
    if (!previewId) return;
    function onDocPointer(e: Event) {
      const target = e.target as HTMLElement | null;
      if (target?.closest(`[data-obj-id="${previewId}"]`)) return;
      setPreviewId(null);
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [previewId]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    };
  }, []);

  if (objectives.length === 0) return null;

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startLongPress(id: string) {
    clearLongPress();
    longPressFired.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setPreviewId(id);
      navigator.vibrate?.(12);
    }, LONG_PRESS_MS);
  }

  async function claimOne(objective: HomeObjective, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    setBuzzing(objective.id);
    setSettling((prev) => new Set(prev).add(objective.id));
    playUiSfx("badge");
    navigator.vibrate?.(18);
    window.setTimeout(() => setBuzzing(null), 420);

    const reward = await onClaim(objective.id, origin);
    window.setTimeout(() => {
      setSettling((prev) => {
        const next = new Set(prev);
        next.delete(objective.id);
        return next;
      });
    }, CLAIM_SETTLE_MS);

    if (!reward) {
      setSettling((prev) => {
        const next = new Set(prev);
        next.delete(objective.id);
        return next;
      });
      return;
    }
    setCenter(reward);
    window.setTimeout(() => setCenter(null), CENTER_REVEAL_MS);
  }

  async function handleTap(objective: HomeObjective, el: HTMLElement) {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }

    const isTrainers = objective.id === "trainers";
    const canFight =
      isTrainers &&
      !objective.claimable &&
      !objective.claimed &&
      objective.current < objective.target &&
      Boolean(onOpenTrainers);

    if (objective.claimable) {
      setPreviewId(null);
      await claimOne(objective, el);
      return;
    }

    if (canFight) {
      setPreviewId(null);
      playUiSfx("badge");
      navigator.vibrate?.(18);
      onOpenTrainers?.();
      return;
    }

    // Incompleto: tip del desafío (mobile sin hover).
    setPreviewId((prev) => (prev === objective.id ? null : objective.id));
  }

  return (
    <section className="objectives-rail lg:hidden">
      <div className="objectives-rail__inner">
        <h2 className="objectives-rail__title">{title}</h2>

        <ul className="objectives-rail__track">
          {objectives.map((o) => {
            const pct =
              o.target > 0
                ? Math.max(0, Math.min(100, Math.round((o.current / o.target) * 100)))
                : 0;
            const complete = o.done || o.claimed;
            const isSettling = settling.has(o.id);
            const isTrainers = o.id === "trainers";
            const canFight =
              isTrainers &&
              !o.claimable &&
              !o.claimed &&
              o.current < o.target &&
              Boolean(onOpenTrainers);
            const label = objectiveLabels[o.id] ?? o.labelKey;

            return (
              <li
                key={o.id}
                data-obj-id={o.id}
                className={`objectives-rail__item${
                  previewId === o.id ? " objectives-rail__item--preview" : ""
                }`}
              >
                <button
                  type="button"
                  className={[
                    "objective-gift",
                    complete ? "objective-gift--done" : "",
                    o.claimable ? "objective-gift--ready" : "",
                    canFight ? "objective-gift--fight" : "",
                    isSettling ? "objective-gift--settle" : "",
                    buzzing === o.id ? "objective-gift--buzz" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ "--ring-pct": `${pct}` } as CSSProperties}
                  aria-label={`${label} ${o.current}/${o.target}`}
                  aria-describedby={`obj-tip-${o.id}`}
                  onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => {
                    if (e.pointerType === "touch") startLongPress(o.id);
                  }}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onClick={(e) => void handleTap(o, e.currentTarget)}
                >
                  <span className="objective-gift__track" aria-hidden />
                  <span className="objective-gift__disc">
                    <Image
                      src={GIFT_ICON}
                      alt=""
                      width={40}
                      height={40}
                      className="objective-gift__icon"
                      unoptimized
                    />
                  </span>
                </button>

                {o.claimable ? (
                  <span className="objective-gift__cta">{claimLabel}</span>
                ) : canFight ? (
                  <span className="objective-gift__cta">{fightLabel}</span>
                ) : o.claimed || complete ? (
                  <span className="objective-gift__claimed">{claimedLabel}</span>
                ) : (
                  <span className="objective-gift__pct">
                    {o.current}/{o.target}
                  </span>
                )}

                <div id={`obj-tip-${o.id}`} className="objective-tip" role="tooltip">
                  <p className="objective-tip__title">{label}</p>
                  <p className="objective-tip__meta">
                    {progressLabel
                      ? progressLabel
                          .replace("{current}", String(o.current))
                          .replace("{target}", String(o.target))
                      : `${o.current}/${o.target}`}
                    {o.claimable
                      ? ` · ${claimLabel}`
                      : canFight
                        ? ` · ${fightLabel}`
                        : complete
                          ? ` · ${claimedLabel}`
                          : null}
                  </p>
                  {(o.rewardCoins > 0 || o.rewardItems.length > 0) && (
                    <p className="objective-tip__reward">
                      {o.rewardCoins > 0
                        ? `${rewardCoinsLabel ?? "Coins"} +${o.rewardCoins}`
                        : null}
                      {o.rewardCoins > 0 && o.rewardItems.length > 0
                        ? " · "
                        : null}
                      {o.rewardItems
                        .map((reward) => `${reward.itemName} ×${reward.quantity}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
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
