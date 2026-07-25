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

  // `h-full`: la card vive dentro de un wrapper `lg:col-span-2`. Sin esto solo
  // respeta su `min-h` y no llena el alto de fila que fija la card de misión.
  return (
    <section className="glass-panel relative flex h-full min-h-[230px] flex-col overflow-hidden rounded-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.45)] md:min-h-[260px]">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={mapSrc}
          alt=""
          fill
          className="object-cover object-center scale-105 opacity-60"
          sizes="(max-width: 768px) 100vw, 800px"
          priority
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,rgba(56,189,248,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/92" />
        {/* El texto vive arriba a la izquierda: el mapa se oscurece de ese lado. */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* Toda la card abre el mapa grande; los controles de arriba siguen vivos. */}
      <RegionMapDialog
        locale={locale}
        regionNameKey={regionNameKey}
        mapSrc={mapSrc}
        locations={locations}
        farmingLocationId={farmingLocationId}
        farmingStageId={farmingStageId}
        triggerLabel={t("openMap")}
      />

      <div className="pointer-events-none relative flex flex-1 flex-col justify-between gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-block rounded-md border border-white/15 bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface backdrop-blur-sm">
              {t("currentRegion")}
            </span>
            <h2 className="mt-1.5 text-headline-lg tracking-tight text-white md:text-display-lg">
              {t(regionNameKey)}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-label-md text-white/90">
              <span className="material-symbols-outlined text-[16px] text-pokeball-red">
                explore
              </span>
              <span>
                {t(locationNameKey)}
                <span className="mx-1.5 text-on-surface-variant/40">•</span>
                {t(locationKindKey)}
                <span className="mx-1.5 text-on-surface-variant/40">•</span>
                {t("wildLevels", { min: levelMin, max: levelMax })}
              </span>
            </p>
            <p className="mt-0.5 text-label-sm text-on-surface-variant/70">
              {t("farmingStage")}: <span className="text-on-surface">{t(stageNameKey)}</span>
            </p>
          </div>

          <Link
            href={milestoneHref(milestone)}
            aria-label={milestone.kind === "gym" ? t("challengeGym") : t("continueExpedition")}
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-pokeball-red/80 bg-black/55 text-pokeball-red shadow-[0_0_18px_rgba(238,21,21,0.35)] transition-transform hover:scale-105"
          >
            <span className="material-symbols-outlined text-[20px]">
              {milestone.kind === "gym" ? "military_tech" : "my_location"}
            </span>
          </Link>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          {wildTypes.length > 0 && (
            <div className="min-w-0">
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

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/campaign"
              className="pointer-events-auto rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-label-sm text-on-surface backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              {t("selectLocation")}
            </Link>
            <Link
              href={milestoneHref(milestone)}
              className="pointer-events-auto rounded-lg bg-pokeball-red px-3 py-1.5 text-label-sm font-semibold text-white shadow-[0_8px_24px_rgba(238,21,21,0.28)] transition-colors hover:bg-pokeball-red/85"
            >
              {milestone.kind === "gym" ? t("challengeGym") : t("continueExpedition")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
