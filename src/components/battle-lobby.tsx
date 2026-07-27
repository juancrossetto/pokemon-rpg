"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import { StartEncounterButton } from "@/components/start-encounter-button";
import { RegionMapDialog } from "@/components/region-map-dialog";
import { itemSpriteUrl } from "@/lib/item-sprites";
import { BattleLobbyMobile } from "@/components/battle-lobby-mobile";
import type { BattleLobbyData } from "@/lib/battle-lobby";

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
          <p className="mb-1 flex items-center gap-2 text-label-sm uppercase tracking-[0.2em] text-pokeball-red">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pokeball-red" />
            {t("lobby.liveSync")}
          </p>
          <h1 className="text-headline-lg tracking-tight text-white md:text-display-lg">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-lg text-label-md text-on-surface-variant">
            {t("subtitle")}
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="glass-panel relative flex flex-col overflow-hidden rounded-xl border border-white/10 p-4">
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
                  >
                    {type}
                  </span>
                ))}
              </div>

              {hasHealthyTeam ? (
                <StartEncounterButton
                  locale={locale}
                  label={t("explore")}
                  errors={startErrors}
                  disabled={!canExplore}
                  className="w-full rounded-xl bg-pokeball-red px-6 py-3 text-label-md font-semibold text-white shadow-[0_8px_24px_rgba(238,21,21,0.28)] transition hover:bg-pokeball-red/90 disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-label-md text-error">{t("errors.faintedLead")}</p>
                  <Link
                    href="/team"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-pokeball-red px-6 py-3 text-label-md font-semibold text-white hover:bg-pokeball-red/90"
                  >
                    <span className="material-symbols-outlined text-[18px]!">healing</span>
                    {t("goHeal")}
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
            <section className="glass-panel rounded-xl border border-white/10 p-3">
              <div className="flex items-stretch gap-2">
                <LoadoutChip
                  icon={
                    <Image
                      src={itemSpriteUrl("Poke Ball")}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain"
                      unoptimized
                    />
                  }
                  label={t("pokeballsLabel")}
                  value={lobby.balls}
                />
                <LoadoutChip
                  icon={
                    <Image
                      src={itemSpriteUrl("Potion")}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain"
                      unoptimized
                    />
                  }
                  label={t("potionsLabel")}
                  value={lobby.potions}
                />
              </div>
              {lobby.unspentTotal > 0 && (
                <Link
                  href="/team"
                  className="mt-2 flex items-center gap-1.5 rounded-lg border border-tertiary/25 bg-tertiary/10 px-2.5 py-2 text-[11px] text-tertiary transition hover:border-tertiary/40"
                >
                  <span className="material-symbols-outlined text-[14px]!">bolt</span>
                  {t("lobby.unspentPoints", { count: lobby.unspentTotal })}
                  <span className="material-symbols-outlined ml-auto text-[14px]!">
                    chevron_right
                  </span>
                </Link>
              )}
            </section>

            <section className="glass-panel rounded-xl border border-white/10 p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {t("lobby.shortcuts")}
              </p>
              <div className="flex flex-col gap-2">
                <ShortcutLink href="/gyms" icon="trophy" label={t("lobby.gotoGyms")} />
                <ShortcutLink href="/pvp" icon="swords" label={t("lobby.gotoPvp")} />
                {/* El escuadrón completo salió de esta pantalla, pero saber si
                    podés pelear sigue siendo necesario acá. */}
                <ShortcutLink
                  href="/team"
                  icon="group"
                  label={t("lobby.gotoTeam")}
                  hint={t("lobby.teamReady", {
                    ready: lobby.teamReady,
                    total: lobby.teamTotal,
                  })}
                />
              </div>
            </section>

            {lobby.recent.length > 0 && (
              <section className="glass-panel rounded-xl border border-white/10 p-4">
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  {t("lobby.recent")}
                </h2>
                <div className="flex flex-col gap-1.5">
                  {lobby.recent.slice(0, 4).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5"
                    >
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40">
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
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
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
          </div>
        </div>

        {/* En vez de repetir el escuadrón (ya está en Inicio y en /team), acá
            va lo que sí importa antes de explorar: qué podés cruzarte. */}
        <section className="glass-panel rounded-xl border border-white/10 p-4 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-pokeball-red text-[20px]!">
                pets
              </span>
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {lobby.encounters.map((mon) => (
                <div
                  key={mon.speciesId}
                  className="group relative rounded-lg border border-white/10 bg-surface-container-high/40 p-2 shadow-sm transition hover:bg-white/10"
                >
                  <span className="absolute left-2 top-2 text-[10px] font-mono text-on-surface-variant/60">
                    #{String(mon.speciesId).padStart(3, "0")}
                  </span>
                  {mon.caught && (
                    <span
                      title={t("lobby.caught")}
                      className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-surface"
                    >
                      <span className="material-symbols-outlined text-[11px]! leading-none">
                        check
                      </span>
                    </span>
                  )}
                  <div className="mx-auto mb-1 flex h-16 w-16 items-center justify-center">
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
                  <p className="truncate text-center text-label-md font-bold capitalize text-on-surface">
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
                      >
                        {type}
                      </span>
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

function ShortcutLink({
  href,
  icon,
  label,
  hint,
}: {
  href: "/gyms" | "/pvp" | "/team";
  icon: string;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-label-sm text-on-surface transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      <span className="material-symbols-outlined text-[18px]! text-pokeball-red">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="font-mono text-[11px] text-on-surface-variant">{hint}</span>}
      <span className="material-symbols-outlined text-[16px]! text-on-surface-variant">
        chevron_right
      </span>
    </Link>
  );
}
