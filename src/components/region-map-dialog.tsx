"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { selectLocation, setFarmingStage } from "@/actions/campaign";
import { REGION_MAP_ASPECT } from "@/lib/campaign/region-map";
import type { MapLocation } from "@/lib/campaign/map-selection";

export type { MapLocation, MapStage } from "@/lib/campaign/map-selection";

/**
 * Mapa de región a pantalla completa: elegís en qué zona desbloqueada pararte y
 * qué stage farmear. Lo que se elige acá es lo que sale a explorar en Batalla
 * (`farmingStageId` → `resolveSpawn`), así que define qué Pokémon salvajes
 * aparecen.
 */
export function RegionMapDialog({
  locale,
  regionNameKey,
  mapSrc,
  locations,
  farmingLocationId,
  farmingStageId,
  triggerLabel,
}: {
  locale: string;
  regionNameKey: string;
  mapSrc: string;
  locations: MapLocation[];
  farmingLocationId: string;
  farmingStageId: string;
  triggerLabel: string;
}) {
  const t = useTranslations("campaign");
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const active = locations.find((l) => l.id === activeId) ?? null;

  function close() {
    setOpen(false);
    setActiveId(null);
  }

  // El contenido de la página vive dentro de un `relative z-10`, que crea un
  // stacking context: sin portal el overlay queda por debajo del top bar.
  const overlay = open ? (
    <div className="map-backdrop-in fixed inset-0 z-[100] flex flex-col bg-black/55 backdrop-blur-xl backdrop-saturate-50">
          <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/90">
                {t("currentRegion")}
              </p>
              <h2 className="text-headline-md tracking-tight text-white md:text-headline-lg">
                {t(regionNameKey)}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* La lista sigue siendo mejor que el mapa para ver todos los
                  stages de un vistazo, pero ya no ocupa lugar en el nav. */}
              <Link
                href="/campaign"
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-label-sm text-on-surface transition-colors hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[18px]">view_list</span>
                <span className="hidden sm:inline">{t("viewList")}</span>
              </Link>
              <button
                type="button"
                onClick={close}
                aria-label={t("closeMap")}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-on-surface transition-colors hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 md:flex-row md:px-6 md:pb-6">
            <div className="flex min-h-0 flex-1 items-start justify-center">
              <div
                className="map-zoom-in relative w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-[#0b1424] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
                style={{ aspectRatio: REGION_MAP_ASPECT }}
              >
                <Image
                  src={mapSrc}
                  alt={t(regionNameKey)}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 1024px"
                  className="object-contain"
                />

                {locations.map((location) => {
                  const isFarming = location.id === farmingLocationId;
                  const isActive = location.id === activeId;
                  return (
                    <button
                      key={location.id}
                      type="button"
                      disabled={!location.unlocked}
                      onClick={() => setActiveId(location.id)}
                      title={t(location.nameKey)}
                      style={{ left: `${location.x}%`, top: `${location.y}%` }}
                      className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-transform ${
                        location.unlocked ? "hover:scale-110" : "cursor-not-allowed"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 backdrop-blur-sm md:h-9 md:w-9 ${
                          isFarming
                            ? "border-pokeball-red bg-pokeball-red/25 text-white shadow-[0_0_16px_rgba(238,21,21,0.6)]"
                            : isActive
                              ? "border-sky-300 bg-sky-400/25 text-white"
                              : location.unlocked
                                ? "border-white/70 bg-black/60 text-white"
                                : "border-white/25 bg-black/60 text-on-surface-variant/60"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px] md:text-[18px]">
                          {!location.unlocked
                            ? "lock"
                            : isFarming
                              ? "my_location"
                              : "trip_origin"}
                        </span>
                      </span>
                      <span
                        className={`max-w-[92px] truncate rounded px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm md:max-w-[140px] md:text-[11px] ${
                          location.unlocked
                            ? "bg-black/70 text-white"
                            : "bg-black/50 text-on-surface-variant/60"
                        }`}
                      >
                        {t(location.nameKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="map-zoom-in w-full shrink-0 md:w-80">
              {!active ? (
                <div className="glass-panel rounded-xl border border-white/10 p-4 text-label-md text-on-surface-variant">
                  {t("pickZoneHint")}
                </div>
              ) : (
                <div className="glass-panel rounded-xl border border-white/10 p-4">
                  <h3 className="text-headline-md text-white">{t(active.nameKey)}</h3>
                  <p className="mt-0.5 text-label-sm text-on-surface-variant">
                    {t(active.kindKey)}
                    <span className="mx-1.5 text-on-surface-variant/40">•</span>
                    {t("stageProgress", {
                      done: active.completedStages,
                      total: active.totalStages,
                    })}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-label-sm text-on-surface-variant">
                    <span className="text-on-surface">
                      {t("wildLevels", { min: active.levelMin, max: active.levelMax })}
                    </span>
                    <span className="text-on-surface-variant/40">•</span>
                    <span>{t(`encounterRate.${active.encounterRate}`)}</span>
                  </p>

                  {active.encounters.length > 0 && (
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-2.5">
                      <p className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                        {t("zoneWilds")}
                        <span className="font-mono text-[10px] normal-case tracking-normal">
                          {active.encounters.filter((e) => e.caught).length}/
                          {active.encounters.length}
                        </span>
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {active.encounters.map((mon) => (
                          <li
                            key={mon.speciesId}
                            title={mon.name}
                            className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-surface-container-high/50"
                          >
                            <Image
                              src={mon.spriteUrl}
                              alt={mon.name}
                              width={40}
                              height={40}
                              className={`h-9 w-9 object-contain ${
                                mon.caught ? "" : "opacity-70 grayscale"
                              }`}
                            />
                            {mon.caught && (
                              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-surface">
                                <span className="material-symbols-outlined text-[10px]! leading-none">
                                  check
                                </span>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-[10px] text-on-surface-variant/70">
                        {t("zoneWildsHint")}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={pending || active.id === farmingLocationId}
                    onClick={() =>
                      startTransition(async () => {
                        await selectLocation(active.id, locale);
                        close();
                      })
                    }
                    className="mt-3 w-full rounded-lg bg-pokeball-red px-4 py-2 text-label-sm font-semibold text-white transition-colors hover:bg-pokeball-red/85 disabled:opacity-40"
                  >
                    {active.id === farmingLocationId ? t("youAreHere") : t("moveHere")}
                  </button>

                  <p className="mt-4 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    {t("pickStage")}
                  </p>
                  <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                    {active.stages.map((stage) => {
                      const current = stage.id === farmingStageId;
                      return (
                        <li key={stage.id}>
                          <button
                            type="button"
                            disabled={pending || !stage.unlocked || stage.isGym}
                            onClick={() =>
                              startTransition(async () => {
                                await setFarmingStage(stage.id, locale);
                                close();
                              })
                            }
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-label-sm transition-colors ${
                              current
                                ? "border-pokeball-red/50 bg-pokeball-red/10 text-white"
                                : stage.unlocked && !stage.isGym
                                  ? "border-white/10 bg-black/20 text-on-surface hover:bg-white/5"
                                  : "border-white/5 bg-black/10 text-on-surface-variant/50"
                            }`}
                          >
                            <span className="truncate">
                              {stage.isGym ? "🏅 " : stage.done ? "✓ " : ""}
                              {t(stage.nameKey)}
                            </span>
                            {!stage.unlocked && !stage.isGym && (
                              <span className="material-symbols-outlined text-[14px]">lock</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </aside>
          </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        className="absolute inset-0 z-0 cursor-zoom-in"
      />
      {/* Solo se abre por click, así que acá siempre estamos en el cliente. */}
      {overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
