import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { loadEventsSummary } from "@/lib/events/state";
import { EventsHub, type EventsLabels } from "@/components/events/events-hub";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, session] = await Promise.all([getTranslations("events"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  await redirectIfInBattle(session.user.id, locale);

  const summary = await loadEventsSummary(session.user.id);

  // Las plantillas con variables viajan con el marcador intacto: el hub las
  // interpola en el cliente porque los contadores cambian con el reloj
  // compartido, y next-intl exige un valor para cada variable ICU.
  const labels: EventsLabels = {
    eyebrow: t("eyebrow"),
    title: t("title"),
    subtitle: t("subtitle"),
    pending: t("pending", { count: summary.pendingCount }),
    dailyTitle: t("dailyTitle"),
    dailySubtitle: t("dailySubtitle"),
    dailyDay: t("dailyDay", { day: "{day}" }),
    dailyClaim: t("dailyClaim"),
    dailyClaimed: t("dailyClaimed"),
    dailyNext: t("dailyNext", { time: "{time}" }),
    dailyProgress: t("dailyProgress", { current: "{current}", total: "{total}" }),
    weeklyTitle: t("weeklyTitle"),
    weeklySubtitle: t("weeklySubtitle"),
    weeklyPercent: t("weeklyPercent", { percent: "{percent}" }),
    weeklyReset: t("weeklyReset", { time: "{time}" }),
    objectives: {
      logins: t("objectives.logins"),
      battles: t("objectives.battles"),
      catches: t("objectives.catches"),
      zones: t("objectives.zones"),
      shinies: t("objectives.shinies"),
      gyms: t("objectives.gyms"),
    },
    milestone: t("milestone", { percent: "{percent}" }),
    claim: t("claim"),
    claimed: t("claimed"),
    locked: t("locked"),
    goTo: t("goTo"),
    rewards: {
      coins: t("rewards.coins"),
      energy: t("rewards.energy"),
      item: t("rewards.item"),
    },
    revealTitle: t("revealTitle"),
    revealClose: t("revealClose"),
    revealInventory: t("revealInventory"),
    errorClaimed: t("errorClaimed"),
    errorNotAvailable: t("errorNotAvailable"),
    errorGeneric: t("errorGeneric"),
    close: t("close"),
    statusToday: t("statusToday"),
    statusClaimed: t("statusClaimed"),
    statusUpcoming: t("statusUpcoming"),
    limitedBadge: t("limited.badge"),
    limitedEnds: t("limited.endsIn", { time: "{time}" }),
    // El catálogo del evento vive en código y expone la clave; acá se resuelve
    // solo la edición vigente en vez de mandar las tres traducidas.
    limitedName: t(`limited.catalog.${summary.limited.nameKey}`),
    limitedTagline: t(`limited.catalog.${summary.limited.taglineKey}`),
    limitedMissions: Object.fromEntries(
      summary.limited.missions.map((mission) => [
        mission.id,
        t(`limited.missions.${mission.id}`),
      ]),
    ),
    limitedPartOf: t("limited.partOf", { current: "{current}", total: "{total}" }),
    rewardsLabel: t("rewardsLabel"),
  };

  return (
    <div className="flex-1 px-margin-mobile py-5 md:px-margin-desktop md:py-8">
      <div className="mx-auto max-w-5xl">
        <EventsHub
          daily={summary.daily}
          weekly={summary.weekly}
          limited={summary.limited}
          pendingCount={summary.pendingCount}
          labels={labels}
          locale={locale}
        />
      </div>
    </div>
  );
}
