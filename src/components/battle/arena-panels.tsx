"use client";

// Piezas presentacionales de la arena: sidebars de equipo, íconos de party,
// placas de HP y badges de estado. No tienen estado propio — todo lo delicado
// (timeline de animaciones) queda en battle-arena.tsx.

import Image from "next/image";
import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PokeballIcon } from "@/components/pokeball-icon";
import { ShinyMark } from "@/components/shiny-mark";
import { TrainerAvatar } from "@/components/trainer-avatar";
import { BattleItemUseFx } from "@/components/battle/battle-item-use-fx";
import { isNpcTrainerPixelPortraitUrl } from "@/lib/avatars";
import {
  BATTLE_STATS,
  isStatusCondition,
  statLabelKey,
  statusAbbrKey,
  statusLabelKey,
  type StatStages,
} from "@/lib/status";

function hpTone(hpPct: number): "" | "yellow" | "red" {
  if (hpPct > 50) return "";
  if (hpPct > 20) return "yellow";
  return "red";
}

/** Barra de HP del sidebar de equipo — pill moderna con tono por umbral. */
function PartyHpLine({
  hpPct,
  thick,
  className = "",
}: {
  hpPct: number;
  thick?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, hpPct));
  const tone = hpTone(pct);
  const toneClass =
    tone === "red" ? "party-hp__fill--red" : tone === "yellow" ? "party-hp__fill--yellow" : "party-hp__fill--ok";

  return (
    <div
      className={`party-hp ${thick ? "party-hp--lg" : ""} ${className}`.trim()}
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="party-hp__track">
        <div className={`party-hp__fill ${toneClass}`} style={{ width: `${pct}%` }}>
          <span className="party-hp__sheen" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function PartyHpEmpty({ fainted, className = "" }: { fainted?: boolean; className?: string }) {
  return (
    <div className={`party-hp party-hp--lg ${className}`.trim()} aria-hidden>
      <div className={`party-hp__track ${fainted ? "party-hp__track--faint" : ""}`} />
    </div>
  );
}

/**
 * Tope de ancho de los chips de equipo compactos.
 *
 * Los chips son `flex-1` + `aspect-square w-full` para poder achicarse cuando
 * hay seis; sin tope, con **uno solo** ese `flex-1` se come todo el ancho de la
 * fila y el cuadrado se vuelve igual de alto (~300px en un teléfono). Se veía
 * en la primera batalla contra el rival, que pelea con un único Pokémon: la
 * cabecera del rival tapaba media pantalla y empujaba la arena fuera de vista.
 * `max-w` deja crecer hasta el tamaño de chip y seguir encogiendo por debajo.
 */
const PARTY_CHIP_CAP = "max-w-[3.25rem] md:max-w-[4.5rem]";

export function PartySidebar({
  name,
  portraitUrl,
  align,
  compact,
  variant = "party",
  featuredSpriteUrl = null,
  featuredLevel = null,
  featuredIsShiny = false,
  encounterPlace = null,
  children,
}: {
  name: string;
  portraitUrl: string | null;
  align: "left" | "right";
  compact?: boolean;
  /** Encuentro sin entrenador (salvaje / torre): sprite destacado, sin grilla de 6. */
  variant?: "party" | "wild";
  /** Sprite del mon activo. */
  featuredSpriteUrl?: string | null;
  /** Nivel del mon activo (sidebar salvaje). */
  featuredLevel?: number | null;
  /** Variocolor: brillo en el strip mobile del salvaje. */
  featuredIsShiny?: boolean;
  /** Lugar del encuentro (ruta/piso/torre). */
  encounterPlace?: {
    title: string;
    subtitle: string | null;
    iconUrl?: string | null;
  } | null;
  children: ReactNode;
}) {
  const t = useTranslations("battle");
  const pixelPortrait = isNpcTrainerPixelPortraitUrl(portraitUrl);
  /** Arte local HD: bust/contain centrado — el fill+cover de avatares de jugador
   *  desplaza NPCs de pose asimétrica (brazo alzado, etc.). */
  const localNpcPortrait = Boolean(portraitUrl && !pixelPortrait);
  const isWild = variant === "wild";
  const hasChildren = Boolean(children);
  const placeIconUrl = encounterPlace?.iconUrl ?? null;

  if (compact && isWild && (encounterPlace || featuredLevel != null)) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-black/30 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:gap-3 md:px-3.5 md:py-2.5">
        {encounterPlace ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-2.5">
            <span
              aria-hidden
              className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-secondary/40 bg-secondary/20 shadow-[0_0_12px_color-mix(in_srgb,var(--theme-secondary)_40%,transparent)] md:h-11 md:w-11"
            >
              <span className="absolute inset-0 rounded-full bg-secondary/25 blur-md" />
              {placeIconUrl ? (
                <Image
                  src={placeIconUrl}
                  alt=""
                  width={44}
                  height={44}
                  className="relative h-full w-full object-cover"
                  sizes="44px"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="relative h-3.5 w-3.5 text-secondary md:h-4 md:w-4"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 2.5c.4 2.8 2.2 5 4.8 6.2-1.6.7-2.8 2-3.4 3.6-.6-1.6-1.8-2.9-3.4-3.6C12.6 7.5 14.4 5.3 12 2.5Zm0 10.2c1.7 1.4 2.8 3.5 2.8 5.8 0 1.8-1.3 3.5-2.8 3.5s-2.8-1.7-2.8-3.5c0-2.3 1.1-4.4 2.8-5.8Z" />
                </svg>
              )}
            </span>
            <div className="min-w-0">
              <p
                title={encounterPlace.title}
                className="truncate text-[11px] font-bold leading-tight text-white/92 md:text-[13px]"
              >
                {encounterPlace.title}
              </p>
              {encounterPlace.subtitle ? (
                <p
                  title={encounterPlace.subtitle}
                  className="truncate text-[10px] font-medium leading-tight text-secondary md:text-[11px]"
                >
                  {encounterPlace.subtitle}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        {hasChildren ? (
          <div className="flex shrink-0 items-stretch gap-1">{children}</div>
        ) : null}
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2.5">
          {featuredSpriteUrl ? (
            <span className="relative flex h-10 w-10 items-center justify-center md:h-14 md:w-14">
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-0 rounded-full blur-md ${
                  featuredIsShiny ? "bg-[#FFCC00]/35" : "bg-secondary/25"
                }`}
              />
              <Image
                src={featuredSpriteUrl}
                alt=""
                width={56}
                height={56}
                className="relative h-9 w-9 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] md:h-12 md:w-12"
                unoptimized
              />
            </span>
          ) : null}
          <div className="min-w-0 text-left">
            <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.14em] text-secondary md:text-[10px]">
              {t("wildTag")}
              {featuredIsShiny ? (
                <ShinyMark className="h-3 w-3 md:h-3.5 md:w-3.5" title={t("shinyBadge")} />
              ) : null}
            </p>
            <p
              title={name}
              className="max-w-[6.5rem] truncate text-[11px] font-bold uppercase leading-tight text-white md:max-w-[9rem] md:text-[13px]"
            >
              {name}
            </p>
            {featuredLevel != null ? (
              <p className="text-[9px] leading-tight text-white/55 md:text-[11px]">
                {t("level", { level: featuredLevel })}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-black/30 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:gap-3 md:px-3 md:py-2.5 ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        <div className="flex w-[3.25rem] shrink-0 flex-col items-center gap-0.5 md:w-16">
          {isWild && featuredSpriteUrl ? (
            <span className="relative flex h-10 w-10 items-center justify-center md:h-14 md:w-14">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full bg-primary/25 blur-md"
              />
              <Image
                src={featuredSpriteUrl}
                alt=""
                width={56}
                height={56}
                className="relative h-9 w-9 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] md:h-12 md:w-12"
                unoptimized
              />
            </span>
          ) : (
            <>
              {/*
                No poner `hidden`/`md:hidden` en TrainerAvatar: su root ya trae
                `inline-flex` y en el CSS generado eso pisa el utility (se ven
                los dos tamaños a la vez). El toggle va en el wrapper.
              */}
              <span className="relative inline-flex md:hidden">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-1 rounded-[28%] bg-primary/20 blur-md"
                />
                <TrainerAvatar
                  name={name}
                  src={portraitUrl}
                  size="sm"
                  pixel={pixelPortrait}
                  contain={localNpcPortrait}
                  className="relative"
                />
              </span>
              <span className="relative hidden md:inline-flex">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-1.5 rounded-[28%] bg-primary/20 blur-md"
                />
                <TrainerAvatar
                  name={name}
                  src={portraitUrl}
                  size="md"
                  pixel={pixelPortrait}
                  contain={localNpcPortrait}
                  className="relative"
                />
              </span>
            </>
          )}
          <p
            title={name}
            className="w-full truncate text-center text-[9px] font-bold leading-tight text-white/90 md:text-[11px]"
          >
            {name}
          </p>
        </div>
        {hasChildren ? (
          /* Con el tope de ancho los chips ya no llenan la fila: se agrupan del
             lado del entrenador para no quedar sueltos en el medio. */
          <div
            className={`flex min-w-0 flex-1 items-stretch gap-1.5 md:gap-2.5 ${
              align === "right" ? "justify-end" : "justify-start"
            }`}
          >
            {children}
          </div>
        ) : null}
      </div>
    );
  }

  if (isWild) {
    const placeIcon = encounterPlace?.iconUrl ?? null;
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.055] via-[#12141a]/92 to-black/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_32px_rgba(0,0,0,0.35)]">
        {encounterPlace ? (
          <div className="flex min-w-0 items-center gap-2 border-b border-white/[0.07] pb-2.5">
            <span
              aria-hidden
              className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-secondary/40 bg-secondary/20 shadow-[0_0_12px_color-mix(in_srgb,var(--theme-secondary)_40%,transparent)]"
            >
              <span className="absolute inset-0 rounded-full bg-secondary/25 blur-md" />
              {placeIcon ? (
                <Image
                  src={placeIcon}
                  alt=""
                  width={36}
                  height={36}
                  className="relative h-full w-full object-cover"
                  sizes="36px"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="relative h-3.5 w-3.5 text-secondary"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 2.5c.4 2.8 2.2 5 4.8 6.2-1.6.7-2.8 2-3.4 3.6-.6-1.6-1.8-2.9-3.4-3.6C12.6 7.5 14.4 5.3 12 2.5Zm0 10.2c1.7 1.4 2.8 3.5 2.8 5.8 0 1.8-1.3 3.5-2.8 3.5s-2.8-1.7-2.8-3.5c0-2.3 1.1-4.4 2.8-5.8Z" />
                </svg>
              )}
            </span>
            <div className="min-w-0">
              <p
                title={encounterPlace.title}
                className="truncate text-[12px] font-bold leading-tight text-white/92"
              >
                {encounterPlace.title}
              </p>
              {encounterPlace.subtitle ? (
                <p
                  title={encounterPlace.subtitle}
                  className="truncate text-[10px] font-medium leading-tight text-secondary"
                >
                  {encounterPlace.subtitle}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-secondary">
            {t("wildTag")}
          </p>
          <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-[-6%] rounded-full bg-secondary/14 blur-2xl"
            />
            {featuredSpriteUrl ? (
              <Image
                src={featuredSpriteUrl}
                alt=""
                width={96}
                height={96}
                className="relative h-[92%] w-[92%] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)]"
                unoptimized
              />
            ) : (
              <PokeballIcon className="relative h-8 w-8 opacity-35" />
            )}
          </div>
          <div className="min-w-0 px-1 text-center">
            <p
              title={name}
              className="truncate text-[13px] font-bold uppercase leading-tight tracking-wide text-white"
            >
              {name}
            </p>
            {featuredLevel != null ? (
              <p className="mt-0.5 text-[11px] font-medium text-white/55">
                {t("level", { level: featuredLevel })}
              </p>
            ) : null}
          </div>
        </div>

        {hasChildren ? (
          <div className="flex justify-center gap-1.5 border-t border-white/[0.07] pt-2.5">
            {children}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-primary/[0.08] via-[#12141a]/94 to-black/45 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_36px_rgba(0,0,0,0.4)]">
      <div className="flex shrink-0 flex-col items-center gap-2 border-b border-white/[0.07] pb-2.5">
        {/*
          `inline-flex` y no el `inline` por defecto: como span inline, el
          wrapper heredaba el espacio de línea bajo la baseline y quedaba unos
          px más alto que el avatar, así que el ring de `inset-0` no calzaba
          con las esquinas redondeadas del retrato.
        */}
        <span className="relative inline-flex shrink-0">
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-2 rounded-[32%] bg-primary/25 blur-xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-2 rounded-[28%] ring-1 ring-primary/35"
          />
          {/* El `rounded` va acá también: la sombra sigue la caja del span
              externo, que sin radio la dibujaba cuadrada detrás del retrato. */}
          <TrainerAvatar
            name={name}
            src={portraitUrl}
            size="2xl"
            pixel={pixelPortrait}
            contain={localNpcPortrait}
            className="relative rounded-[28%] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          />
        </span>
        <p
          title={name}
          className="line-clamp-2 max-w-full px-0.5 text-center text-[12px] font-bold leading-snug tracking-wide text-white"
        >
          {name}
        </p>
      </div>

      {/* Grilla 3×2: aprovecha el ancho de la columna info en desktop. */}
      <div className="mt-2 grid min-h-0 w-full flex-1 grid-cols-3 content-start justify-items-center gap-x-1.5 gap-y-2 overflow-y-auto overflow-x-clip px-0.5 py-0.5">
        {children}
      </div>
    </div>
  );
}

export function PartyIcon({
  spriteUrl,
  name,
  fainted,
  active,
  hpPct,
  compact = false,
  level,
  types,
  isShiny = false,
  reviving = false,
  reviveFx = null,
  onSelect,
  selectHint,
}: {
  spriteUrl: string;
  name: string;
  fainted: boolean;
  active: boolean;
  hpPct?: number;
  compact?: boolean;
  level?: number;
  types?: string[];
  isShiny?: boolean;
  /** Pulso / FX al reanimar desde la mochila de batalla. */
  reviving?: boolean;
  reviveFx?: { kind: "heal" | "revive"; itemName: string; label: string } | null;
  /** Abrir cambio / info rápida. */
  onSelect?: () => void;
  selectHint?: string;
}) {
  const t = useTranslations("battle");
  const typeLine = types?.length ? types.join(" / ") : "";
  const detail =
    [
      name,
      level != null ? `Nv. ${level}` : null,
      typeof hpPct === "number" ? `${Math.round(hpPct)}%` : null,
      isShiny ? t("shinyBadge") : null,
      typeLine || null,
      onSelect ? selectHint : null,
    ]
      .filter(Boolean)
      .join(" · ");

  // Durante el FX: si todavía no “despertó” (hp 0), se ve gris pero sin skull
  // tapando el ícono; cuando sube el HP a mitad de animación, vuelve el color.
  const lookFainted = fainted && !reviving;
  const waking = reviving && fainted;

  const shellClass = compact
    ? `relative z-[1] flex min-w-0 flex-1 ${PARTY_CHIP_CAP} flex-col items-center gap-0.5 md:gap-1 ${lookFainted ? "opacity-55" : ""} ${reviving ? "z-20" : ""}`
    : `relative z-[1] flex w-full max-w-[4.75rem] shrink-0 flex-col items-center gap-0.5 ${lookFainted ? "opacity-55" : ""} ${reviving ? "z-20" : ""}`;

  const body = (
    <>
      <div
        className={
          compact
            ? `relative flex aspect-square w-full min-h-[2.35rem] items-center justify-center rounded-md md:min-h-[4.5rem] md:rounded-lg ${
                reviving ? "overflow-visible" : "overflow-hidden"
              } ${
                active
                  ? "bg-primary/15 ring-1 ring-primary/70 shadow-[0_0_10px_color-mix(in_srgb,var(--color-pokeball-red)_30%,transparent)]"
                  : "bg-white/[0.04] md:bg-white/[0.06]"
              } ${reviving ? "party-icon--reviving" : ""}`
            : `relative flex aspect-square w-full items-center justify-center ${
                active ? "rounded-md ring-1 ring-primary/50" : ""
              } ${reviving ? "party-icon--reviving overflow-visible" : ""}`
        }
      >
        {spriteUrl ? (
          <Image
            src={spriteUrl}
            alt={name}
            width={compact ? 72 : 56}
            height={compact ? 72 : 56}
            className={`object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
              compact ? "h-[94%] w-[94%] md:h-[90%] md:w-[90%]" : "h-[92%] w-[92%]"
            } ${lookFainted || waking ? "grayscale-[0.55]" : ""} ${
              reviving ? "party-icon__sprite--waking" : ""
            }`}
          />
        ) : (
          <PokeballIcon className={compact ? "h-4 w-4 opacity-40 md:h-6 md:w-6" : "h-5 w-5 opacity-40"} />
        )}
        {isShiny && !lookFainted && !waking ? (
          <span className="absolute left-0.5 top-0.5 md:left-1 md:top-1">
            <ShinyMark className="h-2.5 w-2.5 md:h-3.5 md:w-3.5" title={t("shinyBadge")} />
          </span>
        ) : null}
        {lookFainted ? (
          <span
            className={`material-symbols-outlined absolute right-0 top-0 text-error drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${
              compact ? "text-[9px]! md:text-[12px]!" : "text-[11px]!"
            }`}
          >
            skull
          </span>
        ) : null}
        {reviving && reviveFx ? (
          <BattleItemUseFx
            kind={reviveFx.kind}
            itemName={reviveFx.itemName}
            label={reviveFx.label}
            size="party"
          />
        ) : null}
      </div>
      {typeof hpPct === "number" && !lookFainted && !waking ? (
        <PartyHpLine
          hpPct={hpPct}
          thick={!compact}
          className={
            compact
              ? "mx-[8%] w-[84%] md:mx-[6%] md:w-[88%] [&_.party-hp__track]:md:h-[0.38rem]"
              : "w-[92%]"
          }
        />
      ) : (
        <PartyHpEmpty
          fainted={lookFainted || waking}
          className={compact ? "mx-[8%] w-[84%] md:mx-[6%] md:w-[88%]" : "w-[92%]"}
        />
      )}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        title={detail}
        aria-label={detail}
        onClick={onSelect}
        className={`${shellClass} cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary`}
      >
        {body}
      </button>
    );
  }

  return (
    <div title={detail} aria-label={detail} className={shellClass}>
      {body}
    </div>
  );
}

/**
 * Slot vacío del equipo. Usa la pokeball HD (misma arte que la mochila) en vez
 * del SVG plano: al 20% de opacidad ese SVG quedaba como un punto gris sin
 * lectura. Acá va apagada pero reconocible — se entiende que es un lugar libre,
 * no un elemento roto.
 */
export function EmptyPartySlot({ compact = false }: { compact?: boolean }) {
  const ball = (
    <Image
      src="/items/hd/poke-ball.png"
      alt=""
      width={40}
      height={40}
      className="h-full w-full object-contain opacity-30 saturate-[0.35] drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
      unoptimized
    />
  );

  // Sin Pokémon no hay HP que mostrar: la barra vacía sugería un slot ocupado
  // al 0% (o sea, uno debilitado), que es justo lo contrario de "está libre".
  if (compact) {
    return (
      <div className={`flex min-w-0 flex-1 ${PARTY_CHIP_CAP} flex-col items-center`}>
        <div className="flex aspect-square w-full min-h-[2.35rem] items-center justify-center rounded-md border border-dashed border-white/[0.08] bg-white/[0.02] p-1 md:min-h-[4.5rem] md:rounded-lg md:p-2">
          {ball}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-[5.25rem] max-w-full shrink-0 flex-col items-center">
      <div className="flex aspect-square w-full items-center justify-center p-[22%]">
        {ball}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("battle");
  if (!isStatusCondition(status)) return null;

  const tone =
    status === "POISON"
      ? "poison"
      : status === "BURN"
        ? "burn"
        : status === "PARALYSIS"
          ? "paralysis"
          : status === "FREEZE"
            ? "freeze"
            : "sleep";

  return (
    <span
      className={`battle-status-badge battle-status-badge--${tone}`}
      title={t(statusLabelKey(status))}
      aria-label={t(statusLabelKey(status))}
    >
      {t(statusAbbrKey(status))}
    </span>
  );
}

/** Chips de stat subido/bajado. Sin esto, un Growl repetido solo dejaba una
 *  línea vieja en el log y el jugador no sabía cuánto acumuló. */
function StageBadges({ stages, align }: { stages: StatStages; align: "left" | "right" }) {
  const tLog = useTranslations("battle.log");
  const active = BATTLE_STATS.filter((stat) => stages[stat] !== 0);
  if (active.length === 0) return null;

  return (
    <div className={`mt-0.5 flex flex-wrap gap-1 ${align === "right" ? "justify-end" : ""}`}>
      {active.map((stat) => {
        const value = stages[stat];
        const up = value > 0;
        const label = tLog(statLabelKey(stat));
        return (
          <span
            key={stat}
            className={`rounded-md px-1 text-[8px] font-bold uppercase leading-tight tabular-nums md:text-[9px] ${
              up
                ? "bg-electric-yellow/20 text-electric-yellow"
                : "bg-error/20 text-error"
            }`}
            title={`${label} ${up ? "+" : ""}${value}`}
          >
            {label.slice(0, 3)} {up ? "▲" : "▼"}
            {Math.abs(value)}
          </span>
        );
      })}
    </div>
  );
}

export function HpPlate({
  name,
  levelLabel,
  currentHp,
  maxHp,
  status,
  stages,
  isShiny = false,
  align = "left",
  className = "",
}: {
  name: string;
  levelLabel: string;
  currentHp: number;
  maxHp: number;
  status?: string | null;
  stages?: StatStages;
  isShiny?: boolean;
  align?: "left" | "right";
  className?: string;
}) {
  const t = useTranslations("battle");
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  const hpClass = hpTone(hpPct);
  const critical = hpPct > 0 && hpPct <= 20;

  return (
    <div
      className={`hp-plate${align === "right" ? " hp-plate--mirror" : ""}${
        critical ? " hp-plate--critical" : ""
      }${isShiny ? " hp-plate--shiny" : ""} ${className}`}
    >
      <div className="hp-plate__shell">
        <div className="hp-plate__panel">
          <div className="hp-plate__content">
            <div
              className={`flex items-center gap-1.5 md:gap-2 ${
                align === "right" ? "flex-row-reverse" : ""
              }`}
            >
              <span className="min-w-0 truncate text-[11px] font-bold capitalize tracking-tight text-white md:text-[16px] lg:text-[19px] lg:leading-tight">
                {name}
              </span>
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/55 md:text-[12px] lg:text-[13px]">
                {levelLabel}
              </span>
              {isShiny ? (
                <ShinyMark
                  className="h-3.5 w-3.5 md:h-[1.05rem] md:w-[1.05rem]"
                  title={t("shinyBadge")}
                />
              ) : null}
              {status ? <StatusBadge status={status} /> : null}
            </div>

            {/*
              En desktop la barra deja de ser una franja suelta: se lee como
              "PS ▬▬▬▬ 108/108" en una sola línea, con los números grandes al
              lado. Abajo de lg queda el layout apilado de siempre.
            */}
            <div
              className={`hp-plate__row ${
                align === "right" ? "lg:flex-row-reverse" : ""
              }`}
            >
              <span className="hp-plate__hp-label" aria-hidden>
                {t("hp")}
              </span>
              <div className="hp-plate__bar">
                <div className="hp-plate__bar-track">
                  <div
                    className={`hp-plate__bar-fill health-bar-fill ${hpClass}${
                      critical ? " hp-bar-critical" : ""
                    }`}
                    style={{ width: `${hpPct}%` }}
                  />
                  <span className="hp-plate__bar-ticks" aria-hidden />
                  <span className="hp-plate__bar-sheen" aria-hidden />
                </div>
              </div>
              <span
                className={`hp-plate__hp-count ${critical ? "text-error" : "text-white"}`}
              >
                <span className="hp-plate__hp-cur">{currentHp}</span>
                <span className="hp-plate__hp-sep">/</span>
                <span className="hp-plate__hp-max">{maxHp}</span>
              </span>
            </div>

            {/* Hasta md: porcentaje + valores en una línea aparte. */}
            <p
              className={`mt-0.5 text-[9px] font-semibold tabular-nums tracking-wide md:text-[12px] lg:hidden ${
                align === "right" ? "text-right" : ""
              } ${critical ? "text-error" : "text-white/60"}`}
            >
              {Math.round(hpPct)}% · {currentHp}/{maxHp}
            </p>
            {stages ? <StageBadges stages={stages} align={align} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="text-label-md font-bold text-on-surface">{value}</p>
    </div>
  );
}
