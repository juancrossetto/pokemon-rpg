"use client";

import Image from "next/image";
import { useState } from "react";

import { AvatarPicker, type AvatarPickerLabels } from "@/components/avatar-picker";
import { BannerPicker, type BannerPickerLabels } from "@/components/banner-picker";
import { FramePicker, type FramePickerLabels } from "@/components/frame-picker";
import { TrainerProfileScene } from "@/components/profile/trainer-profile-scene";
import { TrainerCpArc } from "@/components/profile/trainer-cp-arc";
import { PvpRankBadge } from "@/components/pvp/pvp-rank-badge";
import { avatarById } from "@/lib/avatars";
import { homeBannerById } from "@/lib/home-banners";
import { homeFrameById } from "@/lib/home-frames";
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
  country: _country,
  rankPct,
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
  currentFrameId,
  avatarLabels,
  bannerLabels,
  frameLabels,
  labels,
}: {
  username: string;
  /** Especie del compañero, sin adornos: va sola bajo el nombre. */
  companionLine: string | null;
  sceneLabel: string;
  country: string;
  /** 0–1 — alimenta el arco alrededor del PC. */
  rankPct: number;
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
  currentFrameId: string | null;
  avatarLabels: AvatarPickerLabels;
  bannerLabels: BannerPickerLabels;
  frameLabels: FramePickerLabels;
  labels: IdentityHeroLabels;
}) {
  /*
    Retrato / banner / marco optimistas. El servidor tarda en devolver el valor
    nuevo porque el guardado revalida el layout entero; mientras tanto el
    jugador ya eligió y espera verlo.
  */
  const [pickedAvatarId, setPickedAvatarId] = useState<string | null>(null);
  const [pickedBannerId, setPickedBannerId] = useState<string | null>(null);
  const [pickedFrameId, setPickedFrameId] = useState<string | null>(null);
  const avatarId = pickedAvatarId ?? currentAvatarId;
  const bannerId = pickedBannerId ?? currentBannerId;
  const frameId = pickedFrameId ?? currentFrameId;
  const bannerSrc = homeBannerById(bannerId).src;
  const frame = homeFrameById(frameId);
  const spriteUrl = pickedAvatarId
    ? (avatarById(pickedAvatarId)?.stageSrc ?? trainerSpriteUrl)
    : trainerSpriteUrl;

  return (
    <section
      /*
        Sin `overflow-hidden` ni borde propio: las volutas del marco sobresalen
        del rectángulo y un recorte con esquinas redondeadas les comía las
        puntas. Del paisaje se encarga la capa de arte, que tiene su propio
        radio y su propio clip. `homeFrameById` siempre devuelve un marco, así
        que este banner nunca corre sin él.
      */
      className="tp-hero tp-hero--bannered home-identity--framed relative"
      style={
        {
          "--hero-accent": companionAccent,
          "--id-grad-from": gradientFrom,
          "--id-grad-to": gradientTo,
          "--hi-frame-src": `url("${frame.src}")`,
          "--hi-frame-slice": String(frame.slice),
          "--hi-rail-top": String(frame.rails.top),
          "--hi-rail-bottom": String(frame.rails.bottom),
          "--hi-rail-left": String(frame.rails.left),
          "--hi-rail-right": String(frame.rails.right),
        } as React.CSSProperties
      }
    >
      {/*
        Paisaje y velos van dentro de la capa de arte, igual que en el home: con
        marco, la capa se retrae hasta la línea de los rieles y el marco RODEA
        el banner en vez de dibujarse encima. Ver `.home-identity__art`.
      */}
      <div aria-hidden className="home-identity__art z-0">
        <Image
          src={bannerSrc}
          alt=""
          fill
          priority
          /* Mismo criterio que el home: no recomprimir el JPG del banner. */
          unoptimized
          sizes="(max-width: 1280px) 100vw, 1200px"
          className="object-cover object-[center_40%]"
        />
        {/* Capas del fondo. Ver `.tp-hero__*` en globals.css. */}
        <span className="tp-hero__wash" />
        <span className="tp-hero__sweep" />
        <span className="tp-hero__grid" />
        <span className="tp-hero__scanline" />
        <span className="tp-hero__vignette" />
      </div>

      <div aria-hidden className="home-identity__marco" />

      <div className="tp-hero__body relative z-[1]">
        {/* Cabecera editorial: nombre → liga PvP → metadatos. Ver `.tp-id__*`. */}
        <div className="tp-id mb-0.5 text-center">
          <h1 className="tp-id__name">
            <span className="tp-id__name-core">
              <span className="tp-id__name-text truncate">{username}</span>
              <span className="tp-id__name-trail">
                <span
                  className="tp-id__badge group relative inline-flex shrink-0 outline-none"
                  tabIndex={0}
                  aria-label={rankLabel}
                >
                  <PvpRankBadge
                    tier={pvpTier}
                    division={pvpDivision}
                    label={pvpTierLabel}
                    size="md"
                    className="shrink-0 drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]"
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

          {/* Mismo eje que el nombre: centrado debajo, sin que la insignia lo desplace. */}
          <TrainerCpArc
            label={labels.power}
            value={power}
            pct={rankPct}
            from={gradientFrom}
            to={gradientTo}
            mode="value"
          />

          {/*
            Nivel y compañero en texto plano + sombra: sin chip de vidrio, el
            protagonismo queda en nombre, insignia y PC.
          */}
          <p className="tp-id__meta">
            <span className="tp-id__meta-item tp-id__meta-item--level">
              <span className="tp-id__meta-key">{labels.level}</span>
              <span className="tp-id__meta-num">{topLevel}</span>
            </span>
            {companionLine ? (
              <span className="tp-id__meta-item tp-id__meta-item--companion">
                {companionSpriteUrl ? (
                  <Image
                    src={companionSpriteUrl}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="tp-id__meta-sprite"
                    aria-hidden
                  />
                ) : null}
                {companionLine}
              </span>
            ) : null}
          </p>
        </div>

        <div className="relative mx-auto max-w-2xl">
          <TrainerCpArc
            label={labels.power}
            value={power}
            pct={rankPct}
            from={gradientFrom}
            to={gradientTo}
            mode="arc"
          />
          <div className="relative z-[2] pt-1 sm:pt-1.5">
            <TrainerProfileScene
              username={username}
              trainerSpriteUrl={spriteUrl}
              avatarId={avatarId}
              companionSpriteUrl={companionSpriteUrl}
              companionName={companionName}
              accent={companionAccent}
              appearance={appearance}
              sceneLabel={sceneLabel}
            />
          </div>
        </div>
      </div>

      {/* Los botones de edición van dentro del arte, no sobre el marco: su
          posición sale de los mismos rieles que retraen el paisaje. Ver
          `.tp-hero__tools`. */}
      {canEdit && (
        <div className="tp-hero__tools absolute z-20 flex flex-col gap-1.5">
          <BannerPicker
            currentBannerId={bannerId}
            labels={bannerLabels}
            showAffordance={false}
            onSaved={setPickedBannerId}
          >
            <span className="flex h-9 w-11 items-center justify-center rounded-lg border border-white/12 bg-black/25 text-white/80 shadow-md backdrop-blur-sm transition hover:border-white/30 hover:bg-black/40 hover:text-white sm:h-10 sm:w-12">
              <span className="material-symbols-outlined text-[18px]!">imagesmode</span>
            </span>
          </BannerPicker>
          <FramePicker
            currentFrameId={frameId}
            labels={frameLabels}
            showAffordance={false}
            onSaved={setPickedFrameId}
          >
            <span className="flex h-9 w-11 items-center justify-center rounded-lg border border-white/12 bg-black/25 text-white/80 shadow-md backdrop-blur-sm transition hover:border-white/30 hover:bg-black/40 hover:text-white sm:h-10 sm:w-12">
              <span className="material-symbols-outlined text-[18px]!">border_style</span>
            </span>
          </FramePicker>
          <AvatarPicker
            currentAvatarId={avatarId}
            labels={avatarLabels}
            showAffordance={false}
            onSaved={setPickedAvatarId}
          >
            <span className="flex h-9 w-11 items-center justify-center rounded-lg border border-white/12 bg-black/25 text-white/80 shadow-md backdrop-blur-sm transition hover:border-white/30 hover:bg-black/40 hover:text-white sm:h-10 sm:w-12">
              <span className="material-symbols-outlined text-[18px]!">edit</span>
            </span>
          </AvatarPicker>
        </div>
      )}
    </section>
  );
}
