import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CLAN_ERRORS, CLAN_NOTICES, pickCode } from "@/lib/feedback-codes";
import {
  CLAN_CREATION_COST,
  CLAN_MAX_MEMBERS,
  CLAN_NAME_MAX,
  CLAN_NAME_MIN,
  CLAN_TAG_MAX,
  CLAN_TAG_MIN,
} from "@/lib/clan-rules";
import { compareTrainers, teamPower } from "@/lib/ranking";
import { SubmitButton } from "@/components/submit-button";
import { createClan } from "@/actions/clan";

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

  const [membership, clans, me] = await Promise.all([
    prisma.clanMember.findUnique({
      where: { userId },
      select: { clanId: true, role: true, clan: { select: { name: true, tag: true } } },
    }),
    // Directorio + ranking. Se cargan los clanes con sus miembros (medallas y
    // equipo activo) para calcular el poder agregado. A escala esto pasaría a
    // columnas denormalizadas (fase 7) — para el MVP alcanza.
    prisma.clan.findMany({
      select: {
        id: true,
        name: true,
        tag: true,
        createdAt: true,
        leaderId: true,
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
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { coins: true } }),
  ]);

  const ranked = clans
    .map((c) => {
      const badges = c.members.reduce((sum, m) => sum + m.user._count.badges, 0);
      const power = c.members.reduce((sum, m) => sum + teamPower(m.user.pokemon), 0);
      return {
        id: c.id,
        name: c.name,
        tag: c.tag,
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

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <h1 className="text-headline-lg md:text-display-lg text-white">{t("title")}</h1>
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

        {membership ? (
          <Link
            href={`/clans/${membership.clanId}`}
            className="mb-6 flex items-center gap-3 rounded-xl border border-pokeball-red/40 bg-pokeball-red/10 px-4 py-3 hover:bg-pokeball-red/15 transition-colors"
          >
            <span className="material-symbols-outlined text-pokeball-red text-[28px]!">groups</span>
            <div className="min-w-0 flex-1">
              <div className="text-label-md text-on-surface">
                <span className="font-mono text-pokeball-red">[{membership.clan.tag}]</span>{" "}
                {membership.clan.name}
              </div>
              <div className="text-label-sm text-on-surface-variant">
                {t("yourClanRole", { role: t(`roles.${membership.role}`) })}
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
          </Link>
        ) : (
          <CreateClanForm locale={locale} coins={me.coins} />
        )}

        <h2 className="text-headline-md text-on-surface mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-electric-yellow text-[20px]!">leaderboard</span>
          {t("directoryTitle")}
        </h2>

        {ranked.length === 0 ? (
          <div className="bg-glass-surface border border-white/5 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[40px]! mb-2 opacity-50">groups</span>
            <span className="text-label-md text-center">{t("emptyDirectory")}</span>
          </div>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {ranked.map((c, i) => {
              const rank = i + 1;
              const isMine = c.id === membership?.clanId;
              return (
                <li key={c.id}>
                  <Link
                    href={`/clans/${c.id}`}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-xl transition-colors ${
                      isMine
                        ? "border-pokeball-red/50 bg-pokeball-red/10"
                        : "border-white/10 bg-glass-surface hover:border-pokeball-red/40"
                    }`}
                  >
                    <span
                      className={`w-8 h-8 shrink-0 flex items-center justify-center font-mono text-label-md ${
                        rank <= 3 ? "text-electric-yellow font-bold" : "text-on-surface-variant"
                      }`}
                    >
                      {rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-label-md text-on-surface truncate">
                        <span className="font-mono text-pokeball-red">[{c.tag}]</span> {c.name}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-label-sm text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]!">group</span>
                          {t("memberCount", { count: c.memberCount, max: CLAN_MAX_MEMBERS })}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]! text-tertiary">military_tech</span>
                          {c.badges}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]! text-electric-yellow">bolt</span>
                          {c.power}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant shrink-0">chevron_right</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

async function CreateClanForm({ locale, coins }: { locale: string; coins: number }) {
  const t = await getTranslations("clans");
  const canAfford = coins >= CLAN_CREATION_COST;

  return (
    <form
      action={createClan.bind(null, locale)}
      className="mb-6 rounded-xl border border-white/10 bg-glass-surface p-4"
    >
      <h2 className="text-headline-md text-on-surface mb-1 flex items-center gap-2">
        <span className="material-symbols-outlined text-pokeball-red text-[20px]!">add_circle</span>
        {t("createTitle")}
      </h2>
      <p className="text-label-sm text-on-surface-variant mb-3">
        {t("createCost", { cost: CLAN_CREATION_COST })}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-40">
          <label className="text-label-sm text-on-surface-variant" htmlFor="name">
            {t("nameLabel")}
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={CLAN_NAME_MIN}
            maxLength={CLAN_NAME_MAX}
            placeholder={t("namePlaceholder")}
            className="bg-surface-container border border-white/10 rounded-lg px-3 py-1.5 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50"
          />
        </div>
        <div className="flex flex-col gap-1 w-28">
          <label className="text-label-sm text-on-surface-variant" htmlFor="tag">
            {t("tagLabel")}
          </label>
          <input
            id="tag"
            name="tag"
            required
            minLength={CLAN_TAG_MIN}
            maxLength={CLAN_TAG_MAX}
            placeholder={t("tagPlaceholder")}
            className="bg-surface-container border border-white/10 rounded-lg px-3 py-1.5 text-label-md text-on-surface uppercase font-mono placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50"
          />
        </div>
        <SubmitButton
          label={canAfford ? t("createButton") : t("noFunds")}
          pendingLabel={t("creating")}
          disabled={!canAfford}
          className="text-label-md px-4 py-1.5 rounded-lg bg-pokeball-red text-white hover:bg-pokeball-red/80 transition-colors"
        />
      </div>
    </form>
  );
}
