"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  abandonTowerRun,
  applyTowerRest,
  challengeTowerFloor,
  chooseTowerBlessing,
  parkTowerRun,
  startTowerRun,
} from "@/actions/tower";
import { ConfirmModal } from "@/components/confirm-modal";
import { GameCtaButton } from "@/components/game-cta-button";
import { Link } from "@/i18n/navigation";
import type { TowerBlessing, TowerFloor, TowerPrimaryAction, TowerRunCreature } from "@/lib/tower";

export function TowerPrimaryActionButton({
  action,
  locale,
}: {
  action: TowerPrimaryAction;
  locale: string;
}) {
  const t = useTranslations("tower");
  const [pending, start] = useTransition();

  if (action.destination) {
    return (
      <GameCtaButton href={action.destination} variant="red" disabled={!action.enabled || pending}>
        {t(action.labelKey)}
      </GameCtaButton>
    );
  }

  const run = () => {
    start(async () => {
      if (action.action === "start_run" || action.action === "restart_run") {
        await startTowerRun(locale);
      } else if (action.action === "challenge_floor" || action.action === "continue_run") {
        await challengeTowerFloor(locale);
      } else if (action.action === "rest") {
        await applyTowerRest(locale);
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <GameCtaButton
        type="button"
        variant="red"
        disabled={!action.enabled || pending}
        onClick={run}
        icon={action.action === "rest" ? "hotel" : "swords"}
      >
        {pending ? t("actions.working") : t(action.labelKey)}
      </GameCtaButton>
      {action.reasonKey ? (
        <p className="text-center text-label-sm text-on-surface-variant">{t(action.reasonKey)}</p>
      ) : null}
    </div>
  );
}

export function TowerVerticalPath({
  floors,
  currentFloor,
  highestCleared,
}: {
  floors: TowerFloor[];
  currentFloor: number;
  highestCleared: number;
}) {
  const t = useTranslations("tower");

  return (
    <ol className="relative mx-auto flex w-full max-w-md flex-col gap-0 py-2">
      <div
        className="pointer-events-none absolute top-4 bottom-4 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-pokeball-red/50 via-white/15 to-transparent"
        aria-hidden
      />
      {floors.map((floor) => {
        const cleared = floor.floorNumber < currentFloor || floor.floorNumber <= highestCleared;
        const isCurrent = floor.floorNumber === currentFloor;
        const isBoss = floor.type === "boss";
        return (
          <li
            key={floor.id}
            className={`relative z-10 flex items-center gap-3 py-1.5 ${
              isCurrent ? "scale-[1.02]" : ""
            }`}
          >
            <div className="flex w-14 shrink-0 flex-col items-end text-right">
              <span
                className={`font-mono text-label-sm ${
                  isCurrent ? "text-pokeball-red" : cleared ? "text-tertiary" : "text-on-surface-variant"
                }`}
              >
                {floor.floorNumber}
              </span>
            </div>
            <div
              className={`flex h-3 w-3 shrink-0 rounded-full border-2 ${
                isBoss
                  ? "border-tertiary bg-tertiary/40 shadow-[0_0_12px_rgba(212,175,55,0.45)]"
                  : isCurrent
                    ? "border-pokeball-red bg-pokeball-red"
                    : cleared
                      ? "border-emerald-400/80 bg-emerald-500/50"
                      : "border-white/25 bg-[#1a1a1a]"
              }`}
            />
            <div
              className={`min-w-0 flex-1 rounded-lg border px-3 py-2 ${
                isCurrent
                  ? "border-pokeball-red/50 bg-pokeball-red/10"
                  : isBoss
                    ? "border-tertiary/30 bg-tertiary/5"
                    : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <p className="text-label-md font-semibold text-on-surface">
                {t(`floorTypes.${floor.type}`)}
                {isCurrent ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-pokeball-red">
                    {t("path.current")}
                  </span>
                ) : null}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                {t("path.recommendedPc", { pc: floor.recommendedCombatPower })}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function TowerCurrentTeam({ team }: { team: TowerRunCreature[] }) {
  const t = useTranslations("tower");
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
        {t("team.title")}
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {team.map((m) => {
          const pct = m.maxHp > 0 ? Math.round((m.currentHp / m.maxHp) * 100) : 0;
          return (
            <li
              key={m.instanceId}
              className={`flex flex-col items-center rounded-lg border px-1 py-2 ${
                m.defeated || m.currentHp <= 0
                  ? "border-white/5 opacity-40"
                  : "border-white/10 bg-black/20"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.spriteUrl} alt="" className="h-10 w-10 object-contain" />
              <span className="mt-1 max-w-full truncate text-[10px] text-on-surface">
                {m.nickname ?? m.speciesName}
              </span>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full ${pct > 40 ? "bg-emerald-400" : pct > 15 ? "bg-amber-400" : "bg-error"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TowerBlessingSelector({
  blessings,
  locale,
}: {
  blessings: TowerBlessing[];
  locale: string;
}) {
  const t = useTranslations("tower");
  const [pending, start] = useTransition();

  return (
    <div className="rounded-xl border border-violet-400/30 bg-violet-500/5 p-4">
      <p className="text-center text-label-md font-bold text-violet-200">{t("blessing.pickTitle")}</p>
      <p className="mt-1 text-center text-label-sm text-on-surface-variant">{t("blessing.pickHint")}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {blessings.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => chooseTowerBlessing(b.id, locale))}
              className="flex min-h-11 w-full flex-col rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-left transition-colors hover:border-violet-300/40 hover:bg-violet-500/10 disabled:opacity-40"
            >
              <span className="text-label-md font-semibold text-on-surface">{t(b.nameKey)}</span>
              <span className="text-label-sm text-on-surface-variant">{t(b.descriptionKey)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TowerParkButton({
  locale,
  variant = "panel",
}: {
  locale: string;
  variant?: "panel" | "header" | "bar";
}) {
  const t = useTranslations("tower");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const trigger =
    variant === "header" ? (
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-white/35 bg-black/40 px-2.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm transition-colors hover:bg-white/10 disabled:opacity-40 sm:min-h-9 sm:px-3 sm:text-label-sm"
      >
        <span className="material-symbols-outlined text-[14px]! sm:text-[16px]!">home</span>
        {t("park.cta")}
      </button>
    ) : variant === "bar" ? (
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="mt-1.5 w-full min-h-9 text-center text-[11px] font-medium text-white/70 underline-offset-2 transition-colors hover:text-white hover:underline disabled:opacity-40"
      >
        {t("park.cta")}
      </button>
    ) : (
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="min-h-11 w-full rounded-lg border border-white/20 bg-white/[0.04] px-4 py-2 text-label-sm text-on-surface transition-colors hover:bg-white/[0.08] disabled:opacity-40"
      >
        {t("park.cta")}
      </button>
    );

  return (
    <>
      {trigger}
      <ConfirmModal
        open={open}
        title={t("park.title")}
        body={t("park.body")}
        confirmLabel={t("park.confirmCta")}
        cancelLabel={t("park.cancel")}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          start(async () => {
            await parkTowerRun(locale);
            setOpen(false);
          });
        }}
      />
    </>
  );
}

export function TowerAbandonButton({
  locale,
  variant = "panel",
}: {
  locale: string;
  /** panel = bloque ancho; header = chip del hero; bar = link bajo el CTA. */
  variant?: "panel" | "header" | "bar";
}) {
  const t = useTranslations("tower");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const trigger =
    variant === "header" ? (
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-error/40 bg-black/40 px-2.5 py-0.5 text-[10px] font-semibold text-error/95 backdrop-blur-sm transition-colors hover:bg-error/15 disabled:opacity-40 sm:min-h-9 sm:px-3 sm:text-label-sm"
      >
        <span className="material-symbols-outlined text-[14px]! sm:text-[16px]!">logout</span>
        {t("abandon.cta")}
      </button>
    ) : variant === "bar" ? (
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="mt-1 w-full min-h-8 text-center text-[10px] font-medium text-error/70 underline-offset-2 transition-colors hover:text-error hover:underline disabled:opacity-40"
      >
        {t("abandon.cta")}
      </button>
    ) : (
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="min-h-11 w-full rounded-lg border border-error/30 px-4 py-2 text-label-sm text-error/90 transition-colors hover:bg-error/10 disabled:opacity-40"
      >
        {t("abandon.cta")}
      </button>
    );

  return (
    <>
      {trigger}
      <ConfirmModal
        open={open}
        tone="danger"
        title={t("abandon.title")}
        body={t("abandon.body")}
        confirmLabel={t("abandon.confirmCta")}
        cancelLabel={t("abandon.cancel")}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          start(async () => {
            await abandonTowerRun(locale);
            setOpen(false);
          });
        }}
      />
    </>
  );
}

export function TowerFloorDetails({ floor }: { floor: TowerFloor }) {
  const t = useTranslations("tower");
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
        {t("floorDetail.title", { n: floor.floorNumber })}
      </p>
      <p className="mt-1 text-label-md font-semibold">{t(`floorTypes.${floor.type}`)}</p>
      <p className="text-label-sm text-on-surface-variant">
        {t("path.recommendedPc", { pc: floor.recommendedCombatPower })}
      </p>
      {floor.modifiers.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {floor.modifiers.map((m) => (
            <li key={m.id} className="rounded-md border border-violet-400/20 bg-violet-500/5 px-2 py-1.5">
              <p className="text-label-sm font-semibold text-violet-200">{t(m.nameKey)}</p>
              <p className="text-[11px] text-on-surface-variant">{t(m.descriptionKey)}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {floor.enemies.length > 0 ? (
        <p className="mt-2 text-label-sm text-on-surface-variant">
          {t("floorDetail.enemies", { count: floor.enemies.length })}
        </p>
      ) : null}
    </div>
  );
}

export function TowerLockedState({ minBadges }: { minBadges: number }) {
  const t = useTranslations("tower");
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
      <span className="material-symbols-outlined text-4xl text-on-surface-variant">lock</span>
      <h2 className="mt-2 text-headline-sm font-bold">{t("locked.title")}</h2>
      <p className="mt-2 text-label-md text-on-surface-variant">
        {t("locked.body", { count: minBadges })}
      </p>
      <Link
        href="/gyms"
        className="ui-btn-primary mt-4 min-h-11 px-5 text-label-md font-bold"
      >
        {t("locked.cta")}
      </Link>
    </div>
  );
}
