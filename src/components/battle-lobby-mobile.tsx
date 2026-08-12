"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useTypeLabel } from "@/hooks/use-type-label";
import { HubHelpButton } from "@/components/journey-guidance";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import { StartEncounterButton } from "@/components/start-encounter-button";
import { RegionMapDialog } from "@/components/region-map-dialog";
import { LobbyLoadoutCard } from "@/components/battle/lobby-loadout-card";
import { LobbySquadHealRow } from "@/components/battle/lobby-squad-heal";
import {
  RouteTrainersSheet,
  type RouteTrainerRow,
} from "@/components/adventure/route-trainers-sheet";
import { setFarmingStage } from "@/actions/campaign";
import { playUiSfx } from "@/lib/battle-sfx";
import type { BattleLobbyData } from "@/lib/battle-lobby";

const OBJECTIVE_ICON: Record<string, string> = {
  stages: "/nav/compass-icon.png",
  trainers: "/nav/battle-icon.png",
  pokedex: "/nav/collection-icon.png",
};

/**
 * Lobby de batalla en mobile — base de campamento de la zona.
 * Explorar, tramos, objetivos y entrenadores sin pasar por Campaign.
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
  const router = useRouter();
  const intlLocale = useLocale();

  const canExplore = hasHealthyTeam && lobby.energy >= lobby.energyCost;
  const [squadHealed, setSquadHealed] = useState(false);
  const [trainersOpen, setTrainersOpen] = useState(false);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(() => new Set());
  const [stagePending, startStage] = useTransition();
  // Un solo disparo: si dejamos `?play=1` en la URL, al volver del combate
  // el lobby reiniciaría solo. Lo consumimos en el primer mount.
  const [autoPlay] = useState(() => Boolean(lobby.autoPlay && canExplore));
  const showSquadStatus = lobby.heal.hurtCount > 0 && !squadHealed;

  useEffect(() => {
    if (!lobby.autoPlay) return;
    // Sin RSC refresh: sólo limpia el query para el próximo visit.
    const url = new URL(window.location.href);
    if (url.searchParams.has("play")) {
      url.searchParams.delete("play");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [lobby.autoPlay]);

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
  const stageSuffix = stageLabel.startsWith(locationLabel)
    ? stageLabel.slice(locationLabel.length).replace(/^[\s·-]+/, "")
    : stageLabel;
  const predictedTypes = lobby.expedition?.predictedTypes ?? ["normal", "grass", "bug"];
  const mapSrc = lobby.expedition?.mapSrc;
  const regionNameKey = lobby.expedition?.regionNameKey ?? "regions.kanto";
  const caught = lobby.encounters.filter((e) => e.caught).length;

  const objectives = useMemo(
    () =>
      lobby.objectives.map((o) =>
        claimedIds.has(o.id) ? { ...o, claimed: true, claimable: false } : o,
      ),
    [lobby.objectives, claimedIds],
  );
  const trainersLeft = lobby.trainers.filter((tr) => !tr.defeated).length;
  const wildStages = lobby.stages.filter((s) => !s.isGym);

  function pickStage(stageId: string) {
    if (stagePending || stageId === lobby.farmingStageId) return;
    playUiSfx("badge");
    navigator.vibrate?.(10);
    startStage(async () => {
      await setFarmingStage(stageId, locale);
      router.refresh();
    });
  }

  async function claimObjective(objectiveId: string) {
    if (!lobby.zoneId || claimedIds.has(objectiveId)) return;
    setClaimedIds((prev) => new Set(prev).add(objectiveId));
    playUiSfx("badge");
    const { claimZoneObjective } = await import("@/actions/zone-rewards");
    const { playLootCollectFx, rewardToLootPiece } = await import("@/lib/loot-fly-fx");
    const result = await claimZoneObjective(intlLocale, lobby.zoneId, objectiveId);
    if (!result.ok) {
      setClaimedIds((prev) => {
        const next = new Set(prev);
        next.delete(objectiveId);
        return next;
      });
      return;
    }
    playLootCollectFx({
      coinsDelta: result.coins,
      pieces: [
        ...(result.coins > 0
          ? [rewardToLootPiece({ kind: "coins", amount: result.coins })]
          : []),
        rewardToLootPiece({
          kind: "item",
          itemName: result.itemName,
          quantity: result.quantity,
        }),
      ],
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 px-margin-mobile py-3">
      <section className="lobby-rise relative overflow-clip rounded-2xl border border-white/12 bg-surface-container-low shadow-[0_18px_44px_rgba(0,0,0,0.5)]">
        <div className="relative h-[168px] w-full overflow-clip bg-[#0b1424]">
          {mapSrc ? (
            <Image
              src={mapSrc}
              alt=""
              fill
              priority
              draggable={false}
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
                  {typeLabel(type)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tramos: chips nativos, sin abrir el mapa. */}
        {wildStages.length > 1 ? (
          <div className="lobby-stage-chips border-t border-white/8 px-3 pt-2.5">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
              {t("lobby.stages")}
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {wildStages.map((stage, index) => {
                const active = stage.id === lobby.farmingStageId;
                const locked = !stage.unlocked;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    disabled={locked || stagePending}
                    onClick={() => pickStage(stage.id)}
                    className={`lobby-stage-chip ${
                      active ? "lobby-stage-chip--active" : ""
                    } ${stage.done ? "lobby-stage-chip--done" : ""} ${
                      locked ? "lobby-stage-chip--locked" : ""
                    }`}
                    aria-pressed={active}
                    aria-label={tc(stage.nameKey)}
                  >
                    <span className="lobby-stage-chip__n">{index + 1}</span>
                    {stage.done ? (
                      <span className="material-symbols-outlined text-[12px]! leading-none">
                        check
                      </span>
                    ) : (
                      <span className="tabular-nums text-[9px] opacity-70">
                        {stage.clearsCurrent}/{stage.clearsRequired}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Objetivos de zona — misma info que home. */}
        {objectives.length > 0 ? (
          <div className="lobby-obj-row border-t border-white/8 px-3 py-2.5">
            {objectives.map((obj) => {
              const pct =
                obj.target > 0
                  ? Math.max(0, Math.min(100, Math.round((obj.current / obj.target) * 100)))
                  : 0;
              const complete = obj.done || obj.claimed;
              const isTrainers = obj.id === "trainers";
              const canFight = isTrainers && trainersLeft > 0 && !obj.claimed;
              const actionable = obj.claimable || canFight;
              return (
                <button
                  key={obj.id}
                  type="button"
                  disabled={!actionable}
                  onClick={() => {
                    if (obj.claimable) void claimObjective(obj.id);
                    else if (canFight) setTrainersOpen(true);
                  }}
                  className={`lobby-obj ${complete ? "lobby-obj--done" : ""} ${
                    obj.claimable ? "lobby-obj--ready" : ""
                  } ${canFight && !obj.claimable ? "lobby-obj--fight" : ""}`}
                  style={{ "--ring-pct": String(pct) } as CSSProperties}
                  aria-label={`${tc(`obj_${obj.id}`)} ${obj.current}/${obj.target}`}
                >
                  <span className="lobby-obj__ring" aria-hidden />
                  <span className="lobby-obj__icon">
                    <Image
                      src={OBJECTIVE_ICON[obj.id] ?? "/nav/adventure-icon.png"}
                      alt=""
                      width={22}
                      height={22}
                      unoptimized
                    />
                  </span>
                  <span className="lobby-obj__meta">
                    {obj.claimable
                      ? t("lobby.claim")
                      : canFight
                        ? t("lobby.fight")
                        : obj.claimed
                          ? t("lobby.claimed")
                          : `${obj.current}/${obj.target}`}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5 border-t border-white/8 p-3">
          {hasHealthyTeam ? (
            <StartEncounterButton
              locale={locale}
              label={t("explore")}
              errors={startErrors}
              disabled={!canExplore}
              energyCost={lobby.energyCost}
              autoStart={autoPlay}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-label-sm text-error">{t("errors.faintedLead")}</p>
              <Link href="/team" className="game-cta game-cta--red">
                <span className="material-symbols-outlined game-cta__icon">healing</span>
                <span className="game-cta__label">{t("goHeal")}</span>
              </Link>
            </div>
          )}

          {trainersLeft > 0 ? (
            <button
              type="button"
              onClick={() => {
                playUiSfx("badge");
                setTrainersOpen(true);
              }}
              className="lobby-secondary-cta"
            >
              <span className="material-symbols-outlined text-[18px]!">swords</span>
              <span>{t("lobby.challengeTrainers", { count: trainersLeft })}</span>
            </button>
          ) : null}
        </div>
      </section>

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

      {lobby.recent.length > 0 && (
        <section className="lobby-rise" style={{ animationDelay: "120ms" }}>
          <SectionTitle>{t("lobby.recent")}</SectionTitle>
          <div className="-mx-margin-mobile flex gap-3 overflow-x-auto overscroll-x-contain px-margin-mobile pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                      draggable={false}
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
                      draggable={false}
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

      <RouteTrainersSheet
        open={trainersOpen}
        onClose={() => setTrainersOpen(false)}
        locale={locale}
        zoneName={locationLabel}
        trainers={lobby.trainers as RouteTrainerRow[]}
      />
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
