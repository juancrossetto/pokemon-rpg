"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CampaignPrimaryActionKind } from "@/lib/campaign";

/**
 * Banner contextual al desbloquear un hito (gimnasio listo, etc.).
 * No es modal — desaparece solo. Respeta prefers-reduced-motion vía CSS.
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

  useEffect(() => {
    const previous = prev.current;
    prev.current = action;

    if (previous === null) return;

    if (previous === "blocked" && action === "challenge_gym") {
      setBanner(
        locationName
          ? t("feedbackGymReady", { name: locationName })
          : t("feedbackGymReadyGeneric"),
      );
      return;
    }

    if (previous !== "challenge_gym" && action === "challenge_gym") {
      setBanner(
        locationName
          ? t("feedbackGymReady", { name: locationName })
          : t("feedbackGymReadyGeneric"),
      );
    }
  }, [action, locationName, t]);

  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner(null), 3600);
    return () => window.clearTimeout(id);
  }, [banner]);

  if (!banner) return null;

  return (
    <div
      role="status"
      className="game-float-card mb-3 overflow-hidden rounded-2xl px-3.5 py-2.5 ring-1 ring-electric-yellow/40 motion-safe:animate-[app-toast-in_0.35s_ease-out]"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-electric-yellow">
        {t("feedbackUnlockEyebrow")}
      </p>
      <p className="mt-0.5 text-label-md text-white">{banner}</p>
    </div>
  );
}
