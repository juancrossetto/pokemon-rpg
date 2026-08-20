import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FlagIcon } from "@/components/flag-icon";
import { SubmitButton } from "@/components/submit-button";
import { CLAN_ERRORS, CLAN_NOTICES, pickCode } from "@/lib/feedback-codes";
import { ClanChat } from "@/components/clan-chat";
import { listClanMessages } from "@/actions/clan-chat";
import { CLAN_MAX_MEMBERS } from "@/lib/clan-rules";
import { getClanRank } from "@/lib/clan-directory";
import { teamPower } from "@/lib/ranking";
import type { ClanRole } from "@/generated/prisma/enums";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { ClanAffinityChip } from "@/components/clans/clan-affinity-chip";
import { ClanHubTabs, type ClanHubTab } from "@/components/clans/clan-hub-tabs";
import { ClanEmblemEditor } from "@/components/clans/clan-emblem-editor";
import { isPresetEmblem, parseClanEmblem } from "@/lib/clan-emblem";
import {
  applyToClan,
  disbandClan,
  inviteToClan,
  joinClan,
  kickMember,
  leaveClan,
  respondApplication,
  setMemberRole,
  transferLeadership,
  updateClanSettings,
} from "@/actions/clan";
import { getClanWarHubState } from "@/actions/clan-war";
import { ClanWarPanel } from "@/components/clans/clan-war-panel";
import { serverNow, weekStart } from "@/lib/events/time";

const SPECIES_STATS_SELECT = {
  baseHp: true,
  baseAttack: true,
  baseDefense: true,
  baseSpAtk: true,
  baseSpDef: true,
  baseSpeed: true,
} as const;

const ROLE_RANK: Record<ClanRole, number> = { LEADER: 0, OFFICER: 1, MEMBER: 2 };

const GHOST_BTN =
  "min-h-11 text-label-sm px-2.5 py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:border-white/30 transition-colors";
const DANGER_BTN =
  "min-h-11 text-label-sm px-2.5 py-1 rounded-lg border border-error/30 text-error hover:bg-error/10 transition-colors";

function parseTab(raw: string | undefined): ClanHubTab {
  if (
    raw === "members" ||
    raw === "chat" ||
    raw === "overview" ||
    raw === "missions" ||
    raw === "war" ||
    raw === "more"
  ) {
    return raw;
  }
  return "overview";
}

export default async function ClanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; clanId: string }>;
  searchParams: Promise<{ error?: string; notice?: string; tab?: string }>;
}) {
  const [{ locale, clanId }, query] = await Promise.all([params, searchParams]);
  const [t, session] = await Promise.all([getTranslations("clans"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  const error = pickCode(query.error, CLAN_ERRORS);
  const notice = pickCode(query.notice, CLAN_NOTICES);
  const tab = parseTab(query.tab);

  const [clan, myMembership, myApplication, clanRank] = await Promise.all([
    prisma.clan.findUnique({
      where: { id: clanId },
      select: {
        id: true,
        name: true,
        tag: true,
        leaderId: true,
        createdAt: true,
        description: true,
        motto: true,
        announcement: true,
        joinPolicy: true,
        focus: true,
        affinity: true,
        language: true,
        minPlayerLevel: true,
        emblem: true,
        members: {
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                username: true,
                country: true,
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
        applications: {
          where: { status: "PENDING" },
          select: {
            id: true,
            message: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                username: true,
                country: true,
                _count: { select: { badges: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.clanMember.findUnique({ where: { userId }, select: { clanId: true, role: true } }),
    prisma.clanApplication.findUnique({
      where: { clanId_userId: { clanId, userId } },
      select: { status: true },
    }),
    getClanRank(clanId),
  ]);

  if (!clan) notFound();

  const members = clan.members
    .map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      username: m.user.username,
      country: m.user.country,
      badges: m.user._count.badges,
      power: teamPower(m.user.pokemon),
    }))
    .sort(
      (a, b) =>
        ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.joinedAt.getTime() - b.joinedAt.getTime(),
    );

  const myRole: ClanRole | null = myMembership?.clanId === clanId ? myMembership.role : null;
  const isLeader = myRole === "LEADER";
  const isOfficer = myRole === "OFFICER";
  const canManageApps = isLeader || isOfficer;
  const inAnyClan = myMembership !== null;
  const isFull = members.length >= CLAN_MAX_MEMBERS;
  const pendingMine = myApplication?.status === "PENDING";

  const totalBadges = members.reduce((s, m) => s + m.badges, 0);
  const totalPower = members.reduce((s, m) => s + m.power, 0);
  const emblem = parseClanEmblem(clan.emblem);
  const headerPrimary = isPresetEmblem(emblem) ? "var(--color-pokeball-red)" : emblem.primaryColor;
  const headerSecondary = isPresetEmblem(emblem) ? "#0a0a0a" : emblem.secondaryColor;

  const memberIds = members.map((member) => member.userId);
  const since = weekStart(serverNow());
  const [warHub, missionWins, missionCatches, raidContribution] = await Promise.all([
    getClanWarHubState(clanId),
    prisma.battleLog.count({ where: { userId: { in: memberIds }, userWon: true, createdAt: { gte: since } } }),
    prisma.pokemonInstance.count({ where: { ownerId: { in: memberIds }, caughtAt: { gte: since } } }),
    prisma.weeklyRaidScore.aggregate({ where: { userId: { in: memberIds }, updatedAt: { gte: since } }, _sum: { totalDamage: true } }),
  ]);
  const clanMissions = [
    { id: "wins", current: missionWins, target: Math.max(100, members.length * 20), href: "/battle", icon: "swords" },
    { id: "catches", current: missionCatches, target: Math.max(50, members.length * 10), href: "/campaign", icon: "catching_pokemon" },
    { id: "raids", current: raidContribution._sum.totalDamage ?? 0, target: Math.max(100_000, members.length * 50_000), href: "/raids", icon: "crisis_alert" },
  ] as const;

  const activeTab: ClanHubTab = myRole === null ? "overview" : tab;

  const clanLevel = Math.max(1, Math.floor(totalBadges / 5) + 1);
  const clanExp = totalPower;
  const nextLevelExp = clanLevel * 2000;
  const progressPct = Math.min(100, Math.round((clanExp / nextLevelExp) * 100));

  const emblemLabels = {
    pick: t("emblem.pick"),
    selected: t("emblem.selected"),
  };

  return (
    <div className="clans-arena relative isolate flex-1 overflow-x-hidden pb-[calc(var(--bottom-nav-h,3.5rem)+env(safe-area-inset-bottom)+0.5rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,color-mix(in_srgb,var(--color-pokeball-red)_16%,transparent),transparent_45%),radial-gradient(ellipse_at_95%_8%,color-mix(in_srgb,var(--color-electric-yellow)_8%,transparent),transparent_40%)]"
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-3 py-3 sm:px-margin-desktop sm:py-6">
        {myRole === null ? (
          <Link
            href="/clans"
            className="mb-3 inline-flex min-h-10 items-center gap-1 text-[12px] text-white/45 transition hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]!">arrow_back</span>
            {t("backToDirectory")}
          </Link>
        ) : (
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] sm:mb-3">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-pokeball-red shadow-[0_0_8px_color-mix(in_srgb,var(--color-pokeball-red)_55%,transparent)]"
            />
            <span className="text-pokeball-red/90">{t("memberHome.eyebrow")}</span>
          </p>
        )}

        {notice && (
          <div className="mb-3 rounded-xl border border-tertiary/40 bg-tertiary/10 px-4 py-2.5 text-[13px] text-tertiary">
            {t(`notices.${notice}`)}
          </div>
        )}
        {error && (
          <div className="mb-3 rounded-xl border border-error/40 bg-error-container/30 px-4 py-2.5 text-[13px] text-error">
            {t(`errors.${error}`)}
          </div>
        )}

        <header className="game-float-card relative mb-4 overflow-hidden rounded-2xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 88% 0%, ${headerPrimary}22, transparent 48%), radial-gradient(ellipse at 100% 100%, ${headerSecondary}28, transparent 42%)`,
            }}
          />

          <div className="relative z-10 p-4 sm:p-5">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="h-[7.5rem] w-[7.5rem] shrink-0 bg-transparent sm:h-44 sm:w-44">
                <ClanEmblemBadge
                  emblem={clan.emblem}
                  size={176}
                  fill
                  title={clan.name}
                  className="drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="page-title truncate text-[clamp(1.2rem,3.8vw,1.85rem)] leading-[1.05] tracking-tight text-white">
                      <span className="font-mono text-pokeball-red">[{clan.tag}]</span>{" "}
                      {clan.name}
                    </h1>
                    {clan.motto ? (
                      <p className="mt-1 truncate text-[12px] italic text-white/50 sm:text-[13px]">
                        “{clan.motto}”
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:flex-wrap sm:justify-end">
                    {!inAnyClan && clan.joinPolicy === "OPEN" && (
                      <form action={joinClan.bind(null, locale)}>
                        <input type="hidden" name="clanId" value={clan.id} />
                        <SubmitButton
                          label={isFull ? t("full") : t("join")}
                          pendingLabel={t("joining")}
                          disabled={isFull}
                          className="ui-btn-primary min-h-10 px-3.5 text-[12px]"
                        />
                      </form>
                    )}
                    {!inAnyClan && clan.joinPolicy === "REQUEST" && !pendingMine && (
                      <form
                        action={applyToClan.bind(null, locale)}
                        className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center"
                      >
                        <input type="hidden" name="clanId" value={clan.id} />
                        <input
                          name="message"
                          maxLength={140}
                          placeholder={t("applyMessagePlaceholder")}
                          className="min-h-10 max-w-[10.5rem] rounded-xl border border-white/15 bg-black/30 px-2.5 text-[11px] text-white"
                        />
                        <SubmitButton
                          label={isFull ? t("full") : t("apply")}
                          pendingLabel={t("applying")}
                          disabled={isFull}
                          className="ui-btn-primary min-h-10 px-3.5 text-[12px]"
                        />
                      </form>
                    )}
                    {!inAnyClan && pendingMine && (
                      <span className="inline-flex min-h-10 items-center rounded-xl border border-electric-yellow/40 px-2.5 text-[11px] text-electric-yellow">
                        {t("applicationPending")}
                      </span>
                    )}
                    {!inAnyClan && clan.joinPolicy === "INVITE" && (
                      <span className="inline-flex min-h-10 items-center rounded-xl border border-white/15 px-2.5 text-[11px] text-white/45">
                        {t("inviteOnly")}
                      </span>
                    )}
                    {myRole && myRole !== "LEADER" && (
                      <form action={leaveClan.bind(null, locale)}>
                        <SubmitButton
                          label={t("leave")}
                          pendingLabel={t("leaving")}
                          confirmMessage={t("confirmLeave")}
                          className={DANGER_BTN}
                        />
                      </form>
                    )}
                    {canManageApps && (
                      <Link href={`/clans/${clan.id}?tab=more`} className={GHOST_BTN}>
                        {t("hub.manage")}
                      </Link>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/45">
                  <ClanAffinityChip
                    affinity={clan.affinity}
                    label={t(`affinities.${clan.affinity}`)}
                    size="sm"
                  />
                  <span className="text-white/20">·</span>
                  <span>{t(`focuses.${clan.focus}`)}</span>
                  <span className="text-white/20">·</span>
                  <span>{t(`joinPolicies.${clan.joinPolicy}`)}</span>
                </div>

                <div className="max-w-sm">
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-[10px] text-white/40">
                    <span>{t("hub.level", { level: clanLevel })}</span>
                    <span className="font-mono tabular-nums text-white/60">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-pokeball-red to-electric-yellow transition-[width] duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-1 border-t border-white/8 pt-3 sm:gap-2">
              <ClanKpi
                label={t("memberHome.statRank")}
                value={clanRank > 0 ? `#${clanRank}` : "—"}
              />
              <ClanKpi
                label={t("memberHome.statMembers")}
                value={`${members.length}/${CLAN_MAX_MEMBERS}`}
              />
              <ClanKpi label={t("memberHome.statPower")} value={String(totalPower)} />
              <ClanKpi label={t("memberHome.statLevel")} value={String(clanLevel)} />
              <ClanKpi label={t("memberHome.statBadges")} value={String(totalBadges)} />
            </div>
          </div>
        </header>

        {myRole !== null && (
          <ClanHubTabs
            clanId={clanId}
            active={activeTab}
            labels={{
              overview: t("tabs.overview"),
              members: t("tabs.members"),
              missions: t("tabs.missions"),
              war: t("tabs.war"),
              chat: t("tabs.chat"),
              more: t("tabs.more"),
            }}
          />
        )}

        {(myRole === null || activeTab === "overview") && (
          <section className="mb-4 grid gap-3 md:grid-cols-[1.6fr_1fr]">
            <div className="game-float-card rounded-2xl p-4 sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                {t("hub.pendingActionsTitle")}
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-[13px] text-white/55">
                {canManageApps && clan.applications.length > 0 ? (
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined mt-0.5 text-[16px]! text-electric-yellow">
                      mail
                    </span>
                    {t("hub.pendingApplications", { count: clan.applications.length })}
                  </li>
                ) : null}
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-0.5 text-[16px]! text-white/35">
                    trending_up
                  </span>
                  {t("hub.progressHint", { percent: progressPct })}
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-0.5 text-[16px]! text-white/35">
                    lock_open
                  </span>
                  {t("hub.nextUnlock", { level: clanLevel + 1 })}
                </li>
              </ul>
            </div>
            <div className="game-float-card rounded-2xl p-4 sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                {t("hub.activityTitle")}
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-[13px] text-white/55">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-0.5 text-[16px]! text-white/35">
                    group
                  </span>
                  {t("hub.activityMembers", { count: members.length })}
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-0.5 text-[16px]! text-electric-yellow">
                    bolt
                  </span>
                  {t("hub.activityPower", { power: totalPower })}
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-0.5 text-[16px]! text-tertiary">
                    military_tech
                  </span>
                  {t("hub.activityBadges", { count: totalBadges })}
                </li>
              </ul>
            </div>

            {clan.announcement && myRole && (
              <div className="game-float-card rounded-2xl border border-tertiary/25 px-4 py-3.5 md:col-span-2 sm:px-5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-tertiary">
                  {t("announcement")}
                </p>
                <p className="whitespace-pre-wrap text-[13px] text-white/80">{clan.announcement}</p>
              </div>
            )}
            {clan.description && (
              <div className="game-float-card rounded-2xl px-4 py-3.5 md:col-span-2 sm:px-5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  {t("descriptionLabel")}
                </p>
                <p className="whitespace-pre-wrap text-[13px] text-white/70">{clan.description}</p>
              </div>
            )}
          </section>
        )}

        {(myRole === null || activeTab === "members") && (
          <>
            <h2 className="text-headline-md text-on-surface mb-2">{t("membersTitle")}</h2>
            <ul className="flex flex-col gap-1.5 mb-4">
              {members.map((m) => {
                const isSelf = m.userId === userId;
                const canKick =
                  myRole !== null &&
                  !isSelf &&
                  (isLeader || (isOfficer && m.role === "MEMBER"));
                const canManageRole = isLeader && m.role !== "LEADER" && !isSelf;

                return (
                  <li
                    key={m.userId}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      isSelf
                        ? "border-pokeball-red/40 bg-pokeball-red/8"
                        : "border-white/8 bg-black/25"
                    }`}
                  >
                    <RoleChip role={m.role} label={t(`roles.${m.role}`)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <FlagIcon code={m.country} className="h-3.5 w-auto rounded-xs shrink-0" />
                        <span className="text-label-md text-on-surface truncate">{m.username}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-label-sm text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]! text-tertiary">
                            military_tech
                          </span>
                          {m.badges}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]! text-electric-yellow">
                            bolt
                          </span>
                          {m.power}
                        </span>
                      </div>
                    </div>

                    {(canManageRole || canKick) && activeTab === "members" && (
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {canManageRole && m.role === "MEMBER" && (
                          <RoleForm
                            locale={locale}
                            clanId={clan.id}
                            targetUserId={m.userId}
                            role="OFFICER"
                            label={t("promote")}
                            pending={t("saving")}
                          />
                        )}
                        {canManageRole && m.role === "OFFICER" && (
                          <RoleForm
                            locale={locale}
                            clanId={clan.id}
                            targetUserId={m.userId}
                            role="MEMBER"
                            label={t("demote")}
                            pending={t("saving")}
                          />
                        )}
                        {isLeader && m.role !== "LEADER" && !isSelf && (
                          <form action={transferLeadership.bind(null, locale)}>
                            <input type="hidden" name="clanId" value={clan.id} />
                            <input type="hidden" name="targetUserId" value={m.userId} />
                            <SubmitButton
                              label={t("makeLeader")}
                              pendingLabel={t("saving")}
                              confirmMessage={t("confirmTransfer", { name: m.username })}
                              className={GHOST_BTN}
                            />
                          </form>
                        )}
                        {canKick && (
                          <form action={kickMember.bind(null, locale)}>
                            <input type="hidden" name="clanId" value={clan.id} />
                            <input type="hidden" name="targetUserId" value={m.userId} />
                            <SubmitButton
                              label={t("kick")}
                              pendingLabel={t("saving")}
                              confirmMessage={t("confirmKick", { name: m.username })}
                              className={DANGER_BTN}
                            />
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {isLeader && (
              <p className="text-label-sm text-on-surface-variant mb-4">{t("leaderLeaveHint")}</p>
            )}
          </>
        )}

        {myRole !== null && activeTab === "missions" && (
          <section className="mb-4 rounded-xl border border-white/10 bg-glass-surface p-4">
            <h2 className="text-headline-md text-on-surface">{t("hub.missionsTitle")}</h2>
            <p className="mt-1 text-label-sm text-on-surface-variant">{t("hub.missionsSubtitle")}</p>
            <div className="mt-3 flex flex-col gap-2">
              {clanMissions.map((mission) => {
                const pct = Math.min(100, Math.round((mission.current / mission.target) * 100));
                return (
                  <article key={mission.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined rounded-lg bg-white/5 p-2 text-[19px]! text-tertiary">{mission.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-label-md font-semibold text-on-surface">{t(`hub.missions.${mission.id}.title`)}</p>
                          <span className="font-mono text-[11px] text-white/48">{mission.current.toLocaleString(locale)} / {mission.target.toLocaleString(locale)}</span>
                        </div>
                        <p className="text-label-sm text-on-surface-variant">{t(`hub.missions.${mission.id}.desc`)}</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/7"><span className="block h-full rounded-full bg-tertiary" style={{ width: `${pct}%` }} /></div>
                      </div>
                      <Link href={mission.href} aria-label={t("hub.missionGo")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:border-tertiary/35 hover:text-tertiary"><span className="material-symbols-outlined text-[18px]!">arrow_forward</span></Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {(myRole === null || activeTab === "war") && (
          <ClanWarPanel
            clanId={clanId}
            canManage={isLeader || isOfficer}
            registered={warHub.registered}
            seasonKey={warHub.seasonKey}
            rating={warHub.rating}
            gateOk={warHub.gate.ok}
            gateReason={warHub.gate.ok ? null : warHub.gate.reason}
            memberCount={warHub.memberCount}
            level={warHub.level}
            war={
              warHub.war
                ? {
                    id: warHub.war.id,
                    status: warHub.war.status,
                    scoreA: warHub.war.scoreA,
                    scoreB: warHub.war.scoreB,
                    clanA: warHub.war.clanA,
                    clanB: warHub.war.clanB,
                    battles: warHub.war.battles.map((b) => ({
                      id: b.id,
                      slot: b.slot,
                      status: b.status,
                      winnerClanId: b.winnerClanId,
                      fighterA: b.fighterA,
                      fighterB: b.fighterB,
                    })),
                  }
                : null
            }
            history={warHub.history.map((h) => ({
              id: h.id,
              status: h.status,
              scoreA: h.scoreA,
              scoreB: h.scoreB,
              seasonKey: h.season.seasonKey,
              completedAt: h.completedAt?.toISOString() ?? null,
              clanA: h.clanA,
              clanB: h.clanB,
              battles: h.battles.map((b) => ({
                id: b.id,
                slot: b.slot,
                status: b.status,
                winnerClanId: b.winnerClanId,
                fighterA: b.fighterA,
                fighterB: b.fighterB,
              })),
            }))}
          />
        )}

        {myRole !== null && activeTab === "chat" && (
          <ClanChat
            locale={locale}
            clanId={clanId}
            currentUserId={userId}
            initialMessages={await listClanMessages(clanId)}
          />
        )}

        {myRole !== null && activeTab === "more" && (
          <div className="flex flex-col gap-6">
            <section className="rounded-xl border border-white/10 bg-glass-surface p-4">
              <h2 className="text-headline-md text-on-surface mb-2">{t("hub.activityTitle")}</h2>
              <p className="text-label-sm text-on-surface-variant">{t("hubPhaseHint")}</p>
            </section>

            {canManageApps && (
              <section className="rounded-xl border border-white/10 bg-glass-surface p-4">
              <h2 className="text-headline-md text-on-surface mb-3">{t("applicationsTitle")}</h2>
              {clan.applications.length === 0 ? (
                <p className="text-label-sm text-on-surface-variant">{t("applicationsEmpty")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {clan.applications.map((app) => (
                    <li
                      key={app.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 px-3 py-2"
                    >
                      <FlagIcon
                        code={app.user.country}
                        className="h-3.5 w-auto rounded-xs shrink-0"
                      />
                      <span className="text-label-md text-on-surface flex-1 min-w-0 truncate">
                        {app.user.username}
                      </span>
                      {app.message && (
                        <span className="text-label-sm text-on-surface-variant w-full">
                          {app.message}
                        </span>
                      )}
                      <form action={respondApplication.bind(null, locale)}>
                        <input type="hidden" name="clanId" value={clan.id} />
                        <input type="hidden" name="applicationId" value={app.id} />
                        <input type="hidden" name="decision" value="accept" />
                        <SubmitButton
                          label={t("acceptApplication")}
                          pendingLabel={t("saving")}
                          className="ui-btn-primary min-h-11 px-3 text-label-sm"
                        />
                      </form>
                      <form action={respondApplication.bind(null, locale)}>
                        <input type="hidden" name="clanId" value={clan.id} />
                        <input type="hidden" name="applicationId" value={app.id} />
                        <input type="hidden" name="decision" value="decline" />
                        <SubmitButton
                          label={t("declineApplication")}
                          pendingLabel={t("saving")}
                          className={GHOST_BTN}
                        />
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              </section>
            )}

            {canManageApps && (
              <section className="rounded-xl border border-white/10 bg-glass-surface p-4">
              <h2 className="text-headline-md text-on-surface mb-3">{t("inviteTitle")}</h2>
              <form action={inviteToClan.bind(null, locale)} className="flex flex-wrap gap-2">
                <input type="hidden" name="clanId" value={clan.id} />
                <input
                  name="username"
                  required
                  placeholder={t("inviteUsernamePlaceholder")}
                  className="min-h-11 flex-1 min-w-40 rounded-lg border border-white/10 bg-surface-container px-3 text-label-md text-on-surface"
                />
                <SubmitButton
                  label={t("sendInvite")}
                  pendingLabel={t("saving")}
                  className="ui-btn-primary min-h-11 px-4 text-label-sm"
                />
              </form>
              </section>
            )}

            {isLeader && (
              <section className="rounded-xl border border-white/10 bg-glass-surface p-4">
                <h2 className="text-headline-md text-on-surface mb-3">{t("settingsTitle")}</h2>
                <form action={updateClanSettings.bind(null, locale)} className="flex flex-col gap-4">
                  <input type="hidden" name="clanId" value={clan.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-label-sm text-on-surface-variant">{t("mottoLabel")}</span>
                    <input
                      name="motto"
                      defaultValue={clan.motto ?? ""}
                      maxLength={80}
                      className="min-h-11 rounded-lg border border-white/10 bg-surface-container px-3 text-label-md"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-label-sm text-on-surface-variant">
                      {t("descriptionLabel")}
                    </span>
                    <textarea
                      name="description"
                      defaultValue={clan.description ?? ""}
                      maxLength={280}
                      rows={3}
                      className="rounded-lg border border-white/10 bg-surface-container px-3 py-2 text-label-md"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-label-sm text-on-surface-variant">{t("announcement")}</span>
                    <textarea
                      name="announcement"
                      defaultValue={clan.announcement ?? ""}
                      maxLength={280}
                      rows={2}
                      className="rounded-lg border border-white/10 bg-surface-container px-3 py-2 text-label-md"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-label-sm text-on-surface-variant">
                        {t("joinPolicyLabel")}
                      </span>
                      <select
                        name="joinPolicy"
                        defaultValue={clan.joinPolicy}
                        className="min-h-11 rounded-lg border border-white/10 bg-surface-container px-2 text-label-sm"
                      >
                        <option value="OPEN">{t("joinPolicies.OPEN")}</option>
                        <option value="REQUEST">{t("joinPolicies.REQUEST")}</option>
                        <option value="INVITE">{t("joinPolicies.INVITE")}</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-label-sm text-on-surface-variant">{t("focusLabel")}</span>
                      <select
                        name="focus"
                        defaultValue={clan.focus}
                        className="min-h-11 rounded-lg border border-white/10 bg-surface-container px-2 text-label-sm"
                      >
                        {(
                          [
                            "CASUAL",
                            "COMPETITIVE",
                            "PVE",
                            "PVP",
                            "COLLECTION",
                            "EVENTS",
                            "SOCIAL",
                            "MIXED",
                          ] as const
                        ).map((f) => (
                          <option key={f} value={f}>
                            {t(`focuses.${f}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-label-sm text-on-surface-variant">
                        {t("affinityLabel")}
                      </span>
                      <select
                        name="affinity"
                        defaultValue={clan.affinity}
                        className="min-h-11 rounded-lg border border-white/10 bg-surface-container px-2 text-label-sm"
                      >
                        {(
                          [
                            "NORMAL",
                            "FIRE",
                            "WATER",
                            "GRASS",
                            "ELECTRIC",
                            "ICE",
                            "ROCK",
                            "GROUND",
                            "PSYCHIC",
                            "DARK",
                            "STEEL",
                            "DRAGON",
                            "FAIRY",
                            "FIGHTING",
                            "GHOST",
                          ] as const
                        ).map((a) => (
                          <option key={a} value={a}>
                            {t(`affinities.${a}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <ClanEmblemEditor name="emblem" initial={emblem} labels={emblemLabels} />
                  <SubmitButton
                    label={t("saveSettings")}
                    pendingLabel={t("saving")}
                    className="ui-btn-primary min-h-11 self-start px-4 text-label-md"
                  />
                </form>
              </section>
            )}

            {isLeader && (
              <section className="rounded-xl border border-error/30 bg-error-container/20 p-4">
                <h2 className="text-headline-md text-error mb-2">{t("hub.dangerTitle")}</h2>
                <p className="text-label-sm text-on-surface-variant mb-3">{t("hub.dangerHint")}</p>
                <form action={disbandClan.bind(null, locale)}>
                  <input type="hidden" name="clanId" value={clan.id} />
                  <SubmitButton
                    label={t("disband")}
                    pendingLabel={t("disbanding")}
                    confirmMessage={t("confirmDisband")}
                    className={DANGER_BTN}
                  />
                </form>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RoleForm({
  locale,
  clanId,
  targetUserId,
  role,
  label,
  pending,
}: {
  locale: string;
  clanId: string;
  targetUserId: string;
  role: "OFFICER" | "MEMBER";
  label: string;
  pending: string;
}) {
  return (
    <form action={setMemberRole.bind(null, locale)}>
      <input type="hidden" name="clanId" value={clanId} />
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <input type="hidden" name="role" value={role} />
      <SubmitButton label={label} pendingLabel={pending} className={GHOST_BTN} />
    </form>
  );
}

function RoleChip({ role, label }: { role: ClanRole; label: string }) {
  const style =
    role === "LEADER"
      ? "bg-electric-yellow/15 text-electric-yellow border-electric-yellow/40"
      : role === "OFFICER"
        ? "bg-tertiary/15 text-tertiary border-tertiary/40"
        : "bg-white/5 text-on-surface-variant border-white/15";
  const icon = role === "LEADER" ? "shield_person" : role === "OFFICER" ? "star" : "person";

  return (
    <span
      className={`w-16 shrink-0 inline-flex items-center justify-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] uppercase ${style}`}
      title={label}
    >
      <span className="material-symbols-outlined text-[12px]!">{icon}</span>
      {label}
    </span>
  );
}

function ClanKpi({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 text-center ${className}`}>
      <p className="text-[8px] font-semibold uppercase tracking-wider text-white/35 sm:text-[9px]">
        {label}
      </p>
      <p className="mt-1 font-mono text-[0.95rem] font-bold tabular-nums leading-none text-white sm:text-[1.1rem]">
        {value}
      </p>
    </div>
  );
}
