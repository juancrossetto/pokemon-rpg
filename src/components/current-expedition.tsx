"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TypeSymbol } from "@/components/type-symbol";
import { typeColor } from "@/lib/type-colors";
import type { CampaignMilestone } from "@/lib/campaign";
import type { AdventureGuideStep } from "@/lib/adventure-guide";
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
  /** El hito es un nodo del Alto Mando: cambia el texto del CTA, no el destino. */
  eliteMilestone?: boolean;
  /** Checklist paso a paso de la aventura. */
  guideSteps?: AdventureGuideStep[];
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
  eliteMilestone = false,
  guideSteps = [],
}: CurrentExpeditionProps) {
  const t = useTranslations("campaign");
  const tTypes = useTranslations("pokedex.pokemonTypes");
  const ctaHref =
    guideSteps.find((s) => s.status === "current")?.href ??
    milestoneHref(milestone, { gymHref });
  const currentGuide = guideSteps.find((s) => s.status === "current");
  /*
    El paso `challenge_gym` de la guía cubre también a los nodos del Alto Mando
    —en el modelo de campaña son gimnasios—, así que su copy genérico decía
    "Desafiar gimnasio" con Agatha del otro lado. El destino siempre estuvo
    bien; lo que faltaba era nombrar el tramo final por lo que es.
  */
  const ctaLabel =
    currentGuide && !(eliteMilestone && currentGuide.id === "challenge_gym")
      ? t(`guide.cta.${currentGuide.id}`)
      : t(milestoneCtaKey(milestone, { elite: eliteMilestone }));
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
                        <TypeSymbol type={type} size={12} className="h-2.5 w-2.5" />
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
              className="expedition-cta home-rail-cta relative z-[2] min-h-9 w-full text-[11px]!"
            >
              {ctaLabel}
            </GameCtaButton>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="expedition-hero relative flex min-h-[12.5rem] flex-col overflow-hidden rounded-[1.25rem] border border-white/12 shadow-[0_16px_48px_rgba(0,0,0,0.55)] sm:min-h-[240px] lg:min-h-[300px]">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={mapSrc}
          alt=""
          fill
          className="expedition-hero__bg object-cover object-[center_38%] scale-[1.06] opacity-70"
          sizes="(max-width: 768px) 100vw, 900px"
          priority
        />
        {/* Stage: mapa arriba, HUD abajo — menos velo plano, más profundidad. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/95 via-black/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-transparent" />
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

      <div className="pointer-events-none relative z-[1] flex flex-1 flex-col justify-between gap-3 p-3 sm:gap-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-pokeball-red sm:text-[11px] sm:tracking-[0.18em]">
              {t(regionNameKey)}
            </p>
            <h2 className="page-title mt-0.5 truncate text-[20px] leading-none tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] sm:text-[24px]">
              {t(locationNameKey)}
            </h2>
            <p className="mt-1 truncate text-[11px] leading-snug text-white/70 sm:text-[13px]">
              <span className="font-mono text-secondary">
                Nv. {levelMin}–{levelMax}
              </span>
              <span className="mx-1.5 text-white/30">·</span>
              <span className="text-white/55">{t(stageNameKey)}</span>
              <span className="mx-1.5 hidden text-white/30 sm:inline">·</span>
              <span className="hidden text-white/45 sm:inline">{t(locationKindKey)}</span>
            </p>
          </div>

          {wildTypes.length > 0 && (
            <ul
              className="pointer-events-auto flex shrink-0 flex-wrap items-center justify-end gap-1"
              aria-label={t("predictedTypes")}
            >
              {wildTypes.slice(0, 3).map((type) => {
                const color = typeColor(type);
                const label = tTypes(type.toLowerCase() as "normal");
                return (
                  <li key={type}>
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full border shadow-[0_4px_12px_rgba(0,0,0,0.35)] sm:h-8 sm:w-8"
                      style={{
                        background: `radial-gradient(circle at 35% 30%, ${color}ee, ${color}88)`,
                        borderColor: `${color}aa`,
                        boxShadow: `0 0 10px ${color}33`,
                      }}
                      aria-label={label}
                      title={label}
                    >
                      <TypeSymbol type={type} size={16} className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2.5 sm:space-y-2.5">
          {guideSteps.length > 0 ? (
            <ol className="expedition-guide pointer-events-auto flex flex-col gap-0.5">
              {guideSteps.map((step, i) => {
                const isCurrent = step.status === "current";
                const isDone = step.status === "done";
                return (
                  <li key={step.id}>
                    <Link
                      href={step.href}
                      className={[
                        "expedition-guide__row flex items-center gap-2.5 rounded-lg px-1 py-1 text-[12px] leading-snug transition",
                        isCurrent
                          ? "expedition-guide__row--current text-white"
                          : isDone
                            ? "text-white/50"
                            : "text-white/45 hover:text-white/75",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "expedition-guide__mark grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                          isCurrent
                            ? "expedition-guide__mark--current"
                            : isDone
                              ? "expedition-guide__mark--done"
                              : "bg-white/10 text-white/45 ring-1 ring-white/15",
                        ].join(" ")}
                      >
                        {isDone ? (
                          <span className="material-symbols-outlined text-[14px]! leading-none">
                            check
                          </span>
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className={isCurrent ? "font-semibold" : undefined}>
                        {t(`guide.steps.${step.id}`)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : stagesTotal > 0 ? (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-white/55 sm:text-[11px]">
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
                  className="h-full rounded-full bg-gradient-to-r from-[#2563eb] via-[#0ea5e9] to-[#22d3ee] transition-[width] duration-500"
                  style={{ width: `${stagePct}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="flex items-stretch gap-2 sm:gap-2.5">
            <div className="pointer-events-auto min-w-0 flex-1">
              <GameCtaButton
                href={ctaHref}
                variant="brand"
                className="expedition-cta expedition-cta--stage w-full min-h-12! px-3! py-2.5! text-[14px]! sm:min-h-12! sm:px-[1.1rem]! sm:py-[0.55rem]! sm:text-[13px]!"
              >
                {ctaLabel}
              </GameCtaButton>
            </div>
            <Link
              href="/campaign"
              prefetch={false}
              aria-label={t("journeyGuide")}
              title={t("journeyGuide")}
              className="expedition-map-fab pointer-events-auto inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-black/45 shadow-[0_8px_20px_rgba(0,0,0,0.45)] transition hover:scale-105 hover:border-white/25 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 sm:h-12 sm:w-12"
            >
              <Image
                src="/nav/location-icon.png?v=2"
                alt=""
                width={44}
                height={44}
                draggable={false}
                className="h-8 w-8 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]"
                unoptimized
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
