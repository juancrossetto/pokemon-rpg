"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { showdownTypeSymbolUrl } from "@/lib/type-icons";
import { typeColor } from "@/lib/type-colors";
import type { CampaignMilestone } from "@/lib/campaign";
import { RegionMapDialog, type MapLocation } from "@/components/region-map-dialog";
import { ExpeditionAmbient } from "@/components/home/expedition-ambient";
import { GameCtaButton } from "@/components/game-cta-button";
import { milestoneCtaKey, milestoneHref } from "@/lib/journey-ux";

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
  /** `rail` = card angosta de la columna izquierda del home. */
  variant?: "hero" | "rail";
  /** Ruta directa al gimnasio del hito, cuando `/gyms` no lo lista (Alto Mando). */
  gymHref?: string | null;
};

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
  variant = "hero",
  gymHref,
}: CurrentExpeditionProps) {
  const t = useTranslations("campaign");
  const tTypes = useTranslations("pokedex.pokemonTypes");
  const ctaHref = milestoneHref(milestone, { gymHref });
  const ctaLabel = t(milestoneCtaKey(milestone));
  const stagePct =
    stagesTotal > 0 ? Math.max(0, Math.min(100, (stagesDone / stagesTotal) * 100)) : 0;

  if (variant === "rail") {
    return (
      <section className="expedition-rail relative flex min-h-[12.25rem] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src={mapSrc}
            alt=""
            fill
            className="object-cover object-[center_40%] scale-[1.08] opacity-55"
            sizes="280px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
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

        <div className="pointer-events-none relative z-[1] flex flex-1 flex-col justify-between gap-2 p-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-pokeball-red">
              {t(regionNameKey)}
            </p>
            <h2 className="mt-0.5 truncate text-[16px] font-bold leading-tight tracking-tight text-white">
              {t(locationNameKey)}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-white/65">
              {t(stageNameKey)}
              <span className="mx-1 text-white/30">·</span>
              <span className="font-mono text-electric-yellow/90">
                Nv. {levelMin}–{levelMax}
              </span>
            </p>
            {wildTypes.length > 0 ? (
              <ul className="pointer-events-auto mt-1.5 flex flex-wrap gap-1" aria-label={t("predictedTypes")}>
                {wildTypes.slice(0, 4).map((type) => {
                  const color = typeColor(type);
                  return (
                    <li key={type}>
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full border"
                        style={{
                          background: `radial-gradient(circle at 35% 30%, ${color}ee, ${color}88)`,
                          borderColor: `${color}aa`,
                        }}
                        title={tTypes(type.toLowerCase() as "normal")}
                      >
                        <Image
                          src={showdownTypeSymbolUrl(type)}
                          alt=""
                          width={12}
                          height={12}
                          unoptimized
                          className="h-2.5 w-2.5 object-contain brightness-110"
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {/*
            Sin pointer-events-auto el CTA hereda el none del panel y el click
            cae en el trigger inset-0 del mapa (cursor lupa).
          */}
          <div className="pointer-events-auto space-y-2">
            {stagesTotal > 0 ? (
              <div>
                <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-white/60">
                  <span>{t("journeyProgress")}</span>
                  <span className="font-mono tabular-nums text-white/80">
                    {stagesDone}/{stagesTotal}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pokeball-red to-electric-yellow"
                    style={{ width: `${stagePct}%` }}
                  />
                </div>
              </div>
            ) : null}

            <GameCtaButton
              href={ctaHref}
              variant="red"
              className="expedition-cta relative z-[2] min-h-9 w-full text-[11px]!"
            >
              {ctaLabel}
            </GameCtaButton>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="expedition-hero relative flex min-h-[9.5rem] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.55)] sm:min-h-[240px] lg:min-h-[300px]">
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

      <div className="pointer-events-none relative z-[1] flex flex-1 flex-col justify-between gap-2 p-2.5 sm:gap-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-pokeball-red sm:text-[11px] sm:tracking-[0.18em]">
              {t(regionNameKey)}
            </p>
            <h2 className="page-title mt-0.5 truncate text-[18px] leading-none tracking-tight text-white sm:text-[24px]">
              {t(locationNameKey)}
            </h2>
            <p className="truncate text-[11px] leading-snug text-white/65 sm:mt-0.5 sm:text-[13px]">
              <span className="font-mono text-secondary">
                Nv. {levelMin}–{levelMax}
              </span>
              <span className="mx-1 hidden text-white/30 sm:mx-1.5 sm:inline">·</span>
              <span className="hidden sm:inline">{t(stageNameKey)}</span>
              <span className="mx-1 hidden text-white/30 sm:mx-1.5 sm:inline">·</span>
              <span className="hidden text-white/50 sm:inline">{t(locationKindKey)}</span>
            </p>
          </div>

          {wildTypes.length > 0 && (
            <ul
              className="pointer-events-auto flex shrink-0 flex-wrap items-center justify-end gap-0.5 sm:gap-1"
              aria-label={t("predictedTypes")}
            >
              {wildTypes.slice(0, 3).map((type) => {
                const color = typeColor(type);
                const label = tTypes(type.toLowerCase() as "normal");
                return (
                  <li key={type}>
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full border sm:h-8 sm:w-8"
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
                        className="h-2.5 w-2.5 object-contain brightness-110 sm:h-3.5 sm:w-3.5"
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-1.5 sm:space-y-2.5">
          {stagesTotal > 0 && (
            <div>
              <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] text-white/55 sm:mb-1 sm:text-[11px] sm:text-white/60">
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
                className="h-1.5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10 sm:h-2"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pokeball-red to-electric-yellow transition-[width] duration-500"
                  style={{ width: `${stagePct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="pointer-events-auto min-w-0 flex-1">
              <GameCtaButton
                href={ctaHref}
                variant="red"
                className="expedition-cta w-full min-h-11! px-3! py-2! text-[13px]! sm:min-h-12! sm:px-[1.1rem]! sm:py-[0.55rem]! sm:text-[13px]!"
              >
                {ctaLabel}
              </GameCtaButton>
            </div>
            <Link
              href="/campaign"
              aria-label={t("journeyGuide")}
              title={t("journeyGuide")}
              className="pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center transition hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 sm:h-12 sm:w-12"
            >
              <Image
                src="/nav/location-icon.png?v=2"
                alt=""
                width={44}
                height={44}
                className="h-9 w-9 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] sm:h-10 sm:w-10"
                unoptimized
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
