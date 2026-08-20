import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { loadSeasonJourney } from "@/lib/season-journey";
import { claimSeasonReward } from "@/actions/season";
import { MarketSubmitButton } from "@/components/market-submit-button";
import type { RewardDef } from "@/lib/events/rewards";

function rewardIcon(reward: RewardDef) {
  if (reward.kind === "coins") return "paid";
  if (reward.kind === "gems") return "diamond";
  if (reward.kind === "energy") return "bolt";
  return "inventory_2";
}

export default async function SeasonPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [session, t] = await Promise.all([auth(), getTranslations("seasonJourney")]);
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  await redirectIfInBattle(session.user.id, locale);
  const state = await loadSeasonJourney(session.user.id);
  const maxXp = state.milestones.at(-1)?.xp ?? 1;
  const progress = Math.min(100, (state.activity.xp / maxXp) * 100);
  const end = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(state.endsAt));

  return (
    <main className="flex-1 px-margin-mobile py-5 md:px-margin-desktop md:py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="season-journey-hero">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-electric-yellow">{t("eyebrow", { key: state.seasonKey })}</p>
            <h1 className="page-title mt-1 text-headline-lg text-white md:text-display-sm">{t("title")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/58">{t("subtitle")}</p>
          </div>
          <div className="season-journey-hero__xp">
            <strong>{state.activity.xp.toLocaleString(locale)}</strong>
            <span>{t("xp")}</span>
          </div>
          <div className="season-journey-progress"><span style={{ width: `${progress}%` }} /></div>
          <p className="text-[11px] text-white/45">{t("ends", { date: end })}</p>
        </header>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(["wins", "catches", "gyms", "pvp", "raids"] as const).map((metric) => (
            <div key={metric} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
              <strong className="block font-mono text-xl text-white">{state.activity[metric]}</strong>
              <span className="text-[10px] font-bold uppercase tracking-wide text-white/42">{t(`metrics.${metric}`)}</span>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3" aria-label={t("track")}> 
          {state.milestones.map((milestone, index) => {
            const unlocked = state.activity.xp >= milestone.xp;
            return (
              <article key={milestone.xp} className={`season-journey-tier ${unlocked ? "is-unlocked" : ""}`}>
                <div className="season-journey-tier__level">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-bold text-white">{t("milestone", { xp: milestone.xp })}</h2>
                    <span className="font-mono text-xs text-white/45">{Math.min(state.activity.xp, milestone.xp)}/{milestone.xp}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {milestone.rewards.map((reward, rewardIndex) => (
                      <span key={`${reward.kind}-${rewardIndex}`} className="inline-flex items-center gap-1 rounded-lg border border-white/8 bg-black/20 px-2 py-1 text-xs text-white/72">
                        <span className="material-symbols-outlined text-[15px]! text-electric-yellow">{rewardIcon(reward)}</span>
                        {reward.kind === "item" ? `${reward.itemName} ×${reward.quantity}` : t(`rewards.${reward.kind}`, { amount: reward.amount })}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="w-full sm:w-36">
                  {milestone.claimed ? (
                    <span className="flex h-10 items-center justify-center gap-1 rounded-xl border border-emerald-400/25 bg-emerald-400/8 text-xs font-bold text-emerald-300"><span className="material-symbols-outlined text-[16px]!">check</span>{t("claimed")}</span>
                  ) : (
                    <form action={claimSeasonReward.bind(null, locale)}>
                      <input type="hidden" name="milestone" value={milestone.xp} />
                      <MarketSubmitButton label={unlocked ? t("claim") : t("locked")} pendingLabel={t("claiming")} disabled={!unlocked} className="ui-btn-primary h-10 w-full rounded-xl text-xs font-bold disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/30" />
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
