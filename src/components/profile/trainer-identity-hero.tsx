"use client";

import Image from "next/image";
import { useState } from "react";

import { FlagIcon } from "@/components/flag-icon";
import { AvatarPicker, type AvatarPickerLabels } from "@/components/avatar-picker";
import { BannerPicker, type BannerPickerLabels } from "@/components/banner-picker";
import { TrainerProfileScene } from "@/components/profile/trainer-profile-scene";
import { TrainerCpArc } from "@/components/profile/trainer-cp-arc";
import { PvpRankBadge } from "@/components/pvp/pvp-rank-badge";
import { avatarById } from "@/lib/avatars";
import { homeBannerById } from "@/lib/home-banners";
import type { TrainerAppearance } from "@/lib/trainer-appearance";
import type { PvpDivision, PvpTier } from "@/lib/pvp/tiers";

export type IdentityHeroLabels = {
  power: string;
  level: string;
};

/**
 * Banner de identidad: nombre, compañero, PC y la escena. Nada más.
 *
 * Antes cargaba también las chapas de título y rango, la barra de progreso de
 * medallas y la fecha de inicio. Todo eso vive ahora en la ficha del entrenador
 * —una fila por dato— y acá sobraba: el banner es el retrato de la cuenta, no
 * su planilla. Sin esa columna de datos, la escena puede ir centrada y ocupar
 * el ancho completo, que es para lo que está.
 */
export function TrainerIdentityHero({
  username,
  companionLine,
  sceneLabel,
  country,
  rankPct,
  rankAccent,
  rankLabel,
  pvpTier,
  pvpDivision,
  pvpTierLabel,
  gradientFrom,
  gradientTo,
  topLevel,
  power,
  trainerSpriteUrl,
  companionSpriteUrl,
  companionName,
  companionAccent,
  appearance,
  canEdit,
  currentAvatarId,
  currentBannerId,
  avatarLabels,
  bannerLabels,
  labels,
}: {
  username: string;
  /** Especie del compañero, sin adornos: va sola bajo el nombre. */
  companionLine: string | null;
  sceneLabel: string;
  country: string;
  /** 0–1 — alimenta el arco alrededor del PC. */
  rankPct: number;
  rankAccent: string;
  /** Liga clasificatoria ya traducida ("Principiante I"…). */
  rankLabel: string;
  pvpTier: PvpTier;
  pvpDivision: PvpDivision;
  pvpTierLabel: string;
  /** Extremos del degradé del nombre, derivados de los tipos del compañero. */
  gradientFrom: string;
  gradientTo: string;
  topLevel: number;
  power: number;
  trainerSpriteUrl: string | null;
  companionSpriteUrl: string | null;
  companionName: string | null;
  companionAccent: string;
  appearance?: TrainerAppearance | null;
  canEdit: boolean;
  currentAvatarId: string | null;
  currentBannerId: string | null;
  avatarLabels: AvatarPickerLabels;
  bannerLabels: BannerPickerLabels;
  labels: IdentityHeroLabels;
}) {
  /*
    Retrato / banner optimistas. El servidor tarda en devolver el valor nuevo
    porque el guardado revalida el layout entero; mientras tanto el jugador ya
    eligió y espera verlo.
  */
  const [pickedAvatarId, setPickedAvatarId] = useState<string | null>(null);
  const [pickedBannerId, setPickedBannerId] = useState<string | null>(null);
  const avatarId = pickedAvatarId ?? currentAvatarId;
  const bannerId = pickedBannerId ?? currentBannerId;
  const bannerSrc = homeBannerById(bannerId).src;
  const spriteUrl = pickedAvatarId
    ? (avatarById(pickedAvatarId)?.stageSrc ?? trainerSpriteUrl)
    : trainerSpriteUrl;

  return (
    <section
      className="tp-hero tp-hero--bannered relative overflow-hidden rounded-[1.75rem] border border-white/8"
      style={
        {
          "--hero-accent": companionAccent,
          "--id-grad-from": gradientFrom,
          "--id-grad-to": gradientTo,
        } as React.CSSProperties
      }
    >
      <div aria-hidden className="absolute inset-0 z-0">
        <Image
          src={bannerSrc}
          alt=""
          fill
          priority
          quality={90}
          sizes="(max-width: 1280px) 100vw, 960px"
          className="object-cover object-[center_40%]"
        />
      </div>
      {/* Capas del fondo. Ver `.tp-hero__*` en globals.css. */}
      <span aria-hidden className="tp-hero__wash" />
      <span aria-hidden className="tp-hero__sweep" />
      <span aria-hidden className="tp-hero__grid" />
      <span aria-hidden className="tp-hero__scanline" />
      <span aria-hidden className="tp-hero__vignette" />

      <div className="relative z-[1] px-3 pb-6 pt-6 sm:px-5 sm:pt-7">
        {/* Cabecera editorial: nombre → liga PvP → metadatos. Ver `.tp-id__*`. */}
        <div className="tp-id mb-1 text-center">
          <h1 className="tp-id__name">
            <span className="tp-id__name-core">
              <span className="tp-id__name-text truncate">{username}</span>
              <span className="tp-id__name-trail">
                <FlagIcon code={country} className="tp-id__flag" />
                <span
                  className="tp-id__badge group relative inline-flex shrink-0 outline-none"
                  tabIndex={0}
                  aria-label={rankLabel}
                >
                  <PvpRankBadge
                    tier={pvpTier}
                    division={pvpDivision}
                    label={pvpTierLabel}
                    size="sm"
                    className="shrink-0"
                  />
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-black/90 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/85 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
                  >
                    {rankLabel}
                  </span>
                </span>
              </span>
            </span>
          </h1>

          <p className="tp-id__meta">
            <span className="tp-id__meta-item">
              <span className="tp-id__meta-key">{labels.level}</span>
              <span className="tp-id__meta-num">{topLevel}</span>
            </span>
            {companionLine ? (
              <>
                <span aria-hidden className="tp-id__meta-sep" />
                <span className="tp-id__meta-item tp-id__meta-item--companion">
                  {companionLine}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <div className="relative mx-auto max-w-2xl">
          <TrainerCpArc
            label={labels.power}
            value={power}
            pct={rankPct}
            color={rankAccent}
          />
          {/* Aire arriba para el PC y el arco: la escena alinea abajo, así que
              el padding empuja el techo sin mover los pies. */}
          <div className="pt-[3.4rem] sm:pt-[3.8rem]">
            <TrainerProfileScene
              username={username}
              trainerSpriteUrl={spriteUrl}
              companionSpriteUrl={companionSpriteUrl}
              companionName={companionName}
              accent={companionAccent}
              appearance={appearance}
              sceneLabel={sceneLabel}
            />
          </div>
          {canEdit && (
            <div className="absolute bottom-0 right-0 z-10 flex flex-col gap-2">
              <BannerPicker
                currentBannerId={bannerId}
                labels={bannerLabels}
                showAffordance={false}
                onSaved={setPickedBannerId}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#14161c]/95 text-on-surface-variant shadow-lg backdrop-blur-md transition hover:border-white/40 hover:text-white">
                  <span className="material-symbols-outlined text-[18px]!">wallpaper</span>
                </span>
              </BannerPicker>
              <AvatarPicker
                currentAvatarId={avatarId}
                labels={avatarLabels}
                showAffordance={false}
                onSaved={setPickedAvatarId}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#14161c]/95 text-on-surface-variant shadow-lg backdrop-blur-md transition hover:border-white/40 hover:text-white">
                  <span className="material-symbols-outlined text-[18px]!">edit</span>
                </span>
              </AvatarPicker>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
