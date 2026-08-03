import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CLAN_ERRORS, CLAN_NOTICES, pickCode } from "@/lib/feedback-codes";
import { CLAN_CREATION_COST } from "@/lib/clan-rules";
import { compareTrainers, teamPower } from "@/lib/ranking";
import { type DiscoveryClan } from "@/components/clans/clan-discovery";
import { ClanLanding } from "@/components/clans/clan-landing";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { ClanCreateCoinFxGuard } from "@/components/clans/clan-create-coin-fx-guard";
import { respondInvite, cancelApplication } from "@/actions/clan";
import { SubmitButton } from "@/components/submit-button";
import type { ClanAffinity, ClanFocus, ClanJoinPolicy } from "@/lib/clan-types";

const SPECIES_STATS_SELECT = {
  baseHp: true,
  baseAttack: true,
  baseDefense: true,
  baseSpAtk: true,
  baseSpDef: true,
  baseSpeed: true,
} as const;

export default async function ClansPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [t, session] = await Promise.all([getTranslations("clans"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  const error = pickCode(query.error, CLAN_ERRORS);
  const notice = pickCode(query.notice, CLAN_NOTICES);

  const [membership, clans, me, pendingApp, pendingInvites] = await Promise.all([
    prisma.clanMember.findUnique({
      where: { userId },
      select: {
        clanId: true,
      },
    }),
    prisma.clan.findMany({
      select: {
        id: true,
        name: true,
        tag: true,
        motto: true,
        description: true,
        affinity: true,
        focus: true,
        joinPolicy: true,
        language: true,
        minPlayerLevel: true,
        emblem: true,
        createdAt: true,
        members: {
          select: {
            user: {
              select: {
                _count: { select: { badges: true } },
                pokemon: {
                  where: { teamSlot: { not: null } },
                  select: {
                    level: true,
                    ptStrength: true,
                    ptDexterity: true,
                    ptIntelligence: true,
                    ptSpeed: true,
                    ptConstitution: true,
                    species: { select: SPECIES_STATS_SELECT },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { coins: true },
    }),
    prisma.clanApplication.findFirst({
      where: { userId, status: "PENDING" },
      select: {
        id: true,
        createdAt: true,
        clan: { select: { id: true, name: true, tag: true, emblem: true } },
      },
    }),
    prisma.clanInvite.findMany({
      where: { toUserId: userId, status: "PENDING" },
      select: {
        id: true,
        createdAt: true,
        clan: { select: { id: true, name: true, tag: true, emblem: true } },
        fromUser: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const ranked = clans
    .map((c) => {
      const badges = c.members.reduce((sum, m) => sum + m.user._count.badges, 0);
      const power = c.members.reduce((sum, m) => sum + teamPower(m.user.pokemon), 0);
      return {
        id: c.id,
        name: c.name,
        tag: c.tag,
        motto: c.motto,
        description: c.description,
        affinity: c.affinity as ClanAffinity,
        focus: c.focus as ClanFocus,
        joinPolicy: c.joinPolicy as ClanJoinPolicy,
        language: c.language,
        minPlayerLevel: c.minPlayerLevel,
        emblem: c.emblem,
        createdAt: c.createdAt,
        memberCount: c.members.length,
        badges,
        power,
      };
    })
    .sort((a, b) =>
      compareTrainers(
        { badges: a.badges, power: a.power, createdAt: a.createdAt },
        { badges: b.badges, power: b.power, createdAt: b.createdAt },
      ),
    );

  const discoveryClans: DiscoveryClan[] = ranked.map((c, i) => ({
    ...c,
    rank: i + 1,
  }));

  if (membership?.clanId) {
    redirect({ href: `/clans/${membership.clanId}`, locale });
  }

  const wizardLabels = {
    steps: {
      identity: t("wizard.steps.identity"),
      emblem: t("wizard.steps.emblem"),
      style: t("wizard.steps.style"),
      rules: t("wizard.steps.rules"),
      confirm: t("wizard.steps.confirm"),
    },
    next: t("wizard.next"),
    back: t("wizard.back"),
    nameLabel: t("nameLabel"),
    namePlaceholder: t("namePlaceholder"),
    tagLabel: t("tagLabel"),
    tagPlaceholder: t("tagPlaceholder"),
    descriptionLabel: t("descriptionLabel"),
    descriptionPlaceholder: t("descriptionPlaceholder"),
    mottoLabel: t("mottoLabel"),
    mottoPlaceholder: t("mottoPlaceholder"),
    affinityLabel: t("affinityLabel"),
    focusLabel: t("focusLabel"),
    joinPolicyLabel: t("joinPolicyLabel"),
    languageLabel: t("languageLabel"),
    minLevelLabel: t("minLevelLabel"),
    minLevelHint: t("minLevelHint"),
    createCostLead: t("createCostLead"),
    createCostAmount: CLAN_CREATION_COST,
    createButton: t("createButton"),
    creating: t("creating"),
    noFunds: t("noFunds"),
    affinities: Object.fromEntries(
      (["NORMAL","FIRE","WATER","GRASS","ELECTRIC","ICE","ROCK","GROUND","PSYCHIC","DARK","STEEL","DRAGON","FAIRY","FIGHTING","GHOST"] as const).map(
        (k) => [k, t(`affinities.${k}`)],
      ),
    ) as Record<ClanAffinity, string>,
    focuses: Object.fromEntries(
      (["CASUAL","COMPETITIVE","PVE","PVP","COLLECTION","EVENTS","SOCIAL","MIXED"] as const).map(
        (k) => [k, t(`focuses.${k}`)],
      ),
    ) as Record<ClanFocus, string>,
    joinPolicies: {
      OPEN: t("joinPolicies.OPEN"),
      REQUEST: t("joinPolicies.REQUEST"),
      INVITE: t("joinPolicies.INVITE"),
    },
    languages: {
      any: t("languages.any"),
      es: t("languages.es"),
      en: t("languages.en"),
      pt: t("languages.pt"),
    },
    emblem: {
      pick: t("emblem.pick"),
      selected: t("emblem.selected"),
    },
    preview: t("wizard.preview"),
  };

  const cardLabels = {
    affinities: wizardLabels.affinities,
    focuses: wizardLabels.focuses,
    membersTemplate: t("memberCount", { count: "{count}", max: "{max}" }),
    powerTemplate: t("power", { value: "{value}" }),
    levelTemplate: t("discovery.levelLabel", { level: "{level}" }),
    viewClan: t("discovery.viewClan"),
    joinOpen: t("join"),
    requestJoin: t("apply"),
    inviteOnly: t("inviteOnly"),
    full: t("full"),
    buffLabel: t("memberHome.buffLabel"),
    buffHintTemplate: t("memberHome.buffHint", {
      leftLabel: "{leftLabel}",
      leftValue: "{leftValue}",
      rightLabel: "{rightLabel}",
      rightValue: "{rightValue}",
    }),
  };

  const discoveryLabels = {
    searchPlaceholder: t("discovery.searchPlaceholder"),
    filters: t("discovery.filters"),
    clearFilters: t("discovery.clearFilters"),
    sortLabel: t("discovery.sortLabel"),
    sorts: {
      recommended: t("discovery.sorts.recommended"),
      power: t("discovery.sorts.power"),
      members: t("discovery.sorts.members"),
      recent: t("discovery.sorts.recent"),
    },
    affinity: t("affinityLabel"),
    focus: t("focusLabel"),
    joinPolicy: t("joinPolicyLabel"),
    spaceAvailable: t("discovery.spaceAvailable"),
    all: t("discovery.all"),
    empty: t("emptyDirectory"),
    emptyFiltered: t("discovery.emptyFiltered"),
    benefitsTitle: t("discovery.benefitsTitle"),
    benefits: [
      t("discovery.benefit1"),
      t("discovery.benefit2"),
      t("discovery.benefit3"),
      t("discovery.benefit4"),
    ],
    createCta: t("discovery.createCta"),
    recommended: t("discovery.recommended"),
    recommendedOpen: t("discovery.recommendedOpen"),
    recommendedNew: t("discovery.recommendedNew"),
    recommendedDefault: t("discovery.recommendedDefault"),
    openFilters: t("discovery.openFilters"),
    applyFilters: t("discovery.applyFilters"),
    card: cardLabels,
  };

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6 pb-[calc(var(--bottom-nav-h,3.5rem)+env(safe-area-inset-bottom)+1rem)]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="page-title text-headline-lg text-white md:text-display-lg">{t("title")}</h1>
          <p className="text-label-md text-on-surface-variant mt-1">{t("subtitle")}</p>
        </div>

        {notice && (
          <div className="mb-4 rounded-lg border border-tertiary/40 bg-tertiary/10 px-4 py-2 text-label-md text-tertiary">
            {t(`notices.${notice}`)}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-error/40 bg-error-container/30 px-4 py-2 text-label-md text-error">
            {t(`errors.${error}`)}
          </div>
        )}
        <ClanCreateCoinFxGuard error={error} />

        {!membership ? (
          <div className="mb-6 flex flex-col gap-4">
            {pendingInvites.length > 0 && (
              <section className="rounded-xl border border-tertiary/30 bg-tertiary/10 p-4">
                <h2 className="text-headline-md text-on-surface mb-2">{t("invitesTitle")}</h2>
                <ul className="flex flex-col gap-2">
                  {pendingInvites.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                    >
                      <ClanEmblemBadge emblem={inv.clan.emblem} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="text-label-md text-on-surface">
                          [{inv.clan.tag}] {inv.clan.name}
                        </div>
                        <div className="text-label-sm text-on-surface-variant">
                          {t("inviteFrom", { name: inv.fromUser.username })}
                        </div>
                      </div>
                      <form action={respondInvite.bind(null, locale)}>
                        <input type="hidden" name="inviteId" value={inv.id} />
                        <input type="hidden" name="decision" value="accept" />
                        <SubmitButton
                          label={t("acceptInvite")}
                          pendingLabel={t("saving")}
                          className="min-h-11 px-3 rounded-lg bg-pokeball-red text-white text-label-sm"
                        />
                      </form>
                      <form action={respondInvite.bind(null, locale)}>
                        <input type="hidden" name="inviteId" value={inv.id} />
                        <input type="hidden" name="decision" value="decline" />
                        <SubmitButton
                          label={t("declineInvite")}
                          pendingLabel={t("saving")}
                          className="min-h-11 px-3 rounded-lg border border-white/15 text-label-sm text-on-surface-variant"
                        />
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {pendingApp && (
              <section className="rounded-xl border border-electric-yellow/30 bg-electric-yellow/10 p-4">
                <h2 className="text-headline-md text-on-surface mb-1">{t("pendingApplicationTitle")}</h2>
                <div className="flex items-center gap-3">
                  <ClanEmblemBadge emblem={pendingApp.clan.emblem} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="text-label-md text-on-surface">
                      [{pendingApp.clan.tag}] {pendingApp.clan.name}
                    </div>
                    <p className="text-label-sm text-on-surface-variant">
                      {t("pendingApplicationHint")}
                    </p>
                  </div>
                  <form action={cancelApplication.bind(null, locale)}>
                    <input type="hidden" name="clanId" value={pendingApp.clan.id} />
                    <SubmitButton
                      label={t("cancelApplication")}
                      pendingLabel={t("saving")}
                      className="min-h-11 px-3 rounded-lg border border-error/30 text-error text-label-sm"
                    />
                  </form>
                </div>
              </section>
            )}

            <ClanLanding
              locale={locale}
              coins={me.coins}
              clans={discoveryClans}
              wizardLabels={wizardLabels}
              discoveryLabels={discoveryLabels}
              labels={{
                title: t("title"),
                subtitle: t("landing.subtitle"),
                searchClan: t("landing.searchClan"),
                createClan: t("landing.createClan"),
                recommendedTitle: t("landing.recommendedTitle"),
                whyJoinTitle: t("landing.whyJoinTitle"),
                listTitle: t("landing.listTitle"),
                close: t("landing.close"),
                benefits: [
                  t("landing.benefitMissions"),
                  t("landing.benefitBenefits"),
                  t("landing.benefitWars"),
                  t("landing.benefitCommunity"),
                ],
                card: cardLabels,
                empty: t("emptyDirectory"),
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
