"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GameCtaButton } from "@/components/game-cta-button";
import { MapIcon } from "@/components/zone-icons";
import type { CampaignActionState, CampaignRequirement } from "@/lib/campaign";

function translateRequirement(
  t: ReturnType<typeof useTranslations>,
  req: CampaignRequirement,
): string {
  const raw = req.descriptionParams ?? {};
  const params: Record<string, string | number> = { ...raw };
  for (const key of ["location", "stage"] as const) {
    const val = raw[key];
    if (typeof val === "string" && val.includes(".")) {
      params[key] = t(val);
    }
  }
  return t(req.descriptionKey, params);
}

/**
 * Hero de campaña: banner ilustrado (arte libre a la derecha) +
 * card de próximo objetivo debajo — no tapa al Pikachu.
 */
export function CampaignPrimaryObjective({
  action,
  gymHref,
  bannerSrc,
  bannerObjectPosition = "68% bottom",
  locationName,
  regionLabel,
  chapterLabel,
  stagesDone,
  stagesTotal,
  journeyMenu,
}: {
  action: CampaignActionState;
  gymHref?: string | null;
  bannerSrc: string;
  /** Encuadre del arte — evita cortar Pokémon abajo/derecha. */
  bannerObjectPosition?: string;
  locationName: string;
  regionLabel: string;
  chapterLabel: string | null;
  stagesDone: number;
  stagesTotal: number;
  journeyMenu?: ReactNode;
}) {
  const t = useTranslations("campaign");
  const href =
    action.action === "challenge_gym" && gymHref ? gymHref : action.href;
  const gymReady = action.action === "challenge_gym";
  const showReqs = action.missingRequirements.length > 0;

  const title =
    action.locationNameKey != null
      ? t(action.objectiveTitleKey, { name: t(action.locationNameKey) })
      : t(action.objectiveTitleKey);

  const progressPct =
    action.progress && action.progress.target > 0
      ? Math.min(100, Math.round((action.progress.current / action.progress.target) * 100))
      : stagesTotal > 0
        ? Math.min(100, Math.round((stagesDone / stagesTotal) * 100))
        : 0;

  const progressCurrent = action.progress?.current ?? stagesDone;
  const progressTarget = action.progress?.target ?? stagesTotal;

  return (
    <div className="campaign-hero flex flex-col gap-3">
      {/* Mobile: strip chato y simple. Desktop: un poco más alto. */}
      <section className="relative isolate h-[5.75rem] overflow-hidden rounded-xl sm:h-[9.5rem] sm:rounded-2xl lg:h-[11rem]">
        <div className="pointer-events-none absolute inset-0">
          <Image
            key={`${bannerSrc}:${bannerObjectPosition}`}
            src={bannerSrc}
            alt=""
            fill
            priority
            unoptimized
            sizes="(max-width: 1400px) 100vw, 1400px"
            className="object-cover"
            style={{ objectPosition: bannerObjectPosition }}
          />
          <div className="absolute inset-0 bg-linear-to-r from-[#0a0b10]/92 via-[#0a0b10]/45 to-[#0a0b10]/15 sm:via-[#0a0b10]/22 sm:to-transparent" />
        </div>

        <div className="relative z-[1] flex h-full items-center gap-2 p-2.5 sm:gap-3 sm:p-3.5">
          <Link
            href="/"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/40 text-white/70 ring-1 ring-white/10 backdrop-blur-sm hover:text-white"
            aria-label={t("backHome")}
          >
            <span className="material-symbols-outlined text-[18px]!">arrow_back</span>
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-[#ff9a4a] sm:text-[10px] sm:tracking-[0.18em]">
              {regionLabel}
              {chapterLabel ? (
                <>
                  <span className="mx-1 text-white/30 sm:mx-1.5">·</span>
                  <span className="text-white/65">{chapterLabel}</span>
                </>
              ) : null}
            </p>
            <h1 className="mt-0.5 truncate text-[1.05rem] font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] sm:text-[1.35rem] lg:text-[1.45rem]">
              {locationName}
            </h1>
            {stagesTotal > 0 ? (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/70 sm:mt-1 sm:gap-1.5 sm:text-[12px]">
                <span className="font-mono text-[#ffcb05]">
                  {stagesDone}/{stagesTotal}
                </span>
                <span className="hidden sm:inline">{t("objectivesCompleted")}</span>
              </p>
            ) : null}
          </div>

          {journeyMenu ? <div className="shrink-0 self-start sm:self-center">{journeyMenu}</div> : null}
        </div>
      </section>

      {/* Próximo objetivo: desktop only — en mobile el panel de zona ya lo cubre. */}
      <section
        className={`game-float-card hidden rounded-2xl p-3 sm:p-3.5 lg:block ${
          gymReady ? "ring-1 ring-[#ffcb05]/40" : "ring-1 ring-[#ff8a00]/28"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                gymReady ? "text-[#ffcb05]" : "text-[#ff8a00]"
              }`}
            >
              {t("nextObjective")}
            </p>
            <h2 className="mt-0.5 truncate text-[1.05rem] font-bold tracking-tight text-white sm:text-[1.2rem]">
              {title}
            </h2>

            {progressTarget > 0 && (
              <div className="mt-2.5">
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-white/50">
                  <span>{t("objectiveProgress")}</span>
                  <span className="font-mono text-[#ffcb05]">
                    {progressCurrent}/{progressTarget}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/8">
                  <div
                    className="campaign-warm-bar h-full rounded-full transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {action.recommendedLevel != null && action.recommendedLevel > 0 && (
              <p className="mt-2 text-[12px] text-white/50">
                {t("reqLevel", { level: action.recommendedLevel })}
              </p>
            )}

            {showReqs && (
              <ul className="mt-2.5 flex flex-col gap-1">
                {action.missingRequirements.map((req) => (
                  <li
                    key={req.id}
                    className={`flex items-start gap-1.5 text-[12px] ${
                      req.completed ? "text-[#ffcb05]" : "text-white/50"
                    }`}
                  >
                    <span className="material-symbols-outlined mt-0.5 text-[15px]!">
                      {req.completed ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    <span>{translateRequirement(t, req)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="w-full shrink-0 sm:w-auto sm:min-w-[15rem]">
            <GameCtaButton
              href={href}
              disabled={!action.enabled}
              variant="gold"
              icon={gymReady ? "military_tech" : "explore"}
              className="campaign-hero-cta min-h-11 shadow-[0_8px_24px_rgba(255,140,20,0.35)]"
            >
              {t(action.labelKey)}
            </GameCtaButton>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Summary trigger for the journey dropdown, styled for the hero. */
export function CampaignJourneyMenuTrigger({
  desktopLabel,
  mobileLabel,
}: {
  desktopLabel: string;
  mobileLabel: string;
}) {
  return (
    <summary
      className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg bg-black/40 text-white/70 ring-1 ring-white/10 backdrop-blur-sm marker:content-none hover:text-white sm:h-auto sm:w-auto sm:min-h-9 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-label-sm [&::-webkit-details-marker]:hidden"
      aria-label={mobileLabel}
      title={desktopLabel}
    >
      <MapIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
      <span className="hidden sm:inline">{desktopLabel}</span>
    </summary>
  );
}
