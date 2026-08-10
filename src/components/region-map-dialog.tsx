"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { selectLocation, setFarmingStage } from "@/actions/campaign";
import { REGION_MAP_ASPECT } from "@/lib/campaign/region-map";
import { ZoneIcon, type ZoneIconKind } from "@/components/zone-icons";
import { gymLeaderSpriteByOrder } from "@/lib/gym-map";
import type { MapLocation } from "@/lib/campaign/map-selection";
import { lockBodyScroll } from "@/lib/scroll-lock";

export type { MapLocation, MapStage } from "@/lib/campaign/map-selection";

/**
 * Mapa de región a pantalla completa: elegís zona desbloqueada y stage a farmear.
 * El frame respeta el aspect ratio del arte (1400×933) para que se vea completo
 * y los pines no se desalineen.
 */
export function RegionMapDialog({
  locale,
  regionNameKey,
  mapSrc,
  locations,
  farmingLocationId,
  farmingStageId,
  triggerLabel,
  gymLeaderSprites,
}: {
  locale: string;
  regionNameKey: string;
  mapSrc: string;
  locations: MapLocation[];
  farmingLocationId: string;
  farmingStageId: string;
  triggerLabel: string;
  /** locationId → sprite URL del líder. Solo para nodos de tipo gym. */
  gymLeaderSprites?: Record<string, string>;
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
    const releaseScroll = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
    };
  }, [open]);

  const active = locations.find((l) => l.id === activeId) ?? null;

  function close() {
    setOpen(false);
    setActiveId(null);
  }

  const overlay = open ? (
    <div className="map-backdrop-in fixed inset-0 z-[100] flex flex-col bg-[#06080e]">
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-sky-300/80">
            {t("currentRegion")}
          </p>
          <h2 className="truncate text-[18px] font-bold tracking-tight text-white sm:text-headline-md">
            {t(regionNameKey)}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/campaign"
            className="flex h-9 items-center gap-1 rounded-lg border border-white/12 bg-white/5 px-2.5 text-label-sm text-on-surface transition-colors hover:bg-white/10 sm:px-3"
          >
            <span className="material-symbols-outlined text-[18px]!">menu_book</span>
            <span className="sm:hidden">{t("journeyGuideShort")}</span>
            <span className="hidden sm:inline">{t("journeyGuide")}</span>
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label={t("closeMap")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-on-surface transition-colors hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[20px]!">close</span>
          </button>
        </div>
      </header>

      {/* Centra el mapa completo dentro del espacio libre (sin crop). */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 py-2 sm:px-4 sm:py-3 [container-type:size]">
        <div
          className="map-zoom-in relative max-h-full overflow-hidden rounded-xl border border-white/10 bg-[#0b1424] shadow-[0_0_0_1px_rgba(56,189,248,0.1),0_16px_48px_rgba(0,0,0,0.55)]"
          style={{
            aspectRatio: REGION_MAP_ASPECT,
            // Encaja el arte landscape en el hueco disponible (ancho o alto).
            width: "min(100%, calc(100cqh * 1400 / 933))",
            maxHeight: "100%",
          }}
        >
          <Image
            src={mapSrc}
            alt={t(regionNameKey)}
            fill
            priority
            sizes="100vw"
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
                className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border backdrop-blur-[2px] transition-transform sm:rounded-md sm:px-2 sm:py-1.5 ${
                  unlocked ? "hover:scale-105" : "cursor-not-allowed"
                } ${
                  isFarming
                    ? "border-pokeball-red/80 bg-pokeball-red/25 text-white shadow-[0_0_14px_rgba(238,21,21,0.4)]"
                    : isActive
                      ? "border-white bg-white/25 text-white"
                      : unlocked
                        ? "border-white/40 bg-black/45 text-white"
                        : "border-white/15 bg-black/35 text-white/40"
                } h-8 w-8 justify-center p-0 sm:h-auto sm:w-auto sm:justify-start`}
              >
                {!unlocked ? (
                  <span className="material-symbols-outlined shrink-0 text-[15px]!">lock</span>
                ) : isFarming ? (
                  <span className="material-symbols-outlined shrink-0 text-[15px]!">
                    my_location
                  </span>
                ) : location.gymOrder != null &&
                  (gymLeaderSprites?.[location.id] ||
                    gymLeaderSpriteByOrder(location.gymOrder)) ? (
                  <Image
                    src={
                      gymLeaderSprites?.[location.id] ??
                      gymLeaderSpriteByOrder(location.gymOrder)!
                    }
                    alt=""
                    width={24}
                    height={24}
                    className="h-5 w-5 shrink-0 object-contain [image-rendering:pixelated]"
                  />
                ) : (
                  <ZoneIcon
                    kind={location.kindKey.replace("kinds.", "") as ZoneIconKind}
                    className="h-5 w-5 shrink-0"
                  />
                )}
                <span className="hidden max-w-[120px] truncate text-[11px] font-semibold leading-none sm:inline">
                  {t(location.nameKey)}
                </span>
              </button>
            );
          })}
        </div>

        {!active && (
          <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 px-3 text-center text-[11px] text-white/50 sm:bottom-3 sm:text-label-sm">
            {t("pickZoneHint")}
          </p>
        )}
      </div>

      {active && (
        <div className="map-zoom-in relative z-20 shrink-0 border-t border-white/10 bg-[#0a0d14]/95 px-3 py-3 backdrop-blur-md sm:px-5 sm:py-4">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-[16px] font-semibold text-white sm:text-lg">
                  {t(active.nameKey)}
                </h3>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                  {t(active.kindKey)}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-electric-yellow/85">
                Lv. {active.levelMin}–{active.levelMax}
                <span className="mx-1.5 text-white/25">·</span>
                <span className="text-white/45">
                  {t("stageProgress", {
                    done: active.completedStages,
                    total: active.totalStages,
                  })}
                </span>
              </p>

              {active.encounters.length > 0 && (
                <ul className="mt-2 flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5">
                  {active.encounters.map((mon) => (
                    <li
                      key={mon.speciesId}
                      title={mon.name}
                      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-surface-container-high/50"
                    >
                      <Image
                        src={mon.spriteUrl}
                        alt={mon.name}
                        width={32}
                        height={32}
                        draggable={false}
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
                className="ui-btn-primary rounded-xl px-4 py-2.5 text-[13px]"
              >
                {active.id === farmingLocationId ? t("youAreHere") : t("moveHere")}
              </button>
              <div className="max-h-28 overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-1 sm:max-h-36">
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
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors ${
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
                        {!stage.isGym && stage.clearsRequired > 1 && !stage.done
                          ? ` · ${stage.clearsCurrent}/${stage.clearsRequired}`
                          : ""}
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
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        className="absolute inset-0 z-0 cursor-zoom-in"
      />
      {overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
