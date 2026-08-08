"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { allocatePoints } from "@/actions/allocate-points";
import { showToast } from "@/lib/app-toast";
import {
  calculateMaxHp,
  calculateStat,
  MANUAL_STAT_KEYS,
  MAX_POINTS_PER_STAT,
  type ManualStatKey,
} from "@/lib/stats";

type SpeciesBases = {
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpAtk: number;
  baseSpDef: number;
  baseSpeed: number;
};

type CurrentPoints = Record<ManualStatKey, number>;

const STAT_META: {
  key: ManualStatKey;
  labelKey: ManualStatKey;
  affectsKey: "hp" | "atk" | "def" | "spAtk" | "spDef" | "speed";
}[] = [
  { key: "ptStrength", labelKey: "ptStrength", affectsKey: "atk" },
  { key: "ptDexterity", labelKey: "ptDexterity", affectsKey: "def" },
  { key: "ptIntelligence", labelKey: "ptIntelligence", affectsKey: "spAtk" },
  { key: "ptSpeed", labelKey: "ptSpeed", affectsKey: "speed" },
  { key: "ptConstitution", labelKey: "ptConstitution", affectsKey: "hp" },
];

function previewStat(
  key: ManualStatKey,
  bases: SpeciesBases,
  level: number,
  points: CurrentPoints,
): number {
  switch (key) {
    case "ptStrength":
      return calculateStat(bases.baseAttack, points.ptStrength, level);
    case "ptDexterity":
      return calculateStat(bases.baseDefense, points.ptDexterity, level);
    case "ptIntelligence":
      return calculateStat(bases.baseSpAtk, points.ptIntelligence, level);
    case "ptSpeed":
      return calculateStat(bases.baseSpeed, points.ptSpeed, level);
    case "ptConstitution":
      return calculateMaxHp(bases.baseHp, level, points.ptConstitution);
  }
}

function emptyDraft(): CurrentPoints {
  return Object.fromEntries(MANUAL_STAT_KEYS.map((k) => [k, 0])) as CurrentPoints;
}

export function AllocatePointsPanel({
  instanceId,
  level,
  unspentPoints,
  points,
  bases,
  defaultOpen = false,
  /** Sin toggle: panel siempre desplegado (overlay del menú ⋮). */
  alwaysOpen = false,
  onClose,
  onAllocated,
}: {
  instanceId: string;
  level: number;
  unspentPoints: number;
  points: CurrentPoints;
  bases: SpeciesBases;
  defaultOpen?: boolean;
  alwaysOpen?: boolean;
  onClose?: () => void;
  onAllocated?: (next: {
    unspentPoints: number;
    points: CurrentPoints;
    maxHp: number;
    currentHpDelta: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
  }) => void;
}) {
  const t = useTranslations("team");
  const locale = useLocale();
  const [open, setOpen] = useState(alwaysOpen || defaultOpen);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<CurrentPoints>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const spent = useMemo(
    () => MANUAL_STAT_KEYS.reduce((sum, key) => sum + draft[key], 0),
    [draft],
  );
  const remaining = unspentPoints - spent;
  const canAllocate = unspentPoints > 0;
  const expanded = alwaysOpen || open;

  function clearHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  }

  function bump(key: ManualStatKey, delta: number) {
    setError(null);
    setDraft((prev) => {
      const nextValue = prev[key] + delta;
      if (nextValue < 0) return prev;
      const nextSpent = MANUAL_STAT_KEYS.reduce(
        (sum, k) => sum + (k === key ? nextValue : prev[k]),
        0,
      );
      if (nextSpent > unspentPoints) return prev;
      if (points[key] + nextValue > MAX_POINTS_PER_STAT) return prev;
      return { ...prev, [key]: nextValue };
    });
  }

  function setAbsolute(key: ManualStatKey, raw: number) {
    setError(null);
    const wanted = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    setDraft((prev) => {
      const roomStat = MAX_POINTS_PER_STAT - points[key];
      const roomPool = unspentPoints - MANUAL_STAT_KEYS.reduce(
        (sum, k) => sum + (k === key ? 0 : prev[k]),
        0,
      );
      const nextValue = Math.min(wanted, roomStat, Math.max(0, roomPool));
      return { ...prev, [key]: nextValue };
    });
  }

  function maxOut(key: ManualStatKey) {
    setError(null);
    setDraft((prev) => {
      const roomStat = MAX_POINTS_PER_STAT - points[key];
      const roomPool = unspentPoints - MANUAL_STAT_KEYS.reduce(
        (sum, k) => sum + (k === key ? 0 : prev[k]),
        0,
      );
      return { ...prev, [key]: Math.max(0, Math.min(roomStat, roomPool)) };
    });
  }

  function startHold(key: ManualStatKey, delta: number) {
    clearHold();
    bump(key, delta);
    holdTimer.current = setTimeout(() => {
      holdInterval.current = setInterval(() => bump(key, delta), 60);
    }, 350);
  }

  function resetDraft() {
    setDraft(emptyDraft());
    setError(null);
  }

  function confirm() {
    if (spent <= 0 || pending) return;
    startTransition(async () => {
      const result = await allocatePoints(instanceId, draft, locale);
      if (!result.ok) {
        setError(t(`allocateErrors.${result.error}`));
        return;
      }
      const nextPoints = {
        ptStrength: points.ptStrength + draft.ptStrength,
        ptDexterity: points.ptDexterity + draft.ptDexterity,
        ptIntelligence: points.ptIntelligence + draft.ptIntelligence,
        ptSpeed: points.ptSpeed + draft.ptSpeed,
        ptConstitution: points.ptConstitution + draft.ptConstitution,
      };
      const oldMaxHp = calculateMaxHp(bases.baseHp, level, points.ptConstitution);
      const newMaxHp = calculateMaxHp(bases.baseHp, level, nextPoints.ptConstitution);
      onAllocated?.({
        unspentPoints: unspentPoints - spent,
        points: nextPoints,
        maxHp: newMaxHp,
        currentHpDelta: newMaxHp - oldMaxHp,
        atk: calculateStat(bases.baseAttack, nextPoints.ptStrength, level),
        def: calculateStat(bases.baseDefense, nextPoints.ptDexterity, level),
        spAtk: calculateStat(bases.baseSpAtk, nextPoints.ptIntelligence, level),
        spDef: calculateStat(bases.baseSpDef, nextPoints.ptIntelligence, level),
        speed: calculateStat(bases.baseSpeed, nextPoints.ptSpeed, level),
      });
      // Asignar puntos es un beat de progresión: merece festejo, no un
      // panel que se cierra mudo.
      showToast(t("allocateSuccess", { count: spent }), "success");
      resetDraft();
      if (alwaysOpen) {
        onClose?.();
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-white/12 bg-white/[0.04]">
      {alwaysOpen ? (
        <div className="flex w-full items-center gap-1.5 px-2 py-1.5">
          <span className="material-symbols-outlined text-[14px]! text-white/75">bolt</span>
          <span className="flex-1 text-[10px] font-medium text-white/75">
            {canAllocate
              ? t("unspentPoints", { count: unspentPoints })
              : t("allocateViewOnly")}
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/75 transition hover:bg-white/10"
            >
              {t("allocateHide")}
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition hover:bg-white/[0.04]"
        >
          <span className="material-symbols-outlined text-[14px]! text-white/75">bolt</span>
          <span className="flex-1 text-[10px] font-medium text-white/75">
            {canAllocate
              ? t("unspentPoints", { count: unspentPoints })
              : t("allocateViewOnly")}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
            {expanded ? t("allocateHide") : t("allocateShow")}
          </span>
        </button>
      )}

      {expanded && (
        <div className="border-t border-white/10 px-1.5 pb-1.5 pt-1">
          {canAllocate ? (
            <div className="mb-1 flex items-baseline justify-between gap-2 px-0.5">
              <p className="min-w-0 truncate text-[9px] leading-tight text-on-surface-variant">
                {t("allocateHint")}
              </p>
              <p className="shrink-0 text-[10px] tabular-nums">
                <span className="text-on-surface-variant">{t("allocateRemaining")} </span>
                <span className="font-mono font-semibold text-white">{remaining}</span>
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            {STAT_META.map(({ key, labelKey, affectsKey }) => {
              const invested = points[key];
              const adding = draft[key];
              const projected = previewStat(key, bases, level, {
                ...points,
                [key]: invested + adding,
              });
              const atCap = invested + adding >= MAX_POINTS_PER_STAT;
              const roomLeft = Math.min(
                MAX_POINTS_PER_STAT - invested - adding,
                remaining,
              );
              const combatLabel =
                key === "ptIntelligence"
                  ? `${t("allocateAffects.spAtk")} / ${t("allocateAffects.spDef")}`
                  : t(`allocateAffects.${affectsKey}`);

              return (
                <div
                  key={key}
                  className="rounded-md border border-white/[0.06] bg-black/20 px-1.5 py-1"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className="min-w-0 flex-1">
                      {/*
                        Stats de combate primero; el atributo RPG va como
                        meta en la misma línea para no sumar una fila.
                      */}
                      <p className="truncate text-[11px] font-semibold leading-tight text-white">
                        {combatLabel}
                        <span className="ml-1 font-mono text-[11px] font-bold text-white">
                          {projected}
                        </span>
                        <span className="ml-1.5 text-[9px] font-normal text-on-surface-variant">
                          {t(`attrs.${labelKey}`)} · {invested}
                          {adding > 0 ? (
                            <span className="text-white/80">+{adding}</span>
                          ) : null}
                          /{MAX_POINTS_PER_STAT}
                        </span>
                      </p>
                    </div>
                    {!canAllocate ? (
                      <span className="shrink-0 font-mono text-[11px] font-semibold text-white">
                        {invested}
                      </span>
                    ) : null}
                  </div>

                  {canAllocate ? (
                    <div className="mt-1 flex flex-nowrap items-center gap-0.5">
                      <button
                        type="button"
                        aria-label="-"
                        disabled={adding <= 0 || pending}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          startHold(key, -1);
                        }}
                        onPointerUp={clearHold}
                        onPointerLeave={clearHold}
                        onPointerCancel={clearHold}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/10 text-on-surface transition hover:border-white/25 disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-[13px]!">remove</span>
                      </button>
                      <label className="sr-only" htmlFor={`alloc-${instanceId}-${key}`}>
                        {t("allocateAmount")}
                      </label>
                      <input
                        id={`alloc-${instanceId}-${key}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MAX_POINTS_PER_STAT - invested}
                        value={adding}
                        disabled={pending}
                        onChange={(e) => setAbsolute(key, Number(e.target.value))}
                        className="h-6 w-9 shrink-0 rounded border border-white/10 bg-black/40 px-0.5 text-center font-mono text-[11px] font-semibold text-white outline-none focus:border-white/30"
                      />
                      <button
                        type="button"
                        aria-label="+"
                        disabled={remaining <= 0 || atCap || pending}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          startHold(key, 1);
                        }}
                        onPointerUp={clearHold}
                        onPointerLeave={clearHold}
                        onPointerCancel={clearHold}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/10 text-on-surface transition hover:border-white/25 disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-[13px]!">add</span>
                      </button>
                      <button
                        type="button"
                        disabled={roomLeft < 5 || pending}
                        onClick={() => bump(key, 5)}
                        className="h-6 shrink-0 rounded border border-white/10 px-1 text-[8px] font-bold text-on-surface transition hover:border-white/25 disabled:opacity-30"
                      >
                        {t("allocateAddFive")}
                      </button>
                      <button
                        type="button"
                        disabled={roomLeft < 10 || pending}
                        onClick={() => bump(key, 10)}
                        className="h-6 shrink-0 rounded border border-white/10 px-1 text-[8px] font-bold text-on-surface transition hover:border-white/25 disabled:opacity-30"
                      >
                        {t("allocateAddTen")}
                      </button>
                      <button
                        type="button"
                        disabled={roomLeft <= 0 || pending}
                        onClick={() => maxOut(key)}
                        className="ml-auto h-6 shrink-0 rounded border border-white/20 px-1.5 text-[8px] font-bold text-white/80 transition hover:border-white/40 disabled:opacity-30"
                      >
                        {t("allocateMax")}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {canAllocate ? (
            <>
              {error && <p className="mt-1 text-[10px] text-error">{error}</p>}

              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  disabled={spent <= 0 || pending}
                  onClick={resetDraft}
                  className="flex-1 rounded-md border border-white/10 px-2 py-1.5 text-[10px] font-semibold text-on-surface-variant transition hover:border-white/20 disabled:opacity-40"
                >
                  {t("allocateReset")}
                </button>
                <button
                  type="button"
                  disabled={spent <= 0 || pending}
                  onClick={confirm}
                  className="flex-[1.4] rounded-md border border-white/20 bg-white/15 px-2 py-1.5 text-[10px] font-bold text-white transition hover:bg-white/22 disabled:opacity-40"
                >
                  {pending ? t("allocateSaving") : t("allocateConfirm", { count: spent })}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
