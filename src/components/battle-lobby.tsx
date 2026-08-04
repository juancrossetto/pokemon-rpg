"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { HealButton } from "@/components/heal-button";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import { StartEncounterButton } from "@/components/start-encounter-button";
import { RegionMapDialog } from "@/components/region-map-dialog";
import { itemDisplayUrl } from "@/lib/item-sprites";
import { BattleLobbyMobile } from "@/components/battle-lobby-mobile";
import type { BattleLobbyData } from "@/lib/battle-lobby";
import { useTypeLabel } from "@/hooks/use-type-label";
import { HubHelpButton } from "@/components/journey-guidance";

/** Color del chip según la densidad de encuentros de la zona. */
const RATE_STYLE: Record<"low" | "medium" | "high", string> = {
  low: "border-white/20 bg-white/5 text-on-surface-variant",
  medium: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  high: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
};

export function BattleLobby({
  locale,
  hasHealthyTeam,
  lobby,
}: {
  locale: string;
  hasHealthyTeam: boolean;
  lobby: BattleLobbyData;
}) {
  const t = useTranslations("battle");
  const tc = useTranslations("campaign");
  const tUx = useTranslations("ux");
  const typeLabel = useTypeLabel();
  const canExplore = hasHealthyTeam && lobby.energy >= lobby.energyCost;
  const [squadHealed, setSquadHealed] = useState(false);
  const showSquadStatus = lobby.heal.hurtCount > 0 && !squadHealed;

  const startErrors = {
    no_lead: t("errors.noLead"),
    fainted_lead: t("errors.faintedLead"),
    no_energy: t("errors.noEnergy"),
    no_stage: tc("errors.noStage"),
    locked: tc("errors.stageLocked"),
  };

  const locationLabel = lobby.expedition
    ? tc(lobby.expedition.locationNameKey)
    : t("lobby.zoneName");
  const stageLabel = lobby.expedition
    ? tc(lobby.expedition.stageNameKey)
    : t("lobby.zoneTerrain");
  const predictedTypes = lobby.expedition?.predictedTypes ?? ["normal", "grass", "bug"];
  const mapSrc = lobby.expedition?.mapSrc;
  const regionNameKey = lobby.expedition?.regionNameKey ?? "regions.kanto";

  return (
    <>
      {/* Mobile y desktop son dos árboles distintos a propósito: la hero card
          fusiona bloques que en desktop viven separados, y eso cambia el
          anidamiento, no sólo el orden. Así el layout de escritorio queda
          exactamente como estaba. */}
      <div className="lg:hidden">
        <BattleLobbyMobile locale={locale} hasHealthyTeam={hasHealthyTeam} lobby={lobby} />
      </div>

    <div className="hidden flex-1 px-margin-mobile md:px-margin-desktop py-6 md:py-8 lg:block">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header>
          <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-emerald-400/90">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {t("lobby.liveSync")}
          </p>
          <h1 className="page-title text-headline-lg text-white md:text-display-lg">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-lg text-label-md text-on-surface-variant">
            {t("subtitle")}
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="glass-panel relative flex flex-col overflow-hidden p-4">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />
            <div className="relative flex flex-1 flex-col">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300/80">
                    {t("lobby.currentLocation")}
                  </p>
                  <h2 className="mt-0.5 text-headline-md text-white">{locationLabel}</h2>
                  <p className="text-label-sm text-on-surface-variant">{stageLabel}</p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${RATE_STYLE[lobby.encounterRate]}`}
                >
                  {tc(`encounterRate.${lobby.encounterRate}`)}
                </span>
              </div>

              {/* Mismo mapa y mismo selector que el dashboard. */}
              <div className="relative mb-4 min-h-[8rem] flex-1 overflow-hidden rounded-lg border border-white/10 bg-[#0b1424]">
                {mapSrc ? (
                  <Image
                    src={mapSrc}
                    alt=""
                    fill
                    className="object-cover object-center opacity-70"
                    sizes="600px"
                  />
                ) : null}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
                <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                  <span className="material-symbols-outlined text-[14px]!">zoom_out_map</span>
                  {tc("openMap")}
                </span>
                {mapSrc && (
                  <RegionMapDialog
                    locale={locale}
                    regionNameKey={regionNameKey}
                    mapSrc={mapSrc}
                    locations={lobby.mapLocations}
                    farmingLocationId={lobby.farmingLocationId}
                    farmingStageId={lobby.farmingStageId}
                    triggerLabel={tc("openMap")}
                  />
                )}
                <div className="absolute right-2 top-2 z-20">
                  <HubHelpButton
                    bullets={tUx.raw("help.battle") as string[]}
                    handbookChapter="battle"
                    roleKey="battle"
                  />
                </div>
              </div>

              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {t("lobby.predictedTypes")}
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {predictedTypes.map((type) => (
                  <span
                    key={type}
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{
                      background: `linear-gradient(135deg, ${typeColor(type)}, ${typeColor(type)}cc)`,
                    }}
                  >{typeLabel(type)}</span>
                ))}
              </div>

              {hasHealthyTeam ? (
                <StartEncounterButton
                  locale={locale}
                  label={t("explore")}
                  errors={startErrors}
                  disabled={!canExplore}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-label-md text-error">{t("errors.faintedLead")}</p>
                  <Link
                    href="/team"
                    className="game-cta game-cta--red"
                  >
                    <span className="material-symbols-outlined game-cta__icon">healing</span>
                    <span className="game-cta__label">{t("goHeal")}</span>
                  </Link>
                </div>
              )}
              {/* La barra de energía vive en el header global; acá sólo el coste. */}
              <p className="mt-2 text-center text-[10px] text-on-surface-variant">
                {t("lobby.energyHint", { cost: lobby.energyCost })}
              </p>
            </div>
          </section>

          <div className="flex flex-col gap-4">
            <section className="glass-panel p-3">
              <div className="flex items-stretch gap-2">
                <LoadoutChip
                  icon={
                    <Image
                      src={itemDisplayUrl("Poke Ball")}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain"
                    />
                  }
                  label={t("pokeballsLabel")}
                  value={lobby.balls}
                />
                <LoadoutChip
                  icon={
                    <Image
                      src={itemDisplayUrl("Potion")}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain"
                    />
                  }
                  label={t("potionsLabel")}
                  value={lobby.potions}
                />
              </div>
              {lobby.unspentTotal > 0 && (
                <Link
                  href="/team"
                  className="mt-2 flex items-center gap-1 px-0.5 text-[11px] text-tertiary/90 transition hover:text-tertiary"
                >
                  <span className="material-symbols-outlined text-[14px]!">bolt</span>
                  <span className="min-w-0 flex-1 truncate">
                    {t("lobby.unspentPoints", { count: lobby.unspentTotal })}
                  </span>
                  <span className="material-symbols-outlined text-[14px]!">chevron_right</span>
                </Link>
              )}
            </section>

            {/*
              Centro Pokémon, en lugar de los accesos directos y del listado
              del equipo.

              Gimnasios, PvP y Equipo ya están a un click en el navbar. Y el
              escuadrón completo se ve en Inicio y en Equipo: repetirlo acá
              sería la cuarta pantalla con la misma información. Lo que **no**
              existe en ningún otro lado es poder curar sin salir del lugar
              donde farmeás, así que el panel se queda solo con eso.

              Aparece únicamente si hay alguien herido: con el equipo entero no
              hay nada que decidir y el bloque no se dibuja.
            */}
            {showSquadStatus && (
              <section className="flex items-center gap-3 rounded-2xl border border-white/10 bg-surface-container-high/70 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="min-w-0 flex-1 self-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                    {t("lobby.squadStatus")}
                  </p>
                  <p className="mt-0.5 truncate text-label-md font-semibold leading-tight text-white">
                    {t("lobby.hurtCount", { count: lobby.heal.hurtCount })}
                  </p>
                </div>
                <div className="shrink-0 self-center">
                  <HealButton
                    locale={locale}
                    needsHealing
                    cooldownMsLeft={lobby.heal.cooldownMsLeft}
                    rushCost={lobby.heal.rushCost}
                    coins={lobby.heal.coins}
                    teamMaxLevel={lobby.heal.teamMaxLevel}
                    compact
                    onHealed={() => setSquadHealed(true)}
                    onHealFailed={() => setSquadHealed(false)}
                  />
                </div>
              </section>
            )}

            {lobby.recent.length > 0 && (
              <section>
                <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  {t("lobby.recent")}
                </h2>
                <div className="flex flex-col gap-2">
                  {lobby.recent.slice(0, 4).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-black/30">
                        {entry.spriteUrl && (
                          <Image
                            src={entry.spriteUrl}
                            alt={entry.speciesName}
                            width={36}
                            height={36}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-label-sm font-medium capitalize text-on-surface">
                          {entry.speciesName}
                        </p>
                        <p className="text-[10px] text-on-surface-variant">
                          {t("level", { level: entry.level })}
                        </p>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wide ${
                          entry.status === "WON" || entry.status === "CAUGHT"
                            ? "text-emerald-300"
                            : entry.status === "LOST"
                              ? "text-error"
                              : "text-on-surface-variant"
                        }`}
                      >
                        {t(`lobby.status.${entry.status}`)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* En vez de repetir el escuadrón (ya está en Inicio y en /team), acá
            va lo que sí importa antes de explorar: qué podés cruzarte. */}
        <section className="mt-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h2 className="text-headline-md text-white">{t("lobby.zoneEncounters")}</h2>
              <span className="text-label-sm text-on-surface-variant">
                {locationLabel}
                <span className="mx-1.5 text-on-surface-variant/40">•</span>
                {tc("wildLevels", {
                  min: lobby.encounterLevelMin,
                  max: lobby.encounterLevelMax,
                })}
              </span>
            </div>
            <span className="text-label-sm text-on-surface-variant">
              {t("lobby.caughtCount", {
                caught: lobby.encounters.filter((e) => e.caught).length,
                total: lobby.encounters.length,
              })}
            </span>
          </div>

          {lobby.encounters.length === 0 ? (
            <p className="py-6 text-center text-label-md text-on-surface-variant">
              {t("lobby.noEncounters")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {lobby.encounters.map((mon) => (
                <div
                  key={mon.speciesId}
                  className="group relative flex flex-col items-center"
                >
                  <span className="absolute left-0 top-0 text-[10px] font-mono text-on-surface-variant/60">
                    #{String(mon.speciesId).padStart(3, "0")}
                  </span>
                  {mon.caught && (
                    <span
                      title={t("lobby.caught")}
                      className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-surface"
                    >
                      <span className="material-symbols-outlined text-[11px]! leading-none">
                        check
                      </span>
                    </span>
                  )}
                  <div className="mb-1 flex h-16 w-16 items-center justify-center">
                    {mon.spriteUrl && (
                      <Image
                        src={mon.spriteUrl}
                        alt={mon.name}
                        width={64}
                        height={64}
                        className={`h-full w-full object-contain transition group-hover:scale-110 ${
                          mon.caught ? "" : "opacity-90"
                        }`}
                      />
                    )}
                  </div>
                  <p className="w-full truncate text-center text-label-md font-bold capitalize text-on-surface">
                    {mon.name}
                  </p>
                  <div className="mt-1 flex flex-wrap justify-center gap-1">
                    {mon.types.map((type) => (
                      <span
                        key={type}
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        style={{
                          backgroundColor: `${typeColor(type)}33`,
                          color: typeColor(type),
                        }}
                      >{typeLabel(type)}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
    </>
  );
}

function LoadoutChip({
  icon,
  label,
  value,
}: {
  /** Sprite del ítem vía CDN (`item-sprites.ts`). */
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-label-sm text-on-surface-variant">
        {label}
      </span>
      <span className="font-mono text-body-lg font-semibold leading-none text-white">{value}</span>
    </div>
  );
}

