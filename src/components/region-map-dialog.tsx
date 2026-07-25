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
    <div className="map-backdrop-in fixed inset-0 z-[100] flex flex-col bg-black/70 backdrop-blur-xl backdrop-saturate-50">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/90">
            {t("currentRegion")}
          </p>
          <h2 className="text-headline-md tracking-tight text-white md:text-headline-lg">
            {t(regionNameKey)}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/campaign"
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-label-sm text-on-surface backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[18px]!">view_list</span>
            <span className="hidden sm:inline">{t("viewList")}</span>
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label={t("closeMap")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-on-surface backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[20px]!">close</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 pb-4 pt-20 md:px-8 md:pb-6">
        <div
          className="map-zoom-in relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/12 bg-[#0b1424] shadow-[0_0_0_1px_rgba(56,189,248,0.12),0_24px_80px_rgba(0,0,0,0.65)]"
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
            const unlocked = location.unlocked;
            return (
              <button
                key={location.id}
                type="button"
                disabled={!unlocked}
                onClick={() => setActiveId(location.id)}
                title={t(location.nameKey)}
                style={{ left: `${location.x}%`, top: `${location.y}%` }}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-md border px-1.5 py-1 backdrop-blur-[2px] transition-transform md:gap-1.5 md:px-2 md:py-1.5 ${
                  unlocked ? "hover:scale-105" : "cursor-not-allowed"
                } ${
                  isFarming
                    ? "border-pokeball-red/70 bg-pokeball-red/20 text-white shadow-[0_0_12px_rgba(238,21,21,0.35)]"
                    : isActive
                      ? "border-sky-300/70 bg-sky-400/20 text-white"
                      : unlocked
                        ? "border-white/35 bg-black/25 text-white"
                        : "border-white/15 bg-black/20 text-on-surface-variant/75"
                }`}
              >
                <span className="material-symbols-outlined shrink-0 text-[13px]! md:text-[16px]!">
                  {!unlocked ? "lock" : isFarming ? "my_location" : "place"}
                </span>
                <span className="max-w-[88px] truncate text-[10px] font-semibold leading-none md:max-w-[130px] md:text-[11px]">
                  {t(location.nameKey)}
                </span>
              </button>
            );
          })}
        </div>

        {!active ? (
          <p className="max-w-3xl px-2 text-center text-[12px] leading-snug text-on-surface-variant/80 md:text-label-sm">
            {t("pickZoneHint")}
          </p>
        ) : (
          <div className="map-zoom-in w-full max-w-5xl rounded-xl border border-white/12 bg-black/55 p-3 backdrop-blur-md md:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-semibold text-white">{t(active.nameKey)}</h3>
                <p className="mt-0.5 text-label-sm text-on-surface-variant">
                  {t(active.kindKey)}
                  <span className="mx-1.5 text-on-surface-variant/40">•</span>
                  {t("stageProgress", {
                    done: active.completedStages,
                    total: active.totalStages,
                  })}
                  <span className="mx-1.5 text-on-surface-variant/40">•</span>
                  {t("wildLevels", { min: active.levelMin, max: active.levelMax })}
                </p>

                {active.encounters.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {active.encounters.map((mon) => (
                      <li
                        key={mon.speciesId}
                        title={mon.name}
                        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-surface-container-high/50"
                      >
                        <Image
                          src={mon.spriteUrl}
                          alt={mon.name}
                          width={32}
                          height={32}
                          className={`h-7 w-7 object-contain ${mon.caught ? "" : "opacity-70 grayscale"}`}
                        />
                        {mon.caught && (
                          <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-400 text-surface">
                            <span className="material-symbols-outlined text-[9px]! leading-none">
                              check
                            </span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:w-52">
                <button
                  type="button"
                  disabled={pending || active.id === farmingLocationId}
                  onClick={() =>
                    startTransition(async () => {
                      await selectLocation(active.id, locale);
                      close();
                    })
                  }
                  className="rounded-lg bg-pokeball-red px-4 py-2 text-label-sm font-semibold text-white transition-colors hover:bg-pokeball-red/85 disabled:opacity-40"
                >
                  {active.id === farmingLocationId ? t("youAreHere") : t("moveHere")}
                </button>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-1">
                  {active.stages.map((stage) => {
                    const current = stage.id === farmingStageId;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        disabled={pending || !stage.unlocked || stage.isGym}
                        onClick={() =>
                          startTransition(async () => {
                            await setFarmingStage(stage.id, locale);
                            close();
                          })
                        }
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors ${
                          current
                            ? "bg-pokeball-red/15 text-white"
                            : stage.unlocked && !stage.isGym
                              ? "text-on-surface hover:bg-white/5"
                              : "text-on-surface-variant/50"
                        }`}
                      >
                        <span className="truncate">
                          {stage.isGym ? "🏅 " : stage.done ? "✓ " : ""}
                          {t(stage.nameKey)}
                        </span>
                        {!stage.unlocked && !stage.isGym && (
                          <span className="material-symbols-outlined text-[14px]!">lock</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
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
