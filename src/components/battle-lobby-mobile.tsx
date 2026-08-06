"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTypeLabel } from "@/hooks/use-type-label";
import { HubHelpButton } from "@/components/journey-guidance";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import { StartEncounterButton } from "@/components/start-encounter-button";
import { RegionMapDialog } from "@/components/region-map-dialog";
import { LobbyLoadoutCard } from "@/components/battle/lobby-loadout-card";
import { LobbySquadHealRow } from "@/components/battle/lobby-squad-heal";
import type { BattleLobbyData } from "@/lib/battle-lobby";

/**
 * Lobby de batalla en mobile. Es un árbol aparte del de desktop (que queda
 * intacto) porque la reorganización pedida no se logra sólo reordenando: hay
 * que fusionar cinco bloques —ubicación, frecuencia, mapa, tipos y CTA— en una
 * sola hero card, y eso cambia el anidamiento, no el orden.
 *
 * Decisiones de jerarquía:
 * - El h1 "Batalla" y su subtítulo no se muestran: la barra inferior ya dice
 *   en qué pantalla estás, y gastaban ~90px por encima de la acción.
 * - El coste de energía va dentro del CTA Explorar (mismo patrón que gimnasio).
 * - Los datos de la zona van SOBRE el mapa, que así crece a 190px y deja de ser
 *   decorativo sin costar altura extra.
 */
export function BattleLobbyMobile({
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
  // stageLabel llega como "Ruta 3 · tramo 1" y el título ya dice "Ruta 3":
  // se recorta el prefijo repetido para que la línea aporte algo nuevo.
  const stageSuffix = stageLabel.startsWith(locationLabel)
    ? stageLabel.slice(locationLabel.length).replace(/^[\s·-]+/, "")
    : stageLabel;
  const predictedTypes = lobby.expedition?.predictedTypes ?? ["normal", "grass", "bug"];
  const mapSrc = lobby.expedition?.mapSrc;
  const regionNameKey = lobby.expedition?.regionNameKey ?? "regions.kanto";
  const caught = lobby.encounters.filter((e) => e.caught).length;

  return (
    <div className="flex flex-col gap-3 px-margin-mobile py-3">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="lobby-rise relative overflow-hidden rounded-2xl border border-white/12 bg-surface-container-low shadow-[0_18px_44px_rgba(0,0,0,0.5)]">
        {/* Mapa protagonista: toda la imagen abre el mapa completo (el trigger
            de RegionMapDialog es inset-0), así que no hace falta el botón. */}
        <div className="relative h-[190px] w-full overflow-hidden bg-[#0b1424]">
          {mapSrc ? (
            <Image
              src={mapSrc}
              alt=""
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/92 via-black/45 to-black/25" />
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.6)]" />

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

          {/* Datos de la zona encima del mapa: no cuestan altura propia. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex flex-col gap-1.5 p-3">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-sky-300/90">
                  {t("lobby.currentLocation")}
                </p>
                <h2 className="truncate text-[22px] font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  {locationLabel}
                </h2>
                <p className="truncate text-[11px] text-white/70">
                  {stageSuffix}
                  {stageSuffix && <span className="mx-1 text-white/30">·</span>}
                  {tc("wildLevels", {
                    min: lobby.encounterLevelMin,
                    max: lobby.encounterLevelMax,
                  })}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-white/25 bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                {tc(`encounterRate.${lobby.encounterRate}`)}
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {predictedTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${typeColor(type)}, ${typeColor(type)}cc)`,
                  }}
                >{typeLabel(type)}</span>
              ))}
            </div>
          </div>
        </div>

        {/* CTA: cierra la hero, así queda pegado al contexto que lo justifica. */}
        <div className="flex flex-col gap-1.5 p-3">
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
              <p className="text-label-sm text-error">{t("errors.faintedLead")}</p>
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
      </section>

      {/* ── Mochila (+ cura embebida si hay heridos, sin card suelta) ── */}
      <section className="lobby-rise" style={{ animationDelay: "60ms" }}>
        <LobbyLoadoutCard
          balls={lobby.balls}
          heals={lobby.heals}
          unspentTotal={lobby.unspentTotal}
          footer={
            showSquadStatus ? (
              <LobbySquadHealRow
                locale={locale}
                hurtCount={lobby.heal.hurtCount}
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
      </section>

      {/* ── Últimos encuentros: carrusel horizontal en vez de lista vertical ── */}
      {lobby.recent.length > 0 && (
        <section className="lobby-rise" style={{ animationDelay: "120ms" }}>
          <SectionTitle>{t("lobby.recent")}</SectionTitle>
          <div className="-mx-margin-mobile flex gap-3 overflow-x-auto px-margin-mobile pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {lobby.recent.slice(0, 8).map((entry) => (
              <div
                key={entry.id}
                className="flex w-[72px] shrink-0 flex-col items-center gap-0.5"
              >
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-black/30">
                  {entry.spriteUrl && (
                    <Image
                      src={entry.spriteUrl}
                      alt={entry.speciesName}
                      width={44}
                      height={44}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <p className="w-full truncate text-center text-[10px] font-medium capitalize text-on-surface">
                  {entry.speciesName}
                </p>
                <p className="text-[9px] text-on-surface-variant">
                  {t("level", { level: entry.level })}
                </p>
                <span
                  className={`text-center text-[8px] font-bold uppercase tracking-wide ${
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

      {/* ── Pokémon de la zona ── */}
      <section className="lobby-rise" style={{ animationDelay: "150ms" }}>
        <SectionTitle
          trailing={t("lobby.caughtCount", { caught, total: lobby.encounters.length })}
        >
          {t("lobby.zoneEncounters")}
        </SectionTitle>

        {lobby.encounters.length === 0 ? (
          <p className="py-6 text-center text-label-sm text-on-surface-variant">
            {t("lobby.noEncounters")}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {lobby.encounters.map((mon) => (
              <div
                key={mon.speciesId}
                className="relative flex flex-col items-center gap-0.5 active:scale-[0.98]"
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
                <div className="flex h-14 w-14 items-center justify-center">
                  {mon.spriteUrl && (
                    <Image
                      src={mon.spriteUrl}
                      alt={mon.name}
                      width={56}
                      height={56}
                      className={`h-full w-full object-contain ${mon.caught ? "" : "opacity-90"}`}
                    />
                  )}
                </div>
                <p className="w-full truncate text-center text-[10px] font-bold capitalize text-on-surface">
                  {mon.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionTitle({
  children,
  trailing,
}: {
  children: React.ReactNode;
  trailing?: string;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
        {children}
      </h2>
      {trailing && <span className="text-[10px] text-on-surface-variant/70">{trailing}</span>}
    </div>
  );
}