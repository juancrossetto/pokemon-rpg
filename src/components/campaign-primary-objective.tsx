"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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

/** CTA de la barra: tipografía UI normal, una sola línea. */
function ObjectiveBarCta({
  href,
  label,
  icon,
  badgeSrc,
  gymReady,
  disabled,
  isTravel,
  onTravel,
}: {
  href: string;
  label: string;
  icon: string;
  /** Medalla a conseguir — reemplaza el ícono genérico en desafío de gimnasio. */
  badgeSrc?: string | null;
  gymReady: boolean;
  disabled: boolean;
  isTravel: boolean;
  onTravel?: () => void;
}) {
  const className = [
    "ui-btn-primary inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em]",
    gymReady
      ? "bg-[color-mix(in_srgb,var(--theme-primary-bright)_92%,white)] shadow-[0_4px_14px_color-mix(in_srgb,var(--theme-primary)_35%,transparent)]"
      : "",
    disabled ? "pointer-events-none opacity-50" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      {badgeSrc ? (
        <Image
          src={badgeSrc}
          alt=""
          width={22}
          height={22}
          unoptimized
          className="h-[22px] w-[22px] shrink-0 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
          aria-hidden
        />
      ) : (
        <span className="material-symbols-outlined text-[18px]! leading-none" aria-hidden>
          {icon}
        </span>
      )}
      <span className="whitespace-nowrap">{label}</span>
    </>
  );

  if (isTravel) {
    return (
      <button type="button" disabled={disabled} onClick={onTravel} className={className}>
        {body}
      </button>
    );
  }

  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {body}
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

/**
 * Hero de campaña: banner ilustrado (arte libre a la derecha) +
 * card de próximo objetivo debajo — no tapa al Pikachu.
 */
export function CampaignPrimaryObjective({
  action,
  gymHref,
  gymBadgeSrc,
  onTravel,
  travelPending = false,
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
  /** PNG de la medalla del gimnasio a desafiar. */
  gymBadgeSrc?: string | null;
  /** Cuando `action.action === "travel"`: selecciona zona (y suele ir a batalla). */
  onTravel?: () => void;
  travelPending?: boolean;
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
  const isTravel = action.action === "travel";
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
      {/*
        Sin isolate/overflow en el section: el menú "Progreso del viaje" es
        absolute y tiene que pintar por encima del panel sticky de zona.
        El stacking lo resuelve el wrapper z-30 del hero en campaign-journey.
        El recorte del arte vive solo en la capa de imagen.
      */}
      <section className="relative h-[5.75rem] rounded-xl sm:h-[9.5rem] sm:rounded-2xl lg:h-[11rem]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
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
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-pokeball-red sm:text-[10px] sm:tracking-[0.18em]">
              {regionLabel}
              {chapterLabel ? (
                <>
                  <span className="mx-1 text-white/30 sm:mx-1.5">·</span>
                  <span className="text-white/65">{chapterLabel}</span>
                </>
              ) : null}
            </p>
            <h1 className="page-title mt-0.5 truncate text-[1.05rem] leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] sm:text-[1.35rem] lg:text-[1.45rem]">
              {locationName}
            </h1>
            {stagesTotal > 0 ? (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/70 sm:mt-1 sm:gap-1.5 sm:text-[12px]">
                <span className="font-mono text-electric-yellow">
                  {stagesDone}/{stagesTotal}
                </span>
                <span className="hidden sm:inline">{t("objectivesCompleted")}</span>
              </p>
            ) : null}
          </div>

          {journeyMenu ? <div className="shrink-0 self-start sm:self-center">{journeyMenu}</div> : null}
        </div>
      </section>

      {/* Próximo objetivo — solo desktop; barra chata para no comerse el recorrido. */}
      <section
        className={`game-float-card hidden rounded-xl px-3 py-2.5 lg:block ${
          gymReady ? "ring-1 ring-electric-yellow/40" : "ring-1 ring-pokeball-red/28"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p
              className={`text-[9px] font-semibold uppercase tracking-[0.16em] ${
                gymReady ? "text-electric-yellow" : "text-pokeball-red"
              }`}
            >
              {t("nextObjective")}
            </p>
            <h2 className="truncate text-[0.95rem] font-bold leading-snug tracking-tight text-white">
              {title}
            </h2>

            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {progressTarget > 0 && (
                <div className="flex min-w-[8rem] max-w-[14rem] flex-1 items-center gap-2">
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/8">
                    <div
                      className="campaign-warm-bar h-full rounded-full transition-all duration-500 motion-reduce:transition-none"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-electric-yellow">
                    {progressCurrent}/{progressTarget}
                  </span>
                </div>
              )}

              {action.recommendedLevel != null &&
                action.recommendedLevel > 0 &&
                !showReqs && (
                  <p className="text-[11px] text-white/45">
                    {t("reqLevel", { level: action.recommendedLevel })}
                  </p>
                )}

              {showReqs && (
                <ul className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
                  {action.missingRequirements.map((req) => (
                    <li
                      key={req.id}
                      className={`inline-flex max-w-full items-center gap-1 text-[11px] ${
                        req.completed ? "text-electric-yellow/90" : "text-white/50"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]! leading-none">
                        {req.completed ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <span className="truncate">{translateRequirement(t, req)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="w-[min(100%,15rem)] shrink-0">
            <ObjectiveBarCta
              href={href}
              label={t(action.labelKey)}
              icon="explore"
              badgeSrc={gymReady ? gymBadgeSrc : null}
              gymReady={gymReady}
              disabled={!action.enabled || (isTravel && (travelPending || !onTravel))}
              isTravel={isTravel}
              onTravel={onTravel}
            />
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
