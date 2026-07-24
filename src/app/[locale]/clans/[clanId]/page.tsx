import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FlagIcon } from "@/components/flag-icon";
import { SubmitButton } from "@/components/submit-button";
import { CLAN_ERRORS, CLAN_NOTICES, pickCode } from "@/lib/feedback-codes";
import { CLAN_MAX_MEMBERS } from "@/lib/clan-rules";
import { teamPower } from "@/lib/ranking";
import type { ClanRole } from "@/generated/prisma/enums";
import {
  disbandClan,
  joinClan,
  kickMember,
  leaveClan,
  setMemberRole,
  transferLeadership,
} from "@/actions/clan";

const SPECIES_STATS_SELECT = {
  baseHp: true,
  baseAttack: true,
  baseDefense: true,
  baseSpAtk: true,
  baseSpDef: true,
  baseSpeed: true,
} as const;

// Orden de despliegue: líder, oficiales, miembros; dentro, por antigüedad.
const ROLE_RANK: Record<ClanRole, number> = { LEADER: 0, OFFICER: 1, MEMBER: 2 };

const GHOST_BTN =
  "text-label-sm px-2.5 py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:border-white/30 transition-colors";
const DANGER_BTN =
  "text-label-sm px-2.5 py-1 rounded-lg border border-error/30 text-error hover:bg-error/10 transition-colors";

export default async function ClanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; clanId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
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

  const [clan, myMembership] = await Promise.all([
    prisma.clan.findUnique({
      where: { id: clanId },
      select: {
        id: true,
        name: true,
        tag: true,
        leaderId: true,
        createdAt: true,
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
      },
    }),
    prisma.clanMember.findUnique({ where: { userId }, select: { clanId: true, role: true } }),
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
    .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.joinedAt.getTime() - b.joinedAt.getTime());

  const myRole: ClanRole | null = myMembership?.clanId === clanId ? myMembership.role : null;
  const isLeader = myRole === "LEADER";
  const isOfficer = myRole === "OFFICER";
  const inAnyClan = myMembership !== null;
  const isFull = members.length >= CLAN_MAX_MEMBERS;

  const totalBadges = members.reduce((s, m) => s + m.badges, 0);
  const totalPower = members.reduce((s, m) => s + m.power, 0);

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/clans"
          className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-on-surface mb-3"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t("backToDirectory")}
        </Link>

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

        {/* Encabezado del clan */}
        <div className="rounded-xl border border-white/10 bg-glass-surface p-4 mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-headline-lg text-white">
                <span className="font-mono text-pokeball-red">[{clan.tag}]</span> {clan.name}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-label-sm text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">group</span>
                  {t("memberCount", { count: members.length, max: CLAN_MAX_MEMBERS })}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-tertiary">military_tech</span>
                  {t("badgeTotal", { count: totalBadges })}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-electric-yellow">bolt</span>
                  {t("power", { value: totalPower })}
                </span>
              </div>
            </div>

            {/* Acciones a nivel clan según el rol del que mira */}
            <div className="flex items-center gap-2">
              {!inAnyClan && (
                <form action={joinClan.bind(null, locale)}>
                  <input type="hidden" name="clanId" value={clan.id} />
                  <SubmitButton
                    label={isFull ? t("full") : t("join")}
                    pendingLabel={t("joining")}
                    disabled={isFull}
                    className="text-label-md px-4 py-1.5 rounded-lg bg-pokeball-red text-white hover:bg-pokeball-red/80 transition-colors"
                  />
                </form>
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
              {isLeader && (
                <form action={disbandClan.bind(null, locale)}>
                  <input type="hidden" name="clanId" value={clan.id} />
                  <SubmitButton
                    label={t("disband")}
                    pendingLabel={t("disbanding")}
                    confirmMessage={t("confirmDisband")}
                    className={DANGER_BTN}
                  />
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Miembros */}
        <h2 className="text-headline-md text-on-surface mb-2">{t("membersTitle")}</h2>
        <ul className="flex flex-col gap-1.5">
          {members.map((m) => {
            const isSelf = m.userId === userId;
            const canKick =
              !isSelf && (isLeader || (isOfficer && m.role === "MEMBER"));
            const canManageRole = isLeader && m.role !== "LEADER" && !isSelf;

            return (
              <li
                key={m.userId}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-xl ${
                  isSelf ? "border-pokeball-red/40 bg-pokeball-red/5" : "border-white/10 bg-glass-surface"
                }`}
              >
                <RoleChip role={m.role} label={t(`roles.${m.role}`)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <FlagIcon code={m.country} className="h-3.5 w-auto rounded-[2px] shrink-0" />
                    <span className="text-label-md text-on-surface truncate">{m.username}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-label-sm text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-tertiary">military_tech</span>
                      {m.badges}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-electric-yellow">bolt</span>
                      {m.power}
                    </span>
                  </div>
                </div>

                {(canManageRole || canKick) && (
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {canManageRole && m.role === "MEMBER" && (
                      <RoleForm locale={locale} clanId={clan.id} targetUserId={m.userId} role="OFFICER" label={t("promote")} pending={t("saving")} />
                    )}
                    {canManageRole && m.role === "OFFICER" && (
                      <RoleForm locale={locale} clanId={clan.id} targetUserId={m.userId} role="MEMBER" label={t("demote")} pending={t("saving")} />
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
          <p className="text-label-sm text-on-surface-variant mt-3">{t("leaderLeaveHint")}</p>
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
      <span className="material-symbols-outlined text-[12px]">{icon}</span>
      {label}
    </span>
  );
}
