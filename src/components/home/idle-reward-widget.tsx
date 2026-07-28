"use client";

import { useRouter } from "@/i18n/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { claimDailyReward } from "@/actions/claim-reward";
import { announceCoinDelta } from "@/lib/coin-fx";
import { showToast } from "@/lib/app-toast";
import type { DailyState, WeeklyState } from "@/lib/events/state";

export type IdleRewardLabels = {
  title: string;
  claim: string;
  claiming: string;
  claimed: string;
  empty: string;
  seeEvents: string;
  pendingWeekly: string;
  dailyReady: string;
};

/**
 * Widget compacto de recompensas (diario + pendientes semanales).
 * El modal auto-open del regalo diario sigue en el hub por separado.
 */
export function IdleRewardWidget({
  locale,
  daily,
  weekly,
  pendingCount,
  labels,
}: {
  locale: string;
  daily: DailyState;
  weekly: WeeklyState;
  pendingCount: number;
  labels: IdleRewardLabels;
}) {
  const router = useRouter();
  const tEvents = useTranslations("events");
  const [pending, startTransition] = useTransition();
  const canClaimDaily = daily.canClaim;
  const weeklyClaimable = weekly.milestones.filter((m) => m.claimable).length;
  const hasAttention = canClaimDaily || weeklyClaimable > 0;

  function claim() {
    if (!canClaimDaily || pending) return;
    startTransition(async () => {
      const result = await claimDailyReward(locale);
      if (!result.ok) {
        // Carrera con otra pestaña o error de server: avisar y realinear.
        showToast(tEvents("errorGeneric"), "error");
        router.refresh();
        return;
      }
      if (result.coinsDelta !== 0) announceCoinDelta(result.coinsDelta);
      router.refresh();
    });
  }

  return (
    <section
      className={`idle-reward relative overflow-hidden rounded-2xl border px-3.5 py-3 ${
        hasAttention
          ? "idle-reward--ready border-tertiary/35 bg-gradient-to-r from-tertiary/15 via-white/[0.04] to-transparent"
          : "border-white/10 bg-white/[0.03]"
      }`}
      aria-label={labels.title}
    >
      <div className="flex items-center gap-3">
        <div
          className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${
            hasAttention
              ? "idle-reward__chest border-tertiary/40 bg-tertiary/15 text-tertiary"
              : "border-white/10 bg-white/[0.04] text-on-surface-variant"
          }`}
          aria-hidden
        >
          <span className="material-symbols-outlined text-[26px]!">
            {hasAttention ? "redeem" : "inventory_2"}
          </span>
          {hasAttention && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pokeball-red px-1 text-[10px] font-bold text-white">
              {pendingCount > 0 ? pendingCount : "!"}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">{labels.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-on-surface-variant">
            {canClaimDaily
              ? labels.dailyReady
              : weeklyClaimable > 0
                ? labels.pendingWeekly
                : labels.empty}
            {/* La racha no desaparece al reclamar: es la motivación de volver mañana. */}
            {" · "}
            <span className={canClaimDaily ? "" : "text-tertiary/90"}>
              {tEvents("dailyProgress", { current: daily.currentDay, total: daily.length })}
            </span>
          </p>
        </div>

        {canClaimDaily ? (
          <button
            type="button"
            onClick={claim}
            disabled={pending}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-tertiary px-3.5 text-[13px] font-bold text-surface shadow-[0_6px_16px_rgba(242,192,0,0.25)] transition hover:bg-tertiary/90 active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? labels.claiming : labels.claim}
          </button>
        ) : weeklyClaimable > 0 ? (
          <Link
            href="/events"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-tertiary/40 bg-tertiary/15 px-3.5 text-[13px] font-semibold text-tertiary transition hover:bg-tertiary/25 active:scale-[0.98]"
          >
            {labels.seeEvents}
          </Link>
        ) : (
          <span className="shrink-0 text-[12px] text-on-surface-variant/70">{labels.claimed}</span>
        )}
      </div>
    </section>
  );
}
