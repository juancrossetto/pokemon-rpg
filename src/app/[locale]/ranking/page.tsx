import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getCountryOptionsForCodes } from "@/lib/countries";
import { prisma } from "@/lib/prisma";
import { RankingCategorySelect } from "@/components/ranking/ranking-category-select";
import { RankingScopeFilter } from "@/components/ranking/ranking-scope-filter";
import { RankingBoardView } from "@/components/ranking/ranking-board-view";
import { RankedComingSoon } from "@/components/ranking/ranking-empty-state";
import {
  listActiveRankingCountryCodes,
  loadCombatPowerBoard,
  loadPvpBoard,
} from "@/lib/ranking-boards";
import {
  PVP_MIN_MATCHES,
  pickRankingCategory,
  type RankingCategory,
  type RankingScope,
} from "@/lib/ranking";

export default async function RankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; country?: string; page?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [t, session] = await Promise.all([getTranslations("ranking"), auth()]);
  const userId = session?.user?.id ?? null;

  const category = pickRankingCategory(query.view);
  const page = Math.max(1, Number(query.page) > 0 ? Math.floor(Number(query.page)) : 1);

  const [activeCountryCodes, accountCountry] = await Promise.all([
    listActiveRankingCountryCodes(),
    userId
      ? prisma.user
          .findUnique({ where: { id: userId }, select: { country: true } })
          .then((u) => u?.country?.trim().toUpperCase() || undefined)
      : Promise.resolve(undefined),
  ]);

  const countryOptions = getCountryOptionsForCodes(locale, activeCountryCodes);
  const activeSet = new Set(countryOptions.map((c) => c.code));

  const requestedCountry = query.country?.trim().toUpperCase() ?? "";
  const countryFilter =
    requestedCountry && activeSet.has(requestedCountry) ? requestedCountry : "";
  const scope: RankingScope = countryFilter ? "country" : "global";

  const categoryLabels = {
    combat_power: {
      title: t("boards.combat_power.title"),
      blurb: t("boards.combat_power.blurb"),
    },
    pvp: {
      title: t("boards.pvp.title"),
      blurb: t("boards.pvp.blurb"),
    },
    ranked: {
      title: t("boards.ranked.title"),
      blurb: t("boards.ranked.blurb"),
    },
  } satisfies Record<RankingCategory, { title: string; blurb: string }>;

  return (
    <div className="flex-1 px-margin-mobile py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-margin-desktop md:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-3 md:mb-4">
          <h1 className="page-title text-headline-lg text-white md:text-display-sm">
            {t("title")}
          </h1>
          <p className="mt-1 hidden max-w-xl text-label-md text-on-surface-variant sm:block">
            {t(`boards.${category}.blurb`)}
          </p>
        </header>

        <div className="rk-panel mb-3 md:mb-4">
          <RankingCategorySelect
            category={category}
            scope={scope}
            countryCode={countryFilter || undefined}
            ariaLabel={t("title")}
            labels={categoryLabels}
          />

          {category !== "ranked" ? (
            <RankingScopeFilter
              category={category}
              scope={scope}
              selectedCountry={countryFilter || undefined}
              accountCountry={
                accountCountry && activeSet.has(accountCountry)
                  ? accountCountry
                  : undefined
              }
              countries={countryOptions}
              labels={{
                global: t("filters.global"),
                country: t("filters.myCountry"),
                friends: t("filters.friends"),
                friendsSoon: t("filters.friendsSoon"),
              }}
            />
          ) : null}
        </div>

        <main className="min-w-0">
          {category === "combat_power" && (
            <CombatPowerBoard
              userId={userId}
              country={countryFilter}
              scope={scope}
              page={page}
            />
          )}
          {category === "pvp" && (
            <PvpBoardView
              userId={userId}
              country={countryFilter}
              scope={scope}
              page={page}
            />
          )}
          {category === "ranked" && (
            <RankedComingSoon
              eyebrow={t("ranked.eyebrow")}
              title={t("ranked.title")}
              body={t("ranked.body")}
              detail={t("ranked.detail")}
            />
          )}
        </main>
      </div>
    </div>
  );
}

async function CombatPowerBoard({
  userId,
  country,
  scope,
  page,
}: {
  userId: string | null;
  country: string;
  scope: RankingScope;
  page: number;
}) {
  const t = await getTranslations("ranking");
  const entries = await loadCombatPowerBoard(country, userId);

  return (
    <RankingBoardView
      category="combat_power"
      scope={scope}
      countryCode={country || undefined}
      page={page}
      entries={entries}
      formatPrimary={(e) => (e.combatPower ?? 0).toLocaleString()}
      labels={{
        you: t("you"),
        yourTitle: t("yourCard.title"),
        listTitle: t("list.title"),
        scopeLabel: scope === "country" ? t("list.scopeCountry") : t("list.scopeGlobal"),
        emptyTitle: t("emptyCombatPower"),
        emptyIcon: "trophy",
        prev: t("pagination.prev"),
        next: t("pagination.next"),
        pageOf: (p, total) => t("pagination.pageOf", { page: p, total }),
        metricLabel: t("metric.cpLabel"),
      }}
    />
  );
}

async function PvpBoardView({
  userId,
  country,
  scope,
  page,
}: {
  userId: string | null;
  country: string;
  scope: RankingScope;
  page: number;
}) {
  const t = await getTranslations("ranking");
  const entries = await loadPvpBoard(country, userId);

  return (
    <RankingBoardView
      category="pvp"
      scope={scope}
      countryCode={country || undefined}
      page={page}
      entries={entries}
      empty={entries.length === 0}
      formatPrimary={(e) => String(e.rating ?? 0)}
      formatSecondary={(e) =>
        t("metric.pvpRecord", {
          wins: e.wins ?? 0,
          losses: e.losses ?? 0,
          winrate: e.winRate ?? 0,
        })
      }
      labels={{
        you: t("you"),
        yourTitle: t("yourCard.title"),
        listTitle: t("list.title"),
        scopeLabel: scope === "country" ? t("list.scopeCountry") : t("list.scopeGlobal"),
        emptyTitle: t("pvpEmpty.title"),
        emptyBody: t("pvpEmpty.body", { min: PVP_MIN_MATCHES }),
        emptyCta: t("pvpEmpty.cta"),
        emptyCtaHref: "/pvp",
        emptyIcon: "swords",
        prev: t("pagination.prev"),
        next: t("pagination.next"),
        pageOf: (p, total) => t("pagination.pageOf", { page: p, total }),
        metricLabel: t("metric.eloLabel"),
      }}
    />
  );
}
