"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { devSetCampaignProgress } from "@/actions/campaign";
import { KANTO_REGION, allKantoStages } from "@/lib/campaign";

export function CampaignDevPanel({ locale }: { locale: string }) {
  const t = useTranslations("campaign");
  const [pending, startTransition] = useTransition();

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <section className="mt-6 rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
        {t("dev.title")}
      </p>
      <p className="mt-1 text-label-sm text-on-surface-variant">{t("dev.hint")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-label-sm disabled:opacity-40"
          onClick={() =>
            startTransition(async () => {
              await devSetCampaignProgress({ reset: true }, locale);
            })
          }
        >
          {t("dev.reset")}
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-label-sm disabled:opacity-40"
          onClick={() =>
            startTransition(async () => {
              await devSetCampaignProgress(
                {
                  highestUnlockedLocationId: "viridian-forest",
                  selectedLocationId: "viridian-forest",
                  farmingLocationId: "viridian-forest",
                  farmingStageId: "vf-e-1",
                },
                locale,
              );
            })
          }
        >
          {t("dev.unlockForest")}
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-label-sm disabled:opacity-40"
          onClick={() =>
            startTransition(async () => {
              const last = KANTO_REGION.locations[KANTO_REGION.locations.length - 1];
              const stages = allKantoStages().filter((s) => !s.isGymMilestone);
              await devSetCampaignProgress(
                {
                  highestUnlockedLocationId: last.id,
                  selectedLocationId: last.id,
                  farmingLocationId: last.id,
                  farmingStageId: last.stages[0]?.id ?? "cerulean-1",
                  completedStageIds: stages.map((s) => s.id),
                  highestCompletedStageId: stages.at(-1)?.id ?? null,
                },
                locale,
              );
            })
          }
        >
          {t("dev.unlockAll")}
        </button>
      </div>
    </section>
  );
}
