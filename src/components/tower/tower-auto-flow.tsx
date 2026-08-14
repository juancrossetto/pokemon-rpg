"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import {
  applyTowerRest,
  challengeTowerFloor,
  chooseTowerBlessing,
} from "@/actions/tower";
import { setBattleAuto } from "@/lib/battle-auto";
import { playUiSfx } from "@/lib/battle-sfx";
import { GameCtaButton } from "@/components/game-cta-button";
import type { TowerBlessing } from "@/lib/tower";
import {
  getServerTowerAuto,
  getTowerAuto,
  pickTowerAutoBlessing,
  pickTowerAutoRest,
  setTowerAuto,
  subscribeTowerAuto,
} from "@/lib/tower-auto";

// Da tiempo a que el riel entre en pantalla y la línea complete el tramo.
// Scroll + línea flúor + impacto del nodo. Recién después aparece 3·2·1.
const FLOOR_TRANSITION_MS = 5000;
const AUTO_DECISION_DELAY_MS = 650;

function TowerAutoCountdownOverlay({
  count,
  onCancel,
  label,
}: {
  count: number;
  onCancel: () => void;
  label: string;
}) {
  const t = useTranslations("tower");

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="flex flex-col items-center text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.26em] text-secondary">
          {label}
        </p>
        <p
          key={count}
          className="tower-auto-countdown-number page-title mt-2 text-[7rem] leading-none text-white drop-shadow-[0_0_30px_color-mix(in_srgb,var(--theme-primary)_75%,transparent)] sm:text-[9rem]"
        >
          {count}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-5 rounded-xl border border-white/25 bg-white/8 px-5 py-2.5 text-[12px] font-bold text-white transition hover:border-white/45 hover:bg-white/12"
        >
          {t("auto.cancelStart")}
        </button>
      </div>
    </div>
  );
}

export function TowerAutoFlow({
  runId,
  status,
  currentFloor,
  locale,
  offeredBlessings,
  teamHpPct,
  canAttune,
}: {
  /** Null también cubre un ascenso pausado: AUTO nunca lo reanuda solo. */
  runId: string | null;
  status: string | null;
  currentFloor: number;
  locale: string;
  offeredBlessings: TowerBlessing[];
  teamHpPct: number;
  canAttune: boolean;
}) {
  const t = useTranslations("tower");
  const enabled = useSyncExternalStore(
    subscribeTowerAuto,
    getTowerAuto,
    getServerTowerAuto,
  );
  const [entryCountdown, setEntryCountdown] = useState<number | null>(null);
  const [, start] = useTransition();
  const floorBaselineRef = useRef<{ runId: string; floor: number | null } | null>(null);

  useEffect(() => {
    if (
      !runId ||
      (status !== "ACTIVE" && status !== "AWAITING_BLESSING" && status !== "RESTING")
    ) {
      return;
    }

    const seenKey = `tower-auto-seen-floor:${runId}`;
    if (!floorBaselineRef.current || floorBaselineRef.current.runId !== runId) {
      let storedFloor: number | null = null;
      try {
        const raw = window.sessionStorage.getItem(seenKey);
        storedFloor = raw == null ? null : Number(raw);
      } catch {
        // Sin sessionStorage se omite el recuerdo, pero AUTO sigue funcionando.
      }
      floorBaselineRef.current = { runId, floor: storedFloor };
    }
    const previousFloor = floorBaselineRef.current.floor;

    const climbed =
      previousFloor != null &&
      Number.isFinite(previousFloor) &&
      currentFloor > previousFloor;
    const markFloorSeen = () => {
      floorBaselineRef.current = { runId, floor: currentFloor };
      try {
        window.sessionStorage.setItem(seenKey, String(currentFloor));
      } catch {
        // private mode / quota
      }
    };

    // En manual sólo recordamos el piso. La animación del riel tiene su propio
    // controlador y continúa aunque AUTO se cancele.
    if (!getTowerAuto()) {
      markFloorSeen();
      return;
    }

    const blessing =
      status === "AWAITING_BLESSING"
        ? pickTowerAutoBlessing(offeredBlessings, teamHpPct)
        : null;
    const actionKey = `${runId}:${currentFloor}:${status}:${blessing?.id ?? "next"}`;
    try {
      if (window.sessionStorage.getItem(`tower-auto-action:${actionKey}`) === "1") return;
    } catch {
      // El cleanup del efecto impide dos timers durante este montaje.
    }

    const delay = climbed ? FLOOR_TRANSITION_MS : AUTO_DECISION_DELAY_MS;
    let countdownTimer: number | null = null;

    const dispatchAction = () => {
      try {
        window.sessionStorage.setItem(`tower-auto-action:${actionKey}`, "1");
      } catch {
        // private mode / quota
      }

      start(async () => {
        if (status === "ACTIVE") {
          await challengeTowerFloor(locale);
          return;
        }
        if (status === "RESTING") {
          await applyTowerRest(locale, pickTowerAutoRest(teamHpPct, canAttune));
          return;
        }
        if (blessing) {
          await chooseTowerBlessing(blessing.id, locale);
        }
      });
    };

    const timer = window.setTimeout(() => {
      markFloorSeen();
      if (!climbed) {
        dispatchAction();
        return;
      }

      let count = 3;
      setEntryCountdown(count);
      playUiSfx("timerTick");
      countdownTimer = window.setInterval(() => {
        count -= 1;
        if (count > 0) {
          setEntryCountdown(count);
          playUiSfx("timerTick");
          return;
        }
        if (countdownTimer != null) window.clearInterval(countdownTimer);
        countdownTimer = null;
        setEntryCountdown(null);
        playUiSfx("levelUp");
        dispatchAction();
      }, 1000);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      if (countdownTimer != null) window.clearInterval(countdownTimer);
    };
  }, [canAttune, currentFloor, enabled, locale, offeredBlessings, runId, status, teamHpPct]);

  if (entryCountdown == null) return null;
  return (
    <TowerAutoCountdownOverlay
      count={entryCountdown}
      label={t("auto.nextFloorIn")}
      onCancel={() => {
        setTowerAuto(false);
        setEntryCountdown(null);
      }}
    />
  );
}

/** Control visual separado del flujo: puede vivir junto al CTA principal sin
 * desmontar la automatización durante bendiciones y descansos. */
export function TowerAutoControl() {
  const t = useTranslations("tower");
  const enabled = useSyncExternalStore(
    subscribeTowerAuto,
    getTowerAuto,
    getServerTowerAuto,
  );
  const [arming, setArming] = useState<number | null>(null);
  const armingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (armingTimerRef.current != null) {
        window.clearInterval(armingTimerRef.current);
      }
    };
  }, []);

  const cancelArming = () => {
    if (armingTimerRef.current != null) {
      window.clearInterval(armingTimerRef.current);
      armingTimerRef.current = null;
    }
    setArming(null);
  };

  const toggle = () => {
    if (arming != null) {
      cancelArming();
      return;
    }
    if (getTowerAuto()) {
      setTowerAuto(false);
      return;
    }

    let count = 3;
    setArming(count);
    playUiSfx("timerTick");
    armingTimerRef.current = window.setInterval(() => {
      count -= 1;
      if (count > 0) {
        setArming(count);
        playUiSfx("timerTick");
        return;
      }

      if (armingTimerRef.current != null) {
        window.clearInterval(armingTimerRef.current);
        armingTimerRef.current = null;
      }
      setArming(null);
      setBattleAuto(true);
      setTowerAuto(true);
      playUiSfx("levelUp");
    }, 1000);
  };

  return (
    <div className="w-[7.25rem] shrink-0 sm:w-[8rem]">
      <GameCtaButton
        type="button"
        variant="red"
        role="switch"
        aria-checked={enabled}
        aria-label={t("auto.label")}
        title={enabled ? t("auto.hintOn") : t("auto.hintOff")}
        onClick={toggle}
        className={`px-2! text-[0.78rem]! sm:px-3! sm:text-[0.86rem]! ${
          enabled
            ? "ring-1 ring-white/35"
            : arming != null
              ? "ring-2 ring-white/70"
              : "brightness-[0.82]"
        }`}
      >
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {t("auto.shortLabel")}
          <span
            className={`rounded px-1 py-0.5 text-[8px] leading-none ${
              enabled ? "bg-white/22 text-white" : "bg-black/20 text-white/65"
            }`}
          >
            {arming ?? (enabled ? t("auto.on") : t("auto.off"))}
          </span>
        </span>
      </GameCtaButton>
      {arming != null ? (
        <TowerAutoCountdownOverlay
          count={arming}
          label={t("auto.starting")}
          onCancel={cancelArming}
        />
      ) : null}
    </div>
  );
}
