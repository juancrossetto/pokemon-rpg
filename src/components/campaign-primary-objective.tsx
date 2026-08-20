"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MapIcon } from "@/components/zone-icons";
import { GameCtaButton } from "@/components/game-cta-button";
import { PokeSparks } from "@/components/poke-sparks";
import {
  CampaignPartyDock,
  type CampaignDockMember,
  type CampaignPartyHeal,
} from "@/components/campaign-party-dock";
import type { HeldItemLabels, OwnedHeldItem } from "@/components/held-item-panel";
import type { SquadContextLabels } from "@/components/squad-card-context-menu";
import type { SquadBagCounts } from "@/lib/squad-bag";
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
 * Anillo de progreso alrededor del ícono del objetivo. El porcentaje ya vivía
 * en una barra plana; en circular se lee de un vistazo y le da al bloque el
 * peso visual que corresponde a la acción principal de la pantalla.
 */
function ObjectiveRing({
  percent,
  gymReady,
  size,
}: {
  percent: number;
  gymReady: boolean;
  size: number;
}) {
  const stroke = size <= 30 ? 3 : 3.5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const accent = gymReady ? "var(--color-electric-yellow)" : "var(--color-pokeball-red)";
  const accentBright = gymReady
    ? "var(--theme-tertiary-bright)"
    : "var(--theme-primary-bright)";
  const gradientId = useId();

  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accentBright} />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
        />
        <circle
          className="campaign-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, percent)) / 100)}
          style={{ filter: `drop-shadow(0 0 6px color-mix(in srgb, ${accent} 65%, transparent))` }}
        />
      </svg>
      <span
        className="material-symbols-outlined relative"
        style={{
          fontSize: `${Math.round(size * 0.44)}px`,
          color: accent,
        }}
      >
        {gymReady ? "military_tech" : "flag"}
      </span>
    </span>
  );
}

/** CTA de la barra: `.game-cta` + Orbitron (mismo patrón que Explorar / home). */
function ObjectiveBarCta({
  href,
  label,
  icon,
  badgeSrc,
  disabled,
  isTravel,
  onTravel,
  block = false,
}: {
  href: string;
  label: string;
  icon: string;
  /** Medalla a conseguir — reemplaza el ícono genérico en desafío de gimnasio. */
  badgeSrc?: string | null;
  disabled: boolean;
  isTravel: boolean;
  onTravel?: () => void;
  /** Ancho completo — variante mobile de la card de objetivo. */
  block?: boolean;
}) {
  const className = block
    ? "mb-0! min-h-12! w-full! gap-2! text-[13px]!"
    : "mb-0! w-auto! min-h-12! min-w-0! shrink-0 gap-1.5! whitespace-nowrap px-4! py-2.5! text-[13px]! [&_.game-cta__label]:whitespace-nowrap";

  // Badge de gimnasio: carcasa a mano (misma tipografía Orbitron) porque el
  // ícono es la medalla, no el explore/brújula genérico.
  if (badgeSrc) {
    const classes = `game-cta game-cta--red ${disabled ? "game-cta--disabled" : ""} ${className}`.trim();
    const body = (
      <>
        <Image
          src={badgeSrc}
          alt=""
          width={22}
          height={22}
          unoptimized
          className="game-cta__icon h-[22px] w-[22px] shrink-0 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
          aria-hidden
        />
        <span className="game-cta__label whitespace-nowrap">{label}</span>
      </>
    );
    if (isTravel) {
      return (
        <button type="button" disabled={disabled} onClick={onTravel} className={classes}>
          {body}
        </button>
      );
    }
    if (disabled) {
      return (
        <span className={classes} aria-disabled="true">
          {body}
        </span>
      );
    }
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  if (isTravel) {
    return (
      <GameCtaButton
        type="button"
        disabled={disabled}
        onClick={onTravel}
        variant="red"
        icon={icon}
        className={className}
      >
        {label}
      </GameCtaButton>
    );
  }

  return (
    <GameCtaButton
      href={href}
      disabled={disabled}
      variant="red"
      icon={icon}
      className={className}
    >
      {label}
    </GameCtaButton>
  );
}

/**
 * Anillo del capítulo, con el porcentaje adentro.
 *
 * Aparte de `ObjectiveRing` a propósito: aquél mide el objetivo actual y lleva
 * un ícono en el centro, éste mide el capítulo entero y lleva la cifra. Meter
 * los dos modos en un componente pedía dos props que se excluyen entre sí.
 *
 * Se oculta en mobile: ahí el banner tiene 5,75rem de alto y el anillo le
 * comería el ancho al título, que es lo que orienta.
 */
function ChapterRing({ percent }: { percent: number }) {
  const size = 58;
  /*
    Trazo más fino que el original (5): con el anillo cerrado al 100% ese
    grosor comía el espacio interior justo cuando el número pasa a tres
    dígitos, y "100%" terminaba tocando el borde por los dos lados.
  */
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Tres dígitos ocupan un tercio más que dos: el cuerpo baja para que "100"
  // ocupe lo mismo que "27" en vez de tocar el borde.
  const numberSize = percent >= 100 ? 16 : 18;

  return (
    <span
      className="relative hidden shrink-0 place-items-center sm:grid"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--theme-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, percent)) / 100)}
          style={{
            filter:
              "drop-shadow(0 0 6px color-mix(in srgb, var(--theme-primary) 60%, transparent))",
          }}
        />
      </svg>
      {/*
        Sólo el número, sin el signo.

        El "%" iba a 9px contra un número de 15: no se leía como parte de la
        cifra sino como un superíndice pegado, y con tres dígitos ("100%")
        además desbordaba el círculo. El anillo ya dice que esto es una
        proporción —para eso es un anillo—, así que el signo no agregaba
        significado, sólo cuatro píxeles de ruido. Sin él el número puede
        crecer y respirar.
      */}
      <span
        className="relative font-mono font-bold leading-none text-white"
        style={{ fontSize: `${numberSize}px` }}
      >
        {percent}
      </span>
    </span>
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
  party,
  browsingHint = null,
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
  /** Hojeando otro capítulo: dónde está el viaje de verdad. */
  browsingHint?: string | null;
  stagesDone: number;
  stagesTotal: number;
  journeyMenu?: ReactNode;
  /** Mini-equipo a la derecha de la barra (antes del CTA). */
  party?: {
    locale: string;
    members: CampaignDockMember[];
    bagCounts: SquadBagCounts;
    ownedHeldItems: OwnedHeldItem[];
    heal: CampaignPartyHeal;
    menuLabels: SquadContextLabels;
    heldLabels: HeldItemLabels;
  } | null;
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
      <section className="relative min-h-[5.25rem] rounded-xl sm:h-[8.25rem] sm:min-h-0 sm:rounded-2xl lg:h-[9.25rem]">
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
          {/* Motas ambiente sobre el banner — determinísticas (seed = zona actual),
              respetan prefers-reduced-motion vía la regla ya existente de PokeSparks. */}
          <PokeSparks seed={bannerSrc} accent="#e879f9" />
        </div>

        <div className="relative z-[1] flex h-full items-center gap-2 p-2.5 sm:gap-3 sm:p-3.5">
          <Link
            href="/"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/40 text-white/70 ring-1 ring-white/10 backdrop-blur-md hover:text-white"
            aria-label={t("backHome")}
          >
            <span className="material-symbols-outlined text-[18px]!">arrow_back</span>
          </Link>

          {/*
            Anillo del capítulo sobre el banner.

            El progreso ya estaba escrito ("0/15 objetivos completados") pero
            como texto chico bajo el título: hay que leerlo para saber si vas
            por la mitad o recién arrancás. En circular la proporción se ve sin
            leer, que es lo que un indicador de avance tiene que hacer.
          */}
          {stagesTotal > 0 ? (
            <ChapterRing
              percent={Math.min(100, Math.round((stagesDone / stagesTotal) * 100))}
            />
          ) : null}

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
            <h1 className="page-title mt-0.5 line-clamp-2 text-[1.05rem] leading-[1.15] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] sm:line-clamp-none sm:truncate sm:text-[1.35rem] sm:leading-tight lg:text-[1.45rem]">
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
            {browsingHint ? (
              <p className="mt-1 max-w-xl truncate text-[11px] text-white/55 sm:text-[12px]">
                {browsingHint}
              </p>
            ) : null}
          </div>

          {journeyMenu ? <div className="shrink-0 self-start sm:self-center">{journeyMenu}</div> : null}
        </div>
      </section>

      {/*
        Mobile: la card de objetivo también va acá arriba. Antes era `lg:block`
        y en teléfono la única acción vivía dentro del panel de zona, debajo de
        toda la lista del recorrido — un jugador nuevo abría /campaign y no
        tenía ninguna indicación de qué hacer sin scrollear.
      */}
      <section
        className={`campaign-objective-in relative overflow-hidden rounded-xl border border-white/8 bg-white/3 p-3 backdrop-blur-md lg:hidden ${
          gymReady ? "ring-1 ring-electric-yellow/45" : ""
        } ${action.enabled && !showReqs ? "campaign-objective-sheen" : ""}`}
      >
        <div className="relative flex items-center gap-2.5">
          <ObjectiveRing percent={progressPct} gymReady={gymReady} size={38} />
          <div className="min-w-0 flex-1">
            <p
              className={`stamp-title text-[9px] tracking-[0.16em] ${
                gymReady ? "text-electric-yellow" : "text-pokeball-red"
              }`}
            >
              {t("nextObjective")}
            </p>
            <h2 className="page-title mt-0.5 text-[14px] leading-snug tracking-tight text-white">
              {title}
            </h2>
          </div>
          {/* El anillo ya muestra el porcentaje: acá va el crudo, no otra barra. */}
          {progressTarget > 0 ? (
            <span className="shrink-0 self-start font-mono text-[12px] tabular-nums text-electric-yellow">
              {progressCurrent}/{progressTarget}
            </span>
          ) : null}
        </div>

        {showReqs ? (
          <ul className="relative mt-2 flex flex-col gap-0.5">
            {action.missingRequirements.map((req) => (
              <li
                key={req.id}
                className={`flex items-start gap-1 text-[11px] leading-snug ${
                  req.completed ? "text-electric-yellow/90" : "text-white/50"
                }`}
              >
                <span className="material-symbols-outlined mt-px text-[13px]! leading-none">
                  {req.completed ? "check_circle" : "radio_button_unchecked"}
                </span>
                <span>{translateRequirement(t, req)}</span>
              </li>
            ))}
          </ul>
        ) : action.recommendedLevel != null && action.recommendedLevel > 0 ? (
          <p className="relative mt-2 text-[11px] text-white/45">
            {t("reqLevel", { level: action.recommendedLevel })}
          </p>
        ) : null}

        <div className="relative mt-3">
          <ObjectiveBarCta
            block
            href={href}
            label={t(action.labelKey)}
            icon="explore"
            badgeSrc={gymReady ? gymBadgeSrc : null}
            disabled={!action.enabled || (isTravel && (travelPending || !onTravel))}
            isTravel={isTravel}
            onTravel={onTravel}
          />
        </div>
      </section>

      {/*
        Misma grilla que el cuerpo (sin px lateral en el section): así el equipo
        comparte el borde derecho con el panel de zona.
      */}
      <section
        className={`game-float-card hidden rounded-xl py-2.5 lg:block ${
          gymReady ? "ring-1 ring-electric-yellow/40" : "ring-1 ring-pokeball-red/28"
        }`}
      >
        {/*
          Una fila, no una grilla.

          La grilla tenía una tercera columna reservada al mini-equipo. Cuando
          el equipo se mudó al rail, esa columna quedó vacía pero siguió
          ocupando 280–340px: el contenido se apretaba contra la columna 1 y el
          CTA terminaba flotando en el medio de la barra en vez de anclado a la
          derecha. Sin equipo hay dos cosas —el objetivo y la acción—, y para
          dos cosas alcanza una fila.
        */}
        <div className="w-full">
          <div className="flex min-w-0 items-center gap-3.5 px-3">
            <ObjectiveRing percent={progressPct} gymReady={gymReady} size={46} />
            <div className="min-w-0 flex-1 text-left">
            <p
                className={`stamp-title text-[9px] tracking-[0.16em] ${
                gymReady ? "text-electric-yellow" : "text-pokeball-red"
              }`}
            >
              {t("nextObjective")}
            </p>
            <h2 className="page-title mt-0.5 text-[1.05rem] leading-snug tracking-tight text-white sm:text-[1.15rem]">
                {title}
              </h2>

              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                {progressTarget > 0 && (
                  <div className="flex w-full max-w-[22rem] items-center gap-2.5">
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

            <ObjectiveBarCta
              href={href}
              label={t(action.labelKey)}
              icon="explore"
              badgeSrc={gymReady ? gymBadgeSrc : null}
              disabled={!action.enabled || (isTravel && (travelPending || !onTravel))}
              isTravel={isTravel}
              onTravel={onTravel}
            />
          </div>

        </div>
      </section>

      {/*
        Franja del equipo, sólo en mobile.

        En escritorio el equipo se mudó al rail derecho, junto al panel de zona
        —comparte columna con "qué me falta", que es la pregunta que el equipo
        ayuda a responder—. En mobile ese rail cae debajo del recorrido entero,
        demasiado lejos de la acción, así que ahí se queda bajo el banner.
      */}
      {party && party.members.length > 0 ? (
        <section
          /*
            Ancho tope en escritorio: los slots del dock son `flex-1` con
            `aspect-square`, así que su tamaño es (ancho del contenedor / 6).
            A sangre completa daban avatares de 225px. Acotado, quedan en ~60,
            que es el tamaño para el que están pensados.
          */
          className={`rounded-2xl border border-white/8 bg-white/3 px-3 pb-2 pt-2 lg:hidden ${
            party.heal.needsHealing ? "ring-1 ring-pokeball-red/30" : ""
          }`}
        >
          {/* Rótulo: sin él la tira eran seis círculos sueltos entre la barra
              de objetivo y los capítulos — se leía como un widget huérfano y
              no como el equipo con el que salís a explorar. */}
          <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            {t("partyStripTitle")}
          </p>
          <CampaignPartyDock
            locale={party.locale}
            initialMembers={party.members}
            initialBagCounts={party.bagCounts}
            ownedHeldItems={party.ownedHeldItems}
            heal={party.heal}
            menuLabels={party.menuLabels}
            heldLabels={party.heldLabels}
          />
        </section>
      ) : null}
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
