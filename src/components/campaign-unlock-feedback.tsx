"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CampaignPrimaryActionKind } from "@/lib/campaign";
import { playUnlockToastAppear, playUnlockToastDismiss } from "@/lib/ui-toast-sfx";

const VISIBLE_MS = 3600;
const EXIT_MS = 320;

type Phase = "in" | "out";

/**
 * Banner contextual al desbloquear un hito (gimnasio listo, etc.).
 * Rebota, desaparece solo y suena al salir. Respeta prefers-reduced-motion.
 */
export function CampaignUnlockFeedback({
  action,
  locationName,
}: {
  action: CampaignPrimaryActionKind;
  locationName?: string;
}) {
  const t = useTranslations("campaign");
  const prev = useRef<CampaignPrimaryActionKind | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("in");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const previous = prev.current;
    prev.current = action;

    if (previous === null) return;

    const readyGym =
      (previous === "blocked" && action === "challenge_gym") ||
      (previous !== "challenge_gym" && action === "challenge_gym");

    if (!readyGym) return;

    const text = locationName
      ? t("feedbackGymReady", { name: locationName })
      : t("feedbackGymReadyGeneric");

    const raf = window.requestAnimationFrame(() => {
      setBanner(text);
      setPhase("in");
      playUnlockToastAppear();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [action, locationName, t]);

  useEffect(() => {
    if (!banner) return;

    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const exitMs = reduced ? 0 : EXIT_MS;

    const exitTimer = window.setTimeout(() => {
      playUnlockToastDismiss();
      if (exitMs === 0) {
        setBanner(null);
        return;
      }
      setPhase("out");
      const hideTimer = window.setTimeout(() => setBanner(null), exitMs);
      timers.current.push(hideTimer);
    }, VISIBLE_MS);
    timers.current.push(exitTimer);

    return () => {
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    };
  }, [banner]);

  if (!banner) return null;

  return (
    <div
      role="status"
      className={`game-float-card unlock-toast mb-3 overflow-hidden rounded-2xl px-3.5 py-2.5 ring-1 ring-electric-yellow/40 ${
        phase === "out" ? "unlock-toast--out" : "unlock-toast--in"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-electric-yellow">
        {t("feedbackUnlockEyebrow")}
      </p>
      <p className="mt-0.5 text-label-md text-white">{banner}</p>
    </div>
  );
}
