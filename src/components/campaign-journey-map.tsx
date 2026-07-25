"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { selectLocation, setFarmingStage } from "@/actions/campaign";
import {
  isStageUnlocked,
  type CampaignLocation,
  type CampaignLocationKind,
  type CampaignProgressRow,
} from "@/lib/campaign";

type LocationRow = {
  location: CampaignLocation;
  unlocked: boolean;
  completedStages: number;
  totalStages: number;
};

/** Ícono e identidad visual por tipo de zona. */
const KIND_STYLE: Record<
  CampaignLocationKind,
  { icon: string; ring: string; text: string }
> = {
  town: { icon: "location_city", ring: "border-sky-400/40 bg-sky-400/10", text: "text-sky-300" },
  route: { icon: "signpost", ring: "border-emerald-400/40 bg-emerald-400/10", text: "text-emerald-300" },
  forest: { icon: "forest", ring: "border-lime-400/40 bg-lime-400/10", text: "text-lime-300" },
  dungeon: { icon: "landscape", ring: "border-purple-400/40 bg-purple-400/10", text: "text-purple-300" },
  gym: { icon: "military_tech", ring: "border-tertiary/50 bg-tertiary/10", text: "text-tertiary" },
};

export function CampaignJourneyMap({
  locale,
  progress,
  rows,
  farmingStageId,
}: {
  locale: string;
  progress: CampaignProgressRow;
  rows: LocationRow[];
  farmingStageId: string;
}) {
  const t = useTranslations("campaign");
  const [pending, startTransition] = useTransition();

  return (
    <ol className="relative flex flex-col gap-3">
      {/* Hilo del viaje: une los nodos de todas las zonas. */}
      <span
        aria-hidden
        className="absolute left-[19px] top-6 bottom-6 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent"
      />

      {rows.map(({ location, unlocked, completedStages, totalStages }) => {
        const isSelected = progress.selectedLocationId === location.id;
        const isFarming = progress.farmingLocationId === location.id;
        const style = KIND_STYLE[location.kind];
        const done = totalStages > 0 && completedStages >= totalStages;
        const pct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

        return (
          <li key={location.id} className="relative flex gap-3">
            {/* Nodo del hilo */}
            <span
              className={`relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 backdrop-blur-sm ${
                !unlocked
                  ? "border-white/15 bg-surface-container text-on-surface-variant/50"
                  : isFarming
                    ? "border-pokeball-red bg-pokeball-red/15 text-pokeball-red shadow-[0_0_18px_rgba(238,21,21,0.4)]"
                    : `${style.ring} ${style.text}`
              }`}
            >
              <span className="material-symbols-outlined text-[20px]!">
                {unlocked ? style.icon : "lock"}
              </span>
              {done && unlocked && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-tertiary text-surface">
                  <span className="material-symbols-outlined text-[11px]! leading-none">check</span>
                </span>
              )}
            </span>

            <article
              className={`glass-panel min-w-0 flex-1 rounded-xl border p-3.5 transition-colors ${
                unlocked ? "border-white/10" : "border-white/5 opacity-60"
              } ${isSelected ? "ring-1 ring-sky-400/40" : ""} ${
                isFarming ? "border-pokeball-red/30" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-headline-md text-white">{t(location.nameKey)}</h2>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.ring} ${style.text}`}
                    >
                      {t(`kinds.${location.kind}`)}
                    </span>
                    {isFarming && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-pokeball-red/40 bg-pokeball-red/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pokeball-red">
                        <span className="material-symbols-outlined text-[12px]!">my_location</span>
                        {t("farming")}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label-sm text-on-surface-variant">
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]!">flag</span>
                      {t("stageProgress", { done: completedStages, total: totalStages })}
                    </span>
                    <span className="text-on-surface-variant/40">•</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]!">pets</span>
                      {t("wildLevels", {
                        min: Math.min(...location.stages.map((s) => s.levelMin)),
                        max: Math.max(...location.stages.map((s) => s.levelMax)),
                      })}
                    </span>
                  </p>
                </div>

                {unlocked && (
                  <button
                    type="button"
                    disabled={pending || isSelected}
                    onClick={() =>
                      startTransition(async () => {
                        await selectLocation(location.id, locale);
                      })
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-label-sm text-on-surface transition-colors hover:bg-white/10 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[16px]!">
                      {isSelected ? "check" : "my_location"}
                    </span>
                    {isSelected ? t("selected") : t("select")}
                  </button>
                )}
              </div>

              {unlocked && totalStages > 0 && (
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${done ? "bg-tertiary" : "bg-pokeball-red"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {unlocked && location.sectors && location.sectors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {location.sectors.map((sector) => (
                    <span
                      key={sector.id}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[10px] uppercase tracking-wide text-on-surface-variant"
                    >
                      <span className="material-symbols-outlined text-[12px]!">layers</span>
                      {t(sector.nameKey)}
                    </span>
                  ))}
                </div>
              )}

              {unlocked && (
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {location.stages.map((stage) => {
                    const unlockedStage = isStageUnlocked(stage, progress);
                    const stageDone = progress.completedStageIds.includes(stage.id);
                    const active = farmingStageId === stage.id;
                    const gym = !!stage.isGymMilestone;

                    return (
                      <li key={stage.id}>
                        <button
                          type="button"
                          disabled={pending || !unlockedStage || gym}
                          onClick={() =>
                            startTransition(async () => {
                              await setFarmingStage(stage.id, locale);
                            })
                          }
                          className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-label-sm transition-colors ${
                            active
                              ? "border-pokeball-red/40 bg-pokeball-red/10 text-white"
                              : gym
                                ? "border-tertiary/30 bg-tertiary/[0.06] text-tertiary"
                                : unlockedStage
                                  ? "border-white/10 bg-black/20 text-on-surface hover:bg-white/5"
                                  : "border-white/5 bg-black/10 text-on-surface-variant/50"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]! shrink-0">
                            {gym
                              ? "military_tech"
                              : !unlockedStage
                                ? "lock"
                                : stageDone
                                  ? "task_alt"
                                  : active
                                    ? "my_location"
                                    : "radio_button_unchecked"}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{t(stage.nameKey)}</span>
                          {gym && (
                            <span className="shrink-0 text-[10px] uppercase">
                              {t("gymMilestone")}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
