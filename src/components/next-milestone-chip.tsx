"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { CampaignMilestone } from "@/lib/campaign/types";
import { milestoneCtaKey, milestoneHref } from "@/lib/journey-ux";

/**
 * Chip unificado del próximo hito — home, viaje y lobbies pueden compartir
 * la misma lectura de "qué falta".
 */
export function NextMilestoneChip({
  milestone,
  className = "",
  withCta = false,
}: {
  milestone: CampaignMilestone;
  className?: string;
  withCta?: boolean;
}) {
  const t = useTranslations("campaign");
  const href = milestoneHref(milestone);
  const ctaKey = milestoneCtaKey(milestone);
  const tone =
    milestone.kind === "gym"
      ? "border-electric-yellow/40 bg-electric-yellow/10 text-electric-yellow"
      : milestone.kind === "complete"
        ? "border-tertiary/40 bg-tertiary/10 text-tertiary"
        : "border-pokeball-red/40 bg-pokeball-red/10 text-pokeball-red";

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-label-sm ${tone} ${className}`}
    >
      <span className="material-symbols-outlined text-[16px]! shrink-0">
        {milestone.kind === "gym" ? "military_tech" : milestone.kind === "complete" ? "emoji_events" : "explore"}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t("nextMilestone")}</p>
        <p className="font-semibold leading-tight text-white">{t(milestone.nameKey)}</p>
      </div>
      {withCta && (
        <Link
          href={href}
          className="ml-auto shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-white/20"
        >
          {t(ctaKey)}
        </Link>
      )}
    </div>
  );
}
