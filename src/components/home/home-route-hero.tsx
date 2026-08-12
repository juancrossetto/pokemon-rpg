import Image from "next/image";
import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { GameCtaButton } from "@/components/game-cta-button";
import { RegionMapDialog } from "@/components/region-map-dialog";
import { ExpeditionAmbient } from "@/components/home/expedition-ambient";
import type { CurrentExpeditionProps } from "@/components/current-expedition";
import { milestoneHref } from "@/lib/journey-ux";

export type HomeNextChallenge = {
  /** Nombre del líder (o del hito, si no hay líder). */
  title: string;
  /** "Gimnasio Roca", "Alto Mando"… */
  subtitle: string;
  /** Retrato del líder; si falta, el panel muestra sólo texto. */
  imageUrl: string | null;
  /** Color del tipo del gimnasio: tiñe marco y glow del panel. */
  accent: string;
};

/**
 * Hero de ruta — **sólo mobile** (`lg:hidden`).
 *
 * CTA dual: jugar (explorar / gimnasio) siempre primario; cobrar recompensas
 * queda como acción secundaria para no interrumpir el loop de granja.
 * `?play=1` pide al lobby que arranque el encuentro solo.
 */
export async function HomeRouteHero({
  expedition,
  nextChallenge,
  claimableCount = 0,
}: {
  expedition: CurrentExpeditionProps;
  nextChallenge: HomeNextChallenge | null;
  claimableCount?: number;
}) {
  const t = await getTranslations("campaign");
  const {
    regionNameKey,
    locationNameKey,
    stageNameKey,
    mapSrc,
    milestone,
    levelMin,
    levelMax,
    stagesDone,
    stagesTotal,
    locale,
    locations,
    farmingLocationId,
    farmingStageId,
    locationKind,
    gymHref,
  } = expedition;

  const gymReady = milestone.kind === "gym";
  const playHref = gymReady
    ? milestoneHref(milestone, { gymHref })
    : "/battle?play=1";
  const playLabel = gymReady
    ? t("guide.cta.challenge_gym")
    : t("guide.cta.explore");
  const showClaim = claimableCount > 0;

  const pct =
    stagesTotal > 0
      ? Math.max(0, Math.min(100, Math.round((stagesDone / stagesTotal) * 100)))
      : 0;

  return (
    <section className="route-hero lg:hidden">
      <div className="route-hero__art" aria-hidden>
        <Image
          src={mapSrc}
          alt=""
          fill
          className="route-hero__map"
          sizes="100vw"
          priority
        />
        <span className="route-hero__scrim" />
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

      <div className="route-hero__content">
        <div className="route-hero__head">
          <p className="route-hero__region">{t(regionNameKey)}</p>
          <h2 className="route-hero__route">{t(locationNameKey)}</h2>
          <p className="route-hero__stage">
            <span className="route-hero__level">
              Nv. {levelMin}–{levelMax}
            </span>
            <span className="route-hero__dot">·</span>
            {t(stageNameKey)}
          </p>
        </div>

        {stagesTotal > 0 ? (
          <div className="route-hero__progress">
            <p className="route-hero__progress-label">{t("journeyProgress")}</p>
            <p className="route-hero__progress-value">{pct}%</p>
            <span className="route-hero__progress-track" aria-hidden>
              <span
                className="route-hero__progress-fill"
                style={{ width: `${pct}%` }}
              />
            </span>
          </div>
        ) : null}

        {nextChallenge ? (
          <aside
            className="route-hero__next"
            style={{ "--next-accent": nextChallenge.accent } as CSSProperties}
          >
            <p className="route-hero__next-kicker">{t("nextChallenge")}</p>
            <p className="route-hero__next-title">{nextChallenge.title}</p>
            <p className="route-hero__next-sub">{nextChallenge.subtitle}</p>
            {nextChallenge.imageUrl ? (
              <span className="route-hero__next-art" aria-hidden>
                <Image
                  src={nextChallenge.imageUrl}
                  alt=""
                  width={120}
                  height={120}
                  className="route-hero__next-img"
                  unoptimized
                />
              </span>
            ) : null}
          </aside>
        ) : null}

        <div className={`route-hero__cta${showClaim ? " route-hero__cta--dual" : ""}`}>
          <GameCtaButton
            href={playHref}
            variant="gold"
            icon="explore"
            className="route-hero__cta-btn"
          >
            {playLabel}
          </GameCtaButton>
          {showClaim ? (
            <GameCtaButton
              href="/campaign"
              variant="secondary"
              className="route-hero__cta-secondary"
            >
              {t("guide.cta.claim_rewards")}
              {claimableCount > 1 ? ` (${claimableCount})` : ""}
            </GameCtaButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}
