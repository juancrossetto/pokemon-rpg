"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import { StartEncounterButton } from "@/components/start-encounter-button";
import { RegionMapDialog } from "@/components/region-map-dialog";
import { BattleLobbyMobile } from "@/components/battle-lobby-mobile";
import { LobbyLoadoutCard } from "@/components/battle/lobby-loadout-card";
import { LobbySquadHealRow } from "@/components/battle/lobby-squad-heal";
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

      <div className="hidden h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px)-var(--bottom-nav-h,5.25rem)-env(safe-area-inset-bottom,0px)-1.75rem)] max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px)-var(--bottom-nav-h,5.25rem)-env(safe-area-inset-bottom,0px)-1.75rem)] flex-col overflow-hidden px-margin-desktop py-3 lg:flex xl:h-[calc(100dvh-3.5rem)] xl:max-h-[calc(100dvh-3.5rem)]">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-2.5">
        <header className="shrink-0">
          <p className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-emerald-400/90">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {t("lobby.liveSync")}
          </p>
          <h1 className="page-title text-[clamp(1.35rem,2.4vw,1.85rem)] text-white">
            {t("title")}
          </h1>
          <p className="mt-0.5 max-w-lg text-[13px] leading-snug text-on-surface-variant">
            {t("subtitle")}
          </p>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="glass-panel relative flex min-h-0 flex-col overflow-hidden p-3">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300/80">
                    {t("lobby.currentLocation")}
                  </p>
                  <h2 className="mt-0.5 text-[1.15rem] font-semibold leading-tight text-white">
                    {locationLabel}
                  </h2>
                  <p className="text-[12px] text-on-surface-variant">{stageLabel}</p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${RATE_STYLE[lobby.encounterRate]}`}
                >
                  {tc(`encounterRate.${lobby.encounterRate}`)}
                </span>
              </div>

              {/* Mismo mapa y mismo selector que el dashboard. */}
              <div className="relative mb-2.5 min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-[#0b1424]">
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

              <p className="mb-1.5 shrink-0 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {t("lobby.predictedTypes")}
              </p>
              <div className="mb-2.5 flex shrink-0 flex-wrap gap-1.5">
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

              <div className="shrink-0">
                {hasHealthyTeam ? (
                  <StartEncounterButton
                    locale={locale}
                    label={t("explore")}
                    errors={startErrors}
                    disabled={!canExplore}
                    energyCost={lobby.energyCost}
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
              </div>
            </div>
          </section>

          <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
            <LobbyLoadoutCard
              balls={lobby.balls}
              heals={lobby.heals}
              unspentTotal={lobby.unspentTotal}
              heal={
                showSquadStatus ? (
                  <LobbySquadHealRow
                    locale={locale}
                    cooldownMsLeft={lobby.heal.cooldownMsLeft}
                    rushCost={lobby.heal.rushCost}
                    coins={lobby.heal.coins}
                    teamMaxLevel={lobby.heal.teamMaxLevel}
                    onHealed={() => setSquadHealed(true)}
                    onHealFailed={() => setSquadHealed(false)}
                  />
                ) : null
              }
            />

            {lobby.recent.length > 0 && (
              <section className="shrink-0">
                <h2 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  {t("lobby.recent")}
                </h2>
                <div className="flex flex-col gap-1.5">
                  {lobby.recent.slice(0, 3).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-black/30">
                        {entry.spriteUrl && (
                          <Image
                            src={entry.spriteUrl}
                            alt={entry.speciesName}
                            width={32}
                            height={32}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium capitalize text-on-surface">
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
        <section className="shrink-0 border-t border-white/8 pt-2">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h2 className="text-[1.05rem] font-semibold text-white">
                {t("lobby.zoneEncounters")}
              </h2>
              <span className="text-[12px] text-on-surface-variant">
                {locationLabel}
                <span className="mx-1.5 text-on-surface-variant/40">•</span>
                {tc("wildLevels", {
                  min: lobby.encounterLevelMin,
                  max: lobby.encounterLevelMax,
                })}
              </span>
            </div>
            <span className="text-[12px] text-on-surface-variant">
              {t("lobby.caughtCount", {
                caught: lobby.encounters.filter((e) => e.caught).length,
                total: lobby.encounters.length,
              })}
            </span>
          </div>

          {lobby.encounters.length === 0 ? (
            <p className="py-3 text-center text-[13px] text-on-surface-variant">
              {t("lobby.noEncounters")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {lobby.encounters.map((mon) => (
                <div
                  key={mon.speciesId}
                  className="group relative flex min-w-[4.5rem] flex-col items-center"
                >
                  {mon.caught && (
                    <span
                      title={t("lobby.caught")}
                      className="absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-surface"
                    >
                      <span className="material-symbols-outlined text-[10px]! leading-none">
                        check
                      </span>
                    </span>
                  )}
                  <div className="mb-0.5 flex h-11 w-11 items-center justify-center">
                    {mon.spriteUrl && (
                      <Image
                        src={mon.spriteUrl}
                        alt={mon.name}
                        width={44}
                        height={44}
                        className={`h-full w-full object-contain transition group-hover:scale-110 ${
                          mon.caught ? "" : "opacity-90"
                        }`}
                      />
                    )}
                  </div>
                  <p className="w-full truncate text-center text-[12px] font-semibold capitalize text-on-surface">
                    {mon.name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                    {mon.types.map((type) => (
                      <span
                        key={type}
                        className="rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide"
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

