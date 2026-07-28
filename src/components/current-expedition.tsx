"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { showdownTypeSymbolUrl } from "@/lib/type-icons";
import { typeColor } from "@/lib/type-colors";
import type { CampaignMilestone } from "@/lib/campaign";
import { RegionMapDialog, type MapLocation } from "@/components/region-map-dialog";
import { ExpeditionAmbient } from "@/components/home/expedition-ambient";

export type CurrentExpeditionProps = {
  locationNameKey: string;
  locationKindKey: string;
  locationKind: string;
  stageNameKey: string;
  mapSrc: string;
  milestone: CampaignMilestone;
  regionNameKey: string;
  wildTypes: string[];
  levelMin: number;
  levelMax: number;
  locale: string;
  locations: MapLocation[];
  farmingLocationId: string;
  farmingStageId: string;
  stagesDone: number;
  stagesTotal: number;
};

function milestoneHref(milestone: CampaignMilestone): string {
  if (milestone.kind === "gym") return "/gyms";
  if (milestone.kind === "complete") return "/campaign";
  return "/battle";
}

export function CurrentExpedition({
  locationNameKey,
  locationKindKey,
  locationKind,
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
  stagesDone,
  stagesTotal,
}: CurrentExpeditionProps) {
  const t = useTranslations("campaign");
  const tTypes = useTranslations("pokedex.pokemonTypes");
  const ctaHref = milestoneHref(milestone);
  const ctaLabel =
    milestone.kind === "gym" ? t("challengeGym") : t("continueExpedition");
  const stagePct =
    stagesTotal > 0 ? Math.max(0, Math.min(100, (stagesDone / stagesTotal) * 100)) : 0;

  return (
    <section className="expedition-hero relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.55)] sm:min-h-[260px] lg:min-h-[300px]">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={mapSrc}
          alt=""
          fill
          className="expedition-hero__bg object-cover object-[center_38%] scale-[1.06] opacity-60"
          sizes="(max-width: 768px) 100vw, 900px"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/20" />
        <ExpeditionAmbient kind={locationKind} />
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

      <div className="pointer-events-none relative z-[1] flex flex-1 flex-col justify-between gap-3 p-3.5 sm:gap-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pokeball-red">
              {t(regionNameKey)}
            </p>
            <h2 className="mt-0.5 truncate text-[20px] font-bold leading-tight tracking-tight text-white sm:text-[24px]">
              {t(locationNameKey)}
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-white/65 sm:text-[13px]">
              {t(stageNameKey)}
              <span className="mx-1.5 text-white/30">·</span>
              <span className="font-mono text-electric-yellow/90">
                Nv. {levelMin}–{levelMax}
              </span>
              <span className="mx-1.5 text-white/30">·</span>
              <span className="text-white/50">{t(locationKindKey)}</span>
            </p>
          </div>

          {wildTypes.length > 0 && (
            <ul
              className="pointer-events-auto flex shrink-0 flex-wrap items-center justify-end gap-1"
              aria-label={t("predictedTypes")}
            >
              {wildTypes.map((type) => {
                const color = typeColor(type);
                const label = tTypes(type.toLowerCase() as "normal");
                return (
                  <li key={type}>
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full border"
                      style={{
                        background: `radial-gradient(circle at 35% 30%, ${color}ee, ${color}88)`,
                        borderColor: `${color}aa`,
                        boxShadow: `0 0 10px ${color}33`,
                      }}
                      aria-label={label}
                      title={label}
                    >
                      <Image
                        src={showdownTypeSymbolUrl(type)}
                        alt=""
                        width={16}
                        height={16}
                        unoptimized
                        className="h-3.5 w-3.5 object-contain brightness-110"
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2.5">
          {stagesTotal > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-white/60">
                <span>{t("journeyProgress")}</span>
                <span className="font-mono tabular-nums text-white/80">
                  {stagesDone}/{stagesTotal}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={stagesDone}
                aria-valuemin={0}
                aria-valuemax={stagesTotal}
                className="h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pokeball-red to-electric-yellow transition-[width] duration-500"
                  style={{ width: `${stagePct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-stretch gap-2">
            <Link
              href={ctaHref}
              className="expedition-cta pointer-events-auto flex min-h-11 flex-1 items-center justify-center rounded-xl bg-pokeball-red px-4 text-[15px] font-bold text-white shadow-[0_10px_28px_rgba(238,21,21,0.4),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:bg-pokeball-red/90 hover:shadow-[0_12px_32px_rgba(238,21,21,0.5)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:min-h-12 sm:text-[16px]"
            >
              {ctaLabel}
            </Link>
            <Link
              href="/campaign"
              aria-label={t("journeyGuide")}
              className="pointer-events-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-black/45 px-3 text-[13px] font-medium text-on-surface backdrop-blur-sm transition hover:bg-white/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:min-h-12 sm:min-w-12"
            >
              <span className="material-symbols-outlined text-[20px]!">menu_book</span>
              <span className="hidden sm:inline">{t("journeyGuideShort")}</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
