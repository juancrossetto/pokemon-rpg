"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import type { CampaignMilestone } from "@/lib/campaign";
import { RegionMapDialog, type MapLocation } from "@/components/region-map-dialog";

export type CurrentExpeditionProps = {
  locationNameKey: string;
  locationKindKey: string;
  stageNameKey: string;
  mapSrc: string;
  milestone: CampaignMilestone;
  regionNameKey: string;
  wildTypes: string[];
  levelMin: number;
  levelMax: number;
  /** Datos del selector de zona a pantalla completa. */
  locale: string;
  locations: MapLocation[];
  farmingLocationId: string;
  farmingStageId: string;
};

function milestoneHref(milestone: CampaignMilestone): string {
  if (milestone.kind === "gym") return "/gyms";
  if (milestone.kind === "complete") return "/campaign";
  return "/battle";
}

export function CurrentExpedition({
  locationNameKey,
  locationKindKey,
  stageNameKey,
  mapSrc,
  milestone,
  regionNameKey,
  wildTypes,
  levelMin,
  levelMax,
  locale,
  locations,
  farmingLocationId,
  farmingStageId,
}: CurrentExpeditionProps) {
  const t = useTranslations("campaign");

  return (
    <section className="glass-panel relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.45)] md:min-h-[280px]">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={mapSrc}
          alt=""
          fill
          className="object-cover object-center scale-105 opacity-55"
          sizes="(max-width: 768px) 100vw, 800px"
          priority
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_35%,rgba(56,189,248,0.16),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/40 to-black/92" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/45 to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <RegionMapDialog
        locale={locale}
        regionNameKey={regionNameKey}
        mapSrc={mapSrc}
        locations={locations}
        farmingLocationId={farmingLocationId}
        farmingStageId={farmingStageId}
        triggerLabel={t("openMap")}
      />

      {/* Misma lógica de apilado que ActiveMission: header → cuerpo → footer sticky */}
      <div className="pointer-events-none relative z-[1] flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]! text-pokeball-red">
                public
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {t("currentRegion")}
              </p>
            </div>
            <h2 className="mt-1 truncate text-headline-md tracking-tight text-white sm:text-headline-lg md:text-display-lg">
              {t(regionNameKey)}
            </h2>
          </div>

          <Link
            href={milestoneHref(milestone)}
            aria-label={milestone.kind === "gym" ? t("challengeGym") : t("continueExpedition")}
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-pokeball-red/80 bg-black/55 text-pokeball-red shadow-[0_0_18px_rgba(238,21,21,0.35)] transition-transform hover:scale-105"
          >
            <span className="material-symbols-outlined text-[20px]!">
              {milestone.kind === "gym" ? "military_tech" : "my_location"}
            </span>
          </Link>
        </div>

        <div className="mt-3 space-y-2">
          <p className="flex items-start gap-1.5 text-label-md leading-snug text-white/90">
            <span className="material-symbols-outlined mt-0.5 shrink-0 text-[16px]! text-pokeball-red">
              explore
            </span>
            <span className="min-w-0">
              <span className="font-semibold text-white">{t(locationNameKey)}</span>
              <span className="mx-1.5 text-white/30">·</span>
              <span className="text-on-surface-variant">{t(locationKindKey)}</span>
            </span>
          </p>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-label-sm text-on-surface-variant">
            <span>
              {t("farmingStage")}:{" "}
              <span className="text-on-surface">{t(stageNameKey)}</span>
            </span>
            <span className="font-mono text-electric-yellow/90">
              {t("wildLevels", { min: levelMin, max: levelMax })}
            </span>
          </div>

          {wildTypes.length > 0 && (
            <div className="pt-0.5">
              <div className="flex flex-wrap gap-1.5">
                {wildTypes.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-label-sm capitalize text-white"
                    style={{
                      borderColor: `${typeColor(type)}66`,
                      backgroundColor: `${typeColor(type)}28`,
                      boxShadow: `0 0 12px ${typeColor(type)}22`,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: typeColor(type) }}
                    />
                    {type}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-on-surface-variant/80">
                {t("predictedTypes")}
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/campaign"
            className="pointer-events-auto flex flex-1 items-center justify-center rounded-lg border border-white/15 bg-black/45 px-4 py-2 text-label-sm text-on-surface backdrop-blur-sm transition-colors hover:bg-white/10 sm:flex-none"
          >
            {t("selectLocation")}
          </Link>
          <Link
            href={milestoneHref(milestone)}
            className="pointer-events-auto flex flex-1 items-center justify-center rounded-lg bg-pokeball-red px-4 py-2 text-label-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,21,21,0.28)] transition-colors hover:bg-pokeball-red/85 sm:flex-none"
          >
            {milestone.kind === "gym" ? t("challengeGym") : t("continueExpedition")}
          </Link>
        </div>
      </div>
    </section>
  );
}
