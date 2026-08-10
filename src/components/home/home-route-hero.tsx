import Image from "next/image";
import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { GameCtaButton } from "@/components/game-cta-button";
import { RegionMapDialog } from "@/components/region-map-dialog";
import { ExpeditionAmbient } from "@/components/home/expedition-ambient";
import type { CurrentExpeditionProps } from "@/components/current-expedition";
import { milestoneCtaKey, milestoneHref } from "@/lib/journey-ux";

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
 * En desktop sigue mandando `CurrentExpedition`, que aprovecha el ancho con
 * tipos, guía y mapa. Acá el criterio es el opuesto: el arte del mapa ocupa
 * toda la card, hay **un** llamado a la acción y el resto es información de
 * un vistazo (región, ruta, progreso, próximo desafío). Es un Server
 * Component: no tiene estado y así el copy se resuelve en el server.
 */
export async function HomeRouteHero({
  expedition,
  nextChallenge,
}: {
  expedition: CurrentExpeditionProps;
  nextChallenge: HomeNextChallenge | null;
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
    guideSteps = [],
  } = expedition;

  const currentGuide = guideSteps.find((s) => s.status === "current");
  const ctaHref = currentGuide?.href ?? milestoneHref(milestone, { gymHref });
  const ctaLabel = currentGuide
    ? t(`guide.cta.${currentGuide.id}`)
    : t(milestoneCtaKey(milestone));
  const pct =
    stagesTotal > 0
      ? Math.max(0, Math.min(100, Math.round((stagesDone / stagesTotal) * 100)))
      : 0;

  return (
    <section className="route-hero lg:hidden">
      {/* El mapa es el fondo, no una miniatura: es lo que da la sensación de
          juego que un gradiente con texto encima no da. */}
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

        <div className="route-hero__cta">
          <GameCtaButton href={ctaHref} variant="gold" className="route-hero__cta-btn">
            {ctaLabel}
          </GameCtaButton>
        </div>
      </div>
    </section>
  );
}
