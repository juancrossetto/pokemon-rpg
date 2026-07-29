"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { HealButton } from "@/components/heal-button";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import { StartEncounterButton } from "@/components/start-encounter-button";
import { RegionMapDialog } from "@/components/region-map-dialog";
import { PokeballIcon } from "@/components/pokeball-icon";
import { itemSpriteUrl } from "@/lib/item-sprites";
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
 * - La energía no se repite acá: el header global ya la muestra fija en
 *   pantalla. Sólo queda su coste, debajo del botón que la gasta.
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

  const canExplore = hasHealthyTeam && lobby.energy >= lobby.energyCost;

  const startErrors = {
    no_lead: t("errors.noLead"),
    fainted_lead: t("errors.faintedLead"),
    no_energy: t("errors.noEnergy"),
    no_stage: tc("errors.noStage"),
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
                >
                  {type}
                </span>
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
              className="cta-pulse flex w-full items-center justify-center gap-2 rounded-xl bg-pokeball-red py-4 text-label-md font-bold uppercase tracking-wide text-white shadow-[0_8px_24px_rgba(238,21,21,0.35)] transition disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
            />
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-label-sm text-error">{t("errors.faintedLead")}</p>
              <Link
                href="/team"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-pokeball-red py-4 text-label-md font-bold uppercase tracking-wide text-white"
              >
                <span className="material-symbols-outlined text-[18px]!">healing</span>
                {t("goHeal")}
              </Link>
            </div>
          )}
          {/* Sólo el coste: la barra de energía vive en el header global y
              repetirla acá era la misma información dos veces en pantalla. */}
          <p className="text-center text-[10px] text-on-surface-variant">
            {t("lobby.energyHint", { cost: lobby.energyCost })}
          </p>
        </div>
      </section>

      {/* ── Tira de recursos + accesos: 5 tiles en dos filas, no 2 cards ── */}
      <section className="lobby-rise flex items-stretch divide-x divide-white/10 overflow-hidden rounded-xl border border-white/[0.08] bg-black/25" style={{ animationDelay: "60ms" }}>
        <ResourceTile
          icon={<PokeballIcon className="h-5 w-5" />}
          label={t("pokeballsLabel")}
          value={lobby.balls}
        />
        <ResourceTile
          icon={
            <Image
              src={itemSpriteUrl("Potion")}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
          }
          label={t("potionsLabel")}
          value={lobby.potions}
        />
      </section>

      {/*
        Los tres tiles de navegación salieron: Gimnasios vive en Aventura, PvP
        en Combate y Equipo en Colección, todos a un toque en la bottom bar.

        En su lugar, curar. El caso "líder debilitado" ya se resolvía en el CTA,
        pero solo cuando el daño ya estaba hecho: si el equipo llega herido a la
        siguiente exploración, no había aviso. Este bloque aparece apenas hay
        alguien lastimado y evita el viaje de ida y vuelta a Equipo.
      */}
      {lobby.heal.hurtCount > 0 && (
        <section
          className="lobby-rise flex items-center gap-2.5 rounded-xl border border-error/20 bg-error/[0.06] p-3"
          style={{ animationDelay: "90ms" }}
        >
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-error/25 bg-error/10"
          >
            <span className="material-symbols-outlined text-[20px]! text-error">healing</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-label-sm font-semibold text-on-surface">
              {t("lobby.squadStatus")}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              {t("lobby.hurtCount", { count: lobby.heal.hurtCount })}
            </p>
          </div>
          <div className="shrink-0">
            <HealButton
              locale={locale}
              needsHealing
              cooldownMsLeft={lobby.heal.cooldownMsLeft}
              rushCost={lobby.heal.rushCost}
              coins={lobby.heal.coins}
              teamMaxLevel={lobby.heal.teamMaxLevel}
            />
          </div>
        </section>
      )}

      {lobby.unspentTotal > 0 && (
        <Link
          href="/team"
          className="flex items-center gap-1.5 rounded-xl border border-tertiary/25 bg-tertiary/10 px-3 py-2 text-[11px] text-tertiary active:scale-[0.99]"
        >
          <span className="material-symbols-outlined text-[14px]!">bolt</span>
          {t("lobby.unspentPoints", { count: lobby.unspentTotal })}
          <span className="material-symbols-outlined ml-auto text-[14px]!">chevron_right</span>
        </Link>
      )}

      {/* ── Últimos encuentros: carrusel horizontal en vez de lista vertical ── */}
      {lobby.recent.length > 0 && (
        <section className="lobby-rise" style={{ animationDelay: "120ms" }}>
          <SectionTitle>{t("lobby.recent")}</SectionTitle>
          <div className="-mx-margin-mobile flex gap-2 overflow-x-auto px-margin-mobile pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {lobby.recent.slice(0, 8).map((entry) => (
              <div
                key={entry.id}
                className="flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-xl border border-white/[0.08] bg-black/25 px-2 py-2"
              >
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40">
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
                  className={`w-full rounded-full py-0.5 text-center text-[8px] font-bold uppercase tracking-wide ${
                    entry.status === "WON" || entry.status === "CAUGHT"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : entry.status === "LOST"
                        ? "bg-error/15 text-error"
                        : "bg-white/10 text-on-surface-variant"
                  }`}
                >
                  {t(`lobby.status.${entry.status}`)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Pokémon de la zona: cards más bajas y sprite más grande ── */}
      <section className="lobby-rise" style={{ animationDelay: "150ms" }}>
        <SectionTitle
          trailing={t("lobby.caughtCount", { caught, total: lobby.encounters.length })}
        >
          {t("lobby.zoneEncounters")}
        </SectionTitle>

        {lobby.encounters.length === 0 ? (
          <p className="rounded-xl border border-white/8 bg-black/20 py-6 text-center text-label-sm text-on-surface-variant">
            {t("lobby.noEncounters")}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {lobby.encounters.map((mon) => (
              <div
                key={mon.speciesId}
                className="relative rounded-lg border border-white/[0.08] bg-surface-container-high/40 px-1 pb-1.5 pt-1 active:scale-[0.98]"
              >
                {mon.caught && (
                  <span
                    title={t("lobby.caught")}
                    className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-surface"
                  >
                    <span className="material-symbols-outlined text-[10px]! leading-none">
                      check
                    </span>
                  </span>
                )}
                {/* Sprite más grande dentro de una card más baja: el número de
                    Pokédex y los chips de tipo se sacaron porque el nombre y el
                    sprite ya identifican, y costaban ~34px por card. */}
                <div className="mx-auto flex h-14 w-14 items-center justify-center">
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
                <p className="truncate text-center text-[10px] font-bold capitalize text-on-surface">
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

function ResourceTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-1 items-center gap-2 px-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <span className="block font-mono text-[15px] font-bold leading-tight text-white">
          {value}
        </span>
      </span>
    </div>
  );
}