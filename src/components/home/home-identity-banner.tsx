"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { PvpRankBadge } from "@/components/pvp/pvp-rank-badge";
import { neonTypeColor } from "@/lib/type-colors";
import type { HomeIdentity } from "@/lib/home-hub";
import { homeBannerById } from "@/lib/home-banners";
import { homeFrameById } from "@/lib/home-frames";
import { homeFrameMarcoStyle, homeFrameSectionStyle } from "@/lib/home-frame-style";
import { divisionRoman, type PvpDivision, type PvpTier } from "@/lib/pvp/tiers";

/**
 * Banner de identidad del home (franja baja).
 *
 * `frameId` elige el marco del catálogo (`lib/home-frames`); `null` deja el
 * borde CSS simple. El recorte en nueve piezas vive en `.home-identity__marco`,
 * alimentado por las custom properties que arma este componente.
 */
export function HomeIdentityBanner({
  identity,
  labels,
  frameId = "1",
}: {
  identity: HomeIdentity;
  labels: {
    level: string;
    combatPower: string;
    clan: string;
    noClan: string;
    streak: string;
    streakDays: string;
    viewProfile: string;
    titles: Record<string, string>;
    pvpTiers: Record<string, string>;
    lastAchievement: string;
    achievements: Record<string, string>;
  };
  /** Id del catálogo de marcos. `null` = sin marco, solo borde CSS. */
  frameId?: string | null;
}) {
  const pvpTier = identity.pvpTier as PvpTier;
  const pvpTierLabel = labels.pvpTiers[identity.pvpTier] ?? identity.pvpTier;
  const standingLabel = `${pvpTierLabel} ${divisionRoman(identity.pvpDivision as PvpDivision)}`;
  const profileArt =
    identity.avatarStageSrc ?? identity.avatarProfileSrc ?? identity.avatarSrc;
  /** Busto `*1` para mobile; si no hay, se queda con el cuerpo entero. */
  const bustArt = identity.avatarSrc ?? null;

  const mainType = (identity.companionTypes[0] ?? "normal").toLowerCase();
  const fluorFrom = neonTypeColor(mainType);
  const fluorTo = identity.companionTypes[1]
    ? neonTypeColor(identity.companionTypes[1])
    : neonTypeColor(mainType, 28);

  const cpFormatted = identity.combatPower.toLocaleString();
  /*
    El arte del marco y sus medidas viajan como custom properties: el
    `border-image` y los `calc()` que retraen el arte y separan el copy los leen
    desde ahí. Antes el PNG estaba escrito en el CSS, así que cambiar de marco
    obligaba a tocar la hoja de estilos.
  */
  const frame = frameId ? homeFrameById(frameId) : null;
  const frameVars = frame ? homeFrameSectionStyle(frame) : {};
  const bannerSrc = homeBannerById(identity.homeBannerId).src;

  return (
    <section
      className={`home-identity relative isolate min-h-[7rem] overflow-visible sm:overflow-hidden rounded-none sm:rounded-[1.25rem] sm:min-h-[11rem] xl:min-h-[9.25rem] xl:rounded-2xl${frame ? " home-identity--framed" : ""}`}
      style={
        {
          "--hi-fluor-from": fluorFrom,
          "--hi-fluor-to": fluorTo,
          ...frameVars,
        } as CSSProperties
      }
    >
      {/*
        Todo el arte —paisaje, velos y avatar— vive dentro de esta capa. Cuando
        hay marco, la capa se mete hacia adentro hasta la línea de los rieles,
        así el marco RODEA el banner en vez de dibujarse encima. Ver
        `.home-identity__art`.
      */}
      <div aria-hidden className="home-identity__art">
        <Image
          src={bannerSrc}
          alt=""
          fill
          priority
          unoptimized
          draggable={false}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 100vw, 1280px"
          className="object-cover object-center"
        />

        {/* Vignette liviana: el arte se lee; no tapa el paisaje. */}
        <div className="home-identity__wash" />

        {/* Scrim solo detrás del copy (izquierda). */}
        <div className="home-identity__scrim" />

        {/* Tinte de tipo del favorito, muy suave. */}
        <div className="home-identity__fluor" />

        <div className="pointer-events-none absolute bottom-[10%] right-[6%] hidden h-3 w-[24%] rounded-[100%] bg-black/45 blur-md sm:block sm:right-[10%]" />

        {profileArt ? (
          <div className="home-identity__avatar pointer-events-none absolute z-[5] flex items-end justify-center">
            {/*
              Art direction, no zoom. En mobile el cuerpo entero se ve lejos
              porque el banner es bajo, pero escalarlo recorta distinto en cada
              avatar (las poses no coinciden) y a varios les come la cabeza.
              Debajo de sm va el busto `*1`, que ya viene encuadrado por el
              artista; de sm para arriba sigue el `stageSrc` de cuerpo entero.
              `<picture>` descarga sólo la fuente que aplica — con dos `Image`
              y clases de visibilidad se bajarían las dos.
            */}
            <picture className="home-identity__avatar-pic">
              {bustArt ? <source media="(min-width: 640px)" srcSet={profileArt} /> : null}
              <img
                src={bustArt ?? profileArt}
                alt=""
                width={280}
                height={360}
                draggable={false}
                className="home-identity__avatar-img drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] sm:drop-shadow-[0_16px_28px_rgba(0,0,0,0.55)]"
              />
            </picture>
          </div>
        ) : null}
      </div>

      {/* Único movimiento del banner: un brillo que cruza cada 7 s. */}
      <div aria-hidden className="home-identity__sheen" />

      {/* Marco en nueve piezas. Va en su propia capa y no como borde de la
          sección: un borde se pinta debajo de los hijos posicionados, así que
          el paisaje lo tapaba entero. Ver `.home-identity__marco`. */}
      {frame ? (
        <div aria-hidden className="home-identity__marco" style={homeFrameMarcoStyle(frame)} />
      ) : (
        <div aria-hidden className="home-identity__frame" />
      )}

      {/* Mobile */}
      <Link
        href="/profile"
        className="home-identity__hit relative z-[2] flex h-full min-h-[7rem] items-center gap-2 pr-[37%] sm:hidden"
        aria-label={labels.viewProfile}
      >
        <div className="home-identity__copy min-w-0 flex-1 space-y-1.5">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: `color-mix(in srgb, ${fluorFrom} 78%, white)` }}
          >
            {identity.regionLabel}
          </p>
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="page-title truncate text-[22px] leading-none tracking-tight text-white">
              {identity.username}
            </h2>
            <span className="shrink-0" title={`${standingLabel} · ${identity.pvpRating}`}>
              <PvpRankBadge
                tier={pvpTier}
                division={identity.pvpDivision as PvpDivision}
                label={pvpTierLabel}
                size="sm"
              />
            </span>
          </div>
          {/*
            Chips en vez de una línea de texto con separadores: los mismos
            datos, pero cada uno con su cápsula e ícono. En mobile el renglón
            plano se leía como un pie de foto, no como el HUD de un juego.
          */}
          <div className="identity-chips">
            <span className="identity-chip">
              <span className="identity-chip__key">{labels.level}</span>
              <span className="identity-chip__val">{identity.level}</span>
            </span>
            <span
              className="identity-chip identity-chip--accent"
              style={{ "--chip-accent": fluorFrom } as CSSProperties}
            >
              <Image
                src="/nav/cp-profile.png"
                alt=""
                width={14}
                height={14}
                className="identity-chip__icon"
                unoptimized
              />
              <span className="identity-chip__val">{cpFormatted}</span>
            </span>
            {identity.clanName ? (
              <span className="identity-chip identity-chip--clan">
                {identity.clanEmblem != null ? (
                  <ClanEmblemBadge
                    emblem={identity.clanEmblem}
                    size={13}
                    title={identity.clanName}
                    className="shrink-0"
                  />
                ) : null}
                <span className="identity-chip__val truncate">{identity.clanName}</span>
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      {/* sm+ */}
      <Link
        href="/profile"
        className="home-identity__hit relative z-[2] hidden h-full min-h-[11rem] flex-col justify-center gap-2 pr-[40%] sm:flex md:pr-[36%] xl:min-h-[14rem] xl:pr-[28%]"
        aria-label={labels.viewProfile}
      >
        <div className="home-identity__copy min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.16em] xl:text-xs"
            style={{ color: `color-mix(in srgb, ${fluorFrom} 78%, white)` }}
          >
            {identity.regionLabel}
          </p>

          <div className="mt-2 min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h2 className="page-title truncate text-[1.75rem] leading-none tracking-tight text-white xl:text-[2rem]">
                {identity.username}
              </h2>
              <span
                className="group/rank relative shrink-0"
                title={`${standingLabel} · ${identity.pvpRating}`}
              >
                <PvpRankBadge
                  tier={pvpTier}
                  division={identity.pvpDivision as PvpDivision}
                  label={pvpTierLabel}
                  size="md"
                />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-black/90 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/85 opacity-0 shadow-lg transition duration-150 group-hover/rank:opacity-100 group-focus-within/rank:opacity-100"
                >
                  {standingLabel}
                  <span className="mx-1 text-white/30">·</span>
                  <span className="font-mono tabular-nums text-electric-yellow">
                    {identity.pvpRating}
                  </span>
                </span>
              </span>
            </div>
          </div>

          <div className="mt-2.5 flex min-w-0 flex-row flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px] font-semibold leading-none text-white/90 xl:text-[15px]">
            <span className="shrink-0 tabular-nums">
              {labels.level} {identity.level}
            </span>
            <span className="h-3.5 w-px shrink-0 bg-white/30" aria-hidden />
            {identity.clanName ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {identity.clanEmblem != null ? (
                  <ClanEmblemBadge
                    emblem={identity.clanEmblem}
                    size={16}
                    title={identity.clanName}
                    className="translate-y-px shrink-0"
                  />
                ) : null}
                <span className="text-white">{identity.clanName}</span>
              </span>
            ) : (
              <span className="shrink-0 text-white/80">{labels.noClan}</span>
            )}
            <span
              className="inline-flex shrink-0 items-center gap-1 text-[15px] font-bold tabular-nums tracking-tight xl:text-base"
              style={{ color: `color-mix(in srgb, ${fluorFrom} 68%, white)` }}
            >
              <span className="opacity-80">{labels.combatPower}</span>
              <span>{cpFormatted}</span>
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}
