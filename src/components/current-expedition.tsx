"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { showdownTypeBadgeUrl } from "@/lib/type-icons";
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
  const ctaHref = milestoneHref(milestone);
  const ctaLabel =
    milestone.kind === "gym" ? t("challengeGym") : t("continueExpedition");

  return (
    <section className="glass-panel relative flex min-h-[168px] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.45)] sm:min-h-[220px] md:min-h-[260px]">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={mapSrc}
          alt=""
          fill
          className="object-cover object-[center_40%] scale-105 opacity-50 sm:opacity-55"
          sizes="(max-width: 768px) 100vw, 800px"
          priority
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(56,189,248,0.14),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/35 sm:bg-gradient-to-b sm:from-black/70 sm:via-black/35 sm:to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
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

      <div className="pointer-events-none relative z-[1] flex flex-1 flex-col justify-between gap-3 p-3.5 sm:p-5">
        {/* Fila superior: región + acceso rápido */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-pokeball-red/90">
              {t("currentRegion")}
            </p>
            <h2 className="mt-0.5 truncate text-[22px] font-bold leading-none tracking-tight text-white sm:text-headline-lg md:text-display-lg">
              {t(regionNameKey)}
            </h2>
          </div>
          <Link
            href={ctaHref}
            aria-label={ctaLabel}
            className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pokeball-red/70 bg-black/50 text-pokeball-red shadow-[0_0_14px_rgba(238,21,21,0.3)] transition-transform hover:scale-105 sm:h-10 sm:w-10"
          >
            <span className="material-symbols-outlined text-[18px]! sm:text-[20px]!">
              {milestone.kind === "gym" ? "military_tech" : "my_location"}
            </span>
          </Link>
        </div>

        {/* Cuerpo compacto */}
        <div className="space-y-2.5">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight text-white">
              {t(locationNameKey)}
              <span className="mx-1.5 font-normal text-white/30">·</span>
              <span className="font-normal text-white/55">{t(locationKindKey)}</span>
            </p>
            <p className="mt-0.5 truncate text-[12px] text-white/45">
              {t(stageNameKey)}
              <span className="mx-1.5 text-white/25">·</span>
              <span className="font-mono text-electric-yellow/85">
                Lv. {levelMin}–{levelMax}
              </span>
            </p>
          </div>

          {wildTypes.length > 0 && (
            <ul className="flex flex-wrap items-center gap-1.5" aria-label={t("predictedTypes")}>
              {wildTypes.map((type) => (
                <li key={type} title={type} className="relative h-[18px] w-[56px] sm:h-5 sm:w-16">
                  <Image
                    src={showdownTypeBadgeUrl(type)}
                    alt={type}
                    fill
                    unoptimized
                    className="object-contain object-left drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)]"
                    sizes="64px"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Acciones: en mobile 1 CTA primario + hint de mapa; desktop mantiene ambos */}
        <div className="flex items-center gap-2 pt-0.5">
          <Link
            href={ctaHref}
            className="pointer-events-auto flex flex-1 items-center justify-center rounded-xl bg-pokeball-red px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_22px_rgba(238,21,21,0.28)] transition-colors hover:bg-pokeball-red/85 sm:flex-none sm:py-2 sm:text-label-sm"
          >
            {ctaLabel}
          </Link>
          <Link
            href="/campaign"
            className="pointer-events-auto hidden items-center justify-center rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-label-sm text-on-surface backdrop-blur-sm transition-colors hover:bg-white/10 sm:inline-flex"
          >
            {t("selectLocation")}
          </Link>
          <p className="pointer-events-none hidden text-[10px] uppercase tracking-[0.14em] text-white/35 sm:block sm:ml-1">
            {t("tapMapHint")}
          </p>
        </div>
      </div>
    </section>
  );
}
