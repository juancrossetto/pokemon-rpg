"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { devTowerResetAttempts, devTowerSetFloor, devTowerUnlock } from "@/actions/tower-dev";

export function TowerDevPanel({ locale }: { locale: string }) {
  const t = useTranslations("tower");
  const [pending, start] = useTransition();

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <details className="rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 open:pb-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-label-sm text-amber-200 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="material-symbols-outlined text-[18px]!">construction</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]">{t("dev.title")}</span>
      </summary>
      <div className="flex flex-wrap gap-2 border-t border-amber-400/20 px-4 pt-3">
        <button
          type="button"
          disabled={pending}
          className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-3 text-label-sm disabled:opacity-40"
          onClick={() => start(async () => devTowerUnlock(locale))}
        >
          {t("dev.unlock")}
        </button>
        <button
          type="button"
          disabled={pending}
          className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-3 text-label-sm disabled:opacity-40"
          onClick={() => start(async () => devTowerResetAttempts(locale))}
        >
          {t("dev.resetAttempts")}
        </button>
        <button
          type="button"
          disabled={pending}
          className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-3 text-label-sm disabled:opacity-40"
          onClick={() => start(async () => devTowerSetFloor(10, locale))}
        >
          {t("dev.setFloor10")}
        </button>
        <button
          type="button"
          disabled={pending}
          className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-3 text-label-sm disabled:opacity-40"
          onClick={() => start(async () => devTowerSetFloor(25, locale))}
        >
          {t("dev.setFloor25")}
        </button>
      </div>
    </details>
  );
}
