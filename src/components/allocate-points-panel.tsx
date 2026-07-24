"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { allocatePoints } from "@/actions/allocate-points";
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

export function AllocatePointsPanel({
  instanceId,
  level,
  unspentPoints,
  points,
  bases,
}: {
  instanceId: string;
  level: number;
  unspentPoints: number;
  points: CurrentPoints;
  bases: SpeciesBases;
}) {
  const t = useTranslations("team");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<CurrentPoints>(() =>
    Object.fromEntries(MANUAL_STAT_KEYS.map((k) => [k, 0])) as CurrentPoints,
  );
  const [error, setError] = useState<string | null>(null);

  const spent = useMemo(
    () => MANUAL_STAT_KEYS.reduce((sum, key) => sum + draft[key], 0),
    [draft],
  );
  const remaining = unspentPoints - spent;

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

  function resetDraft() {
    setDraft(Object.fromEntries(MANUAL_STAT_KEYS.map((k) => [k, 0])) as CurrentPoints);
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
      resetDraft();
      setOpen(false);
    });
  }

  if (unspentPoints <= 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-tertiary/25 bg-tertiary/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition hover:bg-tertiary/10"
      >
        <span className="material-symbols-outlined text-[14px] text-tertiary">bolt</span>
        <span className="flex-1 text-[10px] font-medium text-tertiary">
          {t("unspentPoints", { count: unspentPoints })}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-tertiary">
          {open ? t("allocateHide") : t("allocateShow")}
        </span>
      </button>

      {open && (
        <div className="border-t border-tertiary/20 px-2 pb-2 pt-1.5">
          <p className="mb-1.5 text-[9px] text-on-surface-variant">{t("allocateHint")}</p>
          <div className="mb-1.5 flex items-center justify-between text-[10px]">
            <span className="text-on-surface-variant">{t("allocateRemaining")}</span>
            <span className="font-mono font-semibold text-tertiary">{remaining}</span>
          </div>

          <div className="flex flex-col gap-1">
            {STAT_META.map(({ key, labelKey, affectsKey }) => {
              const invested = points[key];
              const adding = draft[key];
              const projected = previewStat(key, bases, level, {
                ...points,
                [key]: invested + adding,
              });
              const atCap = invested + adding >= MAX_POINTS_PER_STAT;
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-black/20 px-1.5 py-1"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold text-white">
                      {t(`attrs.${labelKey}`)}
                    </p>
                    <p className="truncate text-[8px] text-on-surface-variant">
                      {t(`stats.${affectsKey}`)}
                      {key === "ptIntelligence" ? ` / ${t("stats.spDef")}` : ""}
                      {" · "}
                      {invested}
                      {adding > 0 ? `+${adding}` : ""}/{MAX_POINTS_PER_STAT}
                      {" → "}
                      <span className="font-mono text-on-surface">{projected}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="-"
                    disabled={adding <= 0 || pending}
                    onClick={() => bump(key, -1)}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-on-surface transition hover:border-white/25 disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-[14px]">remove</span>
                  </button>
                  <span className="w-4 text-center font-mono text-[11px] font-semibold text-white">
                    {adding}
                  </span>
                  <button
                    type="button"
                    aria-label="+"
                    disabled={remaining <= 0 || atCap || pending}
                    onClick={() => bump(key, 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-on-surface transition hover:border-white/25 disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                  </button>
                </div>
              );
            })}
          </div>

          {error && <p className="mt-1.5 text-[10px] text-error">{error}</p>}

          <div className="mt-2 flex gap-1.5">
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
              className="flex-[1.4] rounded-md bg-tertiary px-2 py-1.5 text-[10px] font-bold text-surface transition hover:brightness-110 disabled:opacity-40"
            >
              {pending ? t("allocateSaving") : t("allocateConfirm", { count: spent })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
