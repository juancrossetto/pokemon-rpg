"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { startTrainerBattle } from "@/actions/route-trainer";
import { campaignTrainerErrorKey } from "@/lib/campaign/client-errors";
import { playUiSfx } from "@/lib/battle-sfx";
import { lockBodyScroll } from "@/lib/scroll-lock";

export type RouteTrainerRow = {
  id: string;
  nameKey: string;
  spriteUrl: string;
  level: number;
  defeated: boolean;
};

/**
 * Sheet nativo de entrenadores de la zona actual.
 * Home y lobby mobile lo abren para pelear sin pasar por Campaign.
 */
export function RouteTrainersSheet({
  open,
  onClose,
  locale,
  trainers,
  zoneName,
}: {
  open: boolean;
  onClose: () => void;
  locale: string;
  trainers: RouteTrainerRow[];
  zoneName?: string | null;
}) {
  const t = useTranslations("campaign");
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const release = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      release();
    };
  }, [open, onClose]);

  function fight(trainerId: string) {
    if (pending) return;
    setError(null);
    playUiSfx("badge");
    navigator.vibrate?.(14);
    start(async () => {
      const result = await startTrainerBattle(trainerId, locale);
      if (result && !result.success) {
        setError(t(campaignTrainerErrorKey(result.error)));
      }
      // success → redirect server-side a /battle
    });
  }

  if (!open || !mounted) return null;

  const remaining = trainers.filter((tr) => !tr.defeated).length;

  return createPortal(
    <div className="fixed inset-0 z-200 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6 lg:hidden">
      <button
        type="button"
        aria-label={t("trainersSheetClose")}
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("trainersTitle")}
        className="route-trainers-sheet relative flex max-h-[min(78dvh,100%)] w-full flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#12141a] shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="shrink-0 border-b border-white/8 px-4 pb-3 pt-2.5">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                {zoneName ?? t("trainersTitle")}
              </p>
              <h2 className="truncate text-[17px] font-semibold tracking-tight text-white">
                {t("trainersTitle")}
              </h2>
            </div>
            <span className="shrink-0 rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white/75">
              {remaining}/{trainers.length}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-white/55">
            {t("trainersSheetHint")}
          </p>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5">
          {trainers.map((tr) => (
            <li
              key={tr.id}
              className={`mb-2 flex items-center gap-3 rounded-xl border px-3 py-2.5 last:mb-0 ${
                tr.defeated
                  ? "border-white/6 bg-white/[0.03] opacity-65"
                  : "border-white/10 bg-white/[0.05]"
              }`}
            >
              <Image
                src={tr.spriteUrl}
                alt=""
                width={40}
                height={40}
                className={`h-10 w-10 object-contain ${tr.defeated ? "grayscale" : ""}`}
                unoptimized
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-white">
                  {t(tr.nameKey)}
                </p>
                <p className="text-[11px] text-white/50">Lv. {tr.level}</p>
              </div>
              {tr.defeated ? (
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                  {t("trainerBeaten")}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => fight(tr.id)}
                  className="ui-btn-primary shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide disabled:opacity-50"
                >
                  {pending ? "…" : t("trainerFight")}
                </button>
              )}
            </li>
          ))}
        </ul>

        {error ? (
          <p className="shrink-0 border-t border-error/20 bg-error/10 px-4 py-2 text-[11px] text-error">
            {error}
          </p>
        ) : null}

        <div className="shrink-0 border-t border-white/8 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-white/12 bg-white/5 py-2.5 text-[13px] font-semibold text-white/80"
          >
            {t("trainersSheetClose")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
