"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { typeColor } from "@/lib/type-colors";
import { useTypeLabel } from "@/hooks/use-type-label";
import { itemHdIconUrl, itemSpriteUrl } from "@/lib/item-sprites";

/**
 * La card grande de un Pokémon: fondo teñido por su tipo, marca de agua de
 * pokébola, fila de chapas, sprite con sombra, y debajo la identidad
 * (nombre, especie, número de dex, tipos).
 *
 * Vivía escrita a mano dentro de `team-roster`, así que la ficha flotante que
 * se abre desde el equipo activo en Home mostraba otra cosa: un encabezado de
 * texto y el sprite pelado. Ahora las dos superficies renderizan este mismo
 * componente y lo único que cambia es qué va en `children` (las pestañas
 * ABOUT / STATS / EVO, el panel de puntos, etc.).
 */
export type ShowcaseBadges = {
  /** "Slot 3". */
  slot?: string | null;
  /** "Líder" — se pinta en rojo pokébola. */
  lead?: string | null;
  level: string;
  favorite?: string | null;
  shiny?: string | null;
  tradeLocked?: string | null;
  /**
   * Etiqueta de "puede evolucionar". Si es `""` se muestra solo el ícono, que
   * es lo que hacen las cards chicas por falta de espacio.
   */
  canEvolve?: string | null;
  /** Nombre visible del held (tooltip). */
  heldItem?: string | null;
  /** Nombre canónico del seed para el ícono HD (`Exp. Share`, …). */
  heldItemName?: string | null;
};

export function PokemonShowcaseCard({
  speciesId,
  speciesName,
  nickname,
  types,
  spriteUrl,
  fainted = false,
  faintedLabel,
  accentBorder = false,
  badges,
  interactive = true,
  flush = false,
  overlay,
  className = "",
  spriteClassName = "",
  children,
}: {
  speciesId: number;
  speciesName: string;
  nickname?: string | null;
  types: string[];
  spriteUrl: string | null;
  fainted?: boolean;
  faintedLabel?: string;
  /** Borde rojo del líder / favorito. */
  accentBorder?: boolean;
  badges: ShowcaseBadges;
  /** En la ficha modal no queremos que el hover levante el diálogo entero. */
  interactive?: boolean;
  /**
   * Sin borde ni esquinas propias: para cuando el contenedor ya las pone —el
   * diálogo de Home recorta y redondea él mismo, y dos bordes concéntricos se
   * ven como un error.
   */
  flush?: boolean;
  /** Se posiciona sobre el héroe — hoy, el botón de cerrar de la ficha. */
  overlay?: ReactNode;
  className?: string;
  /** Para engancharle la animación de entrada del sprite. */
  spriteClassName?: string;
  children?: ReactNode;
}) {
  const displayName = nickname ?? speciesName;
  const accent = typeColor(types[0] ?? "normal");
  const typeLabel = useTypeLabel();

  return (
    <article
      className={[
        "team-card group relative overflow-hidden",
        flush ? "" : "rounded-[1.5rem] border",
        flush
          ? ""
          : accentBorder
            ? "border-pokeball-red/35 shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
            : `border-white/[0.07] ${interactive ? "hover:border-white/20" : ""}`,
        interactive ? "transition duration-300 hover:-translate-y-1" : "",
        fainted ? "opacity-75" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--type-accent": accent } as CSSProperties}
    >
      {overlay}

      <div className="relative flex min-h-[120px] w-full flex-col items-center justify-end px-3 pb-0 pt-7 text-left sm:min-h-[156px] sm:pt-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 95% 75% at 50% 38%, ${accent}70 0%, transparent 70%)`,
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[40%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.08] sm:h-40 sm:w-40"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, transparent 36%, currentColor 37%, currentColor 48%, transparent 49%)",
            color: accent,
          }}
          aria-hidden
        />

        <div className="absolute left-3 top-3 z-[2] flex max-w-[calc(100%-3rem)] flex-wrap items-center gap-1">
          {badges.slot ? (
            <span className="rounded-full border border-white/12 bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/60 backdrop-blur-sm">
              {badges.slot}
            </span>
          ) : null}
          {badges.lead ? (
            <span className="ui-chip ui-chip--accent rounded-full text-[9px]">
              {badges.lead}
            </span>
          ) : null}
          <span className="rounded-full border border-white/15 bg-black/45 px-2 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur-sm">
            {badges.level}
          </span>
          {badges.favorite ? (
            <span
              title={badges.favorite}
              className="inline-flex items-center rounded-full border border-electric-yellow/35 bg-black/45 px-1.5 py-0.5 text-electric-yellow backdrop-blur-sm"
            >
              <span className="material-symbols-outlined ms-fill text-[11px]! leading-none">
                star
              </span>
            </span>
          ) : null}
          {badges.shiny ? (
            <span
              title={badges.shiny}
              className="inline-flex items-center gap-0.5 rounded-full border border-electric-yellow/40 bg-electric-yellow/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-electric-yellow backdrop-blur-sm"
            >
              <span className="material-symbols-outlined text-[11px]! leading-none">
                auto_awesome
              </span>
              {badges.shiny}
            </span>
          ) : null}
          {badges.tradeLocked ? (
            <span
              title={badges.tradeLocked}
              className="inline-flex items-center rounded-full border border-white/15 bg-black/45 px-1.5 py-0.5 text-white/55 backdrop-blur-sm"
            >
              <span className="material-symbols-outlined text-[11px]! leading-none">lock</span>
            </span>
          ) : null}
          {badges.canEvolve != null ? (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-tertiary/40 bg-tertiary/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-tertiary backdrop-blur-sm">
              <span className="material-symbols-outlined text-[11px]! leading-none">
                auto_awesome
              </span>
              {badges.canEvolve}
            </span>
          ) : null}
          {badges.heldItem || badges.heldItemName ? (
            <span
              title={badges.heldItem ?? badges.heldItemName ?? undefined}
              className="inline-flex items-center rounded-full border border-white/15 bg-black/50 p-0.5 backdrop-blur-sm"
            >
              <Image
                src={
                  itemHdIconUrl(badges.heldItemName ?? "Exp. Share") ??
                  itemSpriteUrl(badges.heldItemName ?? "Exp. Share")
                }
                alt=""
                width={18}
                height={18}
                unoptimized
                className="h-[18px] w-[18px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
              />
            </span>
          ) : null}
        </div>

        <div className="relative z-[1] flex h-[100px] w-full items-end justify-center sm:h-[128px]">
          <div
            className="absolute bottom-1 h-9 w-24 rounded-[100%] opacity-55 blur-xl transition group-hover:opacity-75"
            style={{ background: accent }}
          />
          <div className="absolute bottom-2 h-3 w-[4.5rem] rounded-[100%] bg-black/45 blur-sm" />
          {spriteUrl ? (
            <Image
              src={spriteUrl}
              alt={speciesName}
              width={128}
              height={128}
              className={[
                "relative z-[1] h-[100px] w-[100px] object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.6)] transition duration-300 sm:h-32 sm:w-32",
                interactive ? "group-hover:-translate-y-2 group-hover:scale-105" : "",
                fainted ? "grayscale" : "",
                spriteClassName,
              ]
                .filter(Boolean)
                .join(" ")}
            />
          ) : (
            <span className="material-symbols-outlined relative z-[1] text-[52px]! text-white/25">
              sports_baseball
            </span>
          )}
        </div>
      </div>

      <div className="relative z-[1] bg-gradient-to-b from-transparent to-black/25 px-3 pb-3 pt-1">
        <div className="text-center">
          <h2 className="truncate text-[16px] font-bold capitalize leading-tight tracking-tight text-white">
            {displayName}
          </h2>
          {nickname ? (
            <p className="mt-0.5 text-[10px] capitalize text-white/45">{speciesName}</p>
          ) : null}
          <p className="mt-0.5 font-mono text-[10px] text-white/35">
            #{String(speciesId).padStart(3, "0")}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
            {types.map((type) => (
              <span
                key={type}
                className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ color: typeColor(type) }}
              >
                {typeLabel(type)}
              </span>
            ))}
            {fainted && faintedLabel ? (
              <span className="rounded-full bg-error/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-error">
                {faintedLabel}
              </span>
            ) : null}
          </div>
        </div>

        {children}
      </div>
    </article>
  );
}
