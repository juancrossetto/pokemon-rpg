import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { listLocationsForUi, journeyProgressPercent } from "@/lib/campaign";
import { prisma } from "@/lib/prisma";
import { CampaignJourneyMap } from "@/components/campaign-journey-map";
import { CampaignDevPanel } from "@/components/campaign-dev-panel";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  await redirectIfInBattle(session.user.id, locale);

  const [t, progress] = await Promise.all([
    getTranslations("campaign"),
    ensureCampaignProgress(session.user.id),
  ]);

  const rows = listLocationsForUi(progress);
  const isDev = process.env.NODE_ENV === "development";

  const badgeCount = await prisma.badge.count({ where: { userId: session.user.id } });
  const journeyPercent = journeyProgressPercent(progress);
  const unlockedZones = rows.filter((r) => r.unlocked).length;

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6 md:py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-pokeball-red">
              {t("eyebrow")}
            </p>
            <h1 className="text-headline-lg text-white md:text-display-lg">{t("title")}</h1>
            <p className="mt-1 max-w-xl text-label-md text-on-surface-variant">
              {t("subtitle")}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-label-md text-on-surface hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[18px]!">arrow_back</span>
            {t("backHome")}
          </Link>
        </header>

        <section className="glass-panel grid grid-cols-3 gap-2 rounded-xl border border-white/10 p-3">
          <JourneyStat
            icon="explore"
            tone="text-pokeball-red"
            value={`${journeyPercent}%`}
            label={t("journeyProgress")}
          />
          <JourneyStat
            icon="map"
            tone="text-sky-300"
            value={`${unlockedZones}/${rows.length}`}
            label={t("zonesUnlocked")}
          />
          <JourneyStat
            icon="military_tech"
            tone="text-tertiary"
            value={`${badgeCount}/8`}
            label={t("badges")}
          />
        </section>

        <CampaignJourneyMap
          locale={locale}
          progress={progress}
          rows={rows}
          farmingStageId={progress.farmingStageId}
        />

        {isDev && <CampaignDevPanel locale={locale} />}
      </div>
    </div>
  );
}

function JourneyStat({
  icon,
  tone,
  value,
  label,
}: {
  icon: string;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-black/20 px-3 py-2">
      <span className={`material-symbols-outlined text-[22px]! ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="font-mono text-body-md font-semibold text-white">{value}</p>
        <p className="truncate text-[10px] uppercase tracking-wider text-on-surface-variant">
          {label}
        </p>
      </div>
    </div>
  );
}
