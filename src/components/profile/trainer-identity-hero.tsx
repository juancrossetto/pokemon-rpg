"use client";

import { useState } from "react";

import { FlagIcon } from "@/components/flag-icon";
import { AvatarPicker, type AvatarPickerLabels } from "@/components/avatar-picker";
import { TrainerProfileScene } from "@/components/profile/trainer-profile-scene";
import { TrainerCpArc } from "@/components/profile/trainer-cp-arc";
import { avatarById } from "@/lib/avatars";
import type { TrainerAppearance } from "@/lib/trainer-appearance";

export type IdentityHeroLabels = {
  power: string;
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
  power,
  trainerSpriteUrl,
  companionSpriteUrl,
  companionName,
  companionAccent,
  appearance,
  canEdit,
  currentAvatarId,
  avatarLabels,
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
  power: number;
  trainerSpriteUrl: string | null;
  companionSpriteUrl: string | null;
  companionName: string | null;
  companionAccent: string;
  appearance?: TrainerAppearance | null;
  canEdit: boolean;
  currentAvatarId: string | null;
  avatarLabels: AvatarPickerLabels;
  labels: IdentityHeroLabels;
}) {
  /*
    Retrato optimista. El servidor tarda en devolver el avatar nuevo porque el
    guardado revalida el layout entero; mientras tanto el jugador ya eligió y
    espera verlo. Este estado local pinta el cambio en el acto y el render del
    servidor lo confirma después con el mismo valor.

    `null` = todavía no se tocó nada en esta sesión y manda lo que vino del
    servidor. El propio picker revierte llamando de nuevo si la escritura falla.
  */
  const [pickedAvatarId, setPickedAvatarId] = useState<string | null>(null);
  const avatarId = pickedAvatarId ?? currentAvatarId;
  const spriteUrl = pickedAvatarId
    ? (avatarById(pickedAvatarId)?.stageSrc ?? trainerSpriteUrl)
    : trainerSpriteUrl;

  return (
    <section
      className="tp-hero relative overflow-hidden rounded-[1.75rem] border border-white/8"
      style={{ ["--hero-accent" as string]: companionAccent }}
    >
      {/* Capas del fondo. Ver `.tp-hero__*` en globals.css. */}
      <span aria-hidden className="tp-hero__sweep" />
      <span aria-hidden className="tp-hero__grid" />
      <span aria-hidden className="tp-hero__scanline" />
      <span aria-hidden className="tp-hero__vignette" />

      <div className="relative px-3 pb-6 pt-5 sm:px-5">
        <div className="mb-1 text-center">
          <h1 className="flex items-center justify-center gap-2 text-[1.55rem] font-semibold leading-none tracking-[-0.03em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:text-[1.85rem]">
            <span className="truncate">{username}</span>
            <FlagIcon code={country} className="h-4 w-6 shrink-0 rounded-[2px] opacity-90" />
          </h1>
          {companionLine ? (
            <p className="mt-1.5 text-[11px] font-medium capitalize tracking-[0.08em] text-white/45">
              {companionLine}
            </p>
          ) : null}
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
            <div className="absolute bottom-0 right-0 z-10">
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
