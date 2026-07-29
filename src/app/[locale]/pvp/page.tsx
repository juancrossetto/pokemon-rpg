import { getTranslations } from "next-intl/server";
import { LiveRefresh } from "@/components/live-refresh";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentEnergy } from "@/lib/energy";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { PVP_ERRORS, pickCode } from "@/lib/feedback-codes";
import { SubmitButton } from "@/components/submit-button";
import { FlagIcon } from "@/components/flag-icon";
import { findMatch } from "@/actions/pvp";
import {
  startPvpChallenge,
  startPvpRanked,
  startPvpRematch,
} from "@/actions/start-pvp-battle";
import { PvpTeamEditor } from "@/components/pvp-team-editor";
import { tierAccentClass, tierForRating } from "@/lib/pvp/tiers";
import { currentSeasonKey, nextSeasonReset } from "@/lib/pvp/seasons";
import { HandbookLink } from "@/components/handbook/handbook-trigger";

const PAGE_SIZE = 10;

export default async function PvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; page?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [t, session] = await Promise.all([getTranslations("pvp"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  await redirectIfInBattle(userId, locale);

  const error = pickCode(query.error, PVP_ERRORS);
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const seasonKey = currentSeasonKey();
  const seasonEnd = nextSeasonReset();

  const [me, adventureCount, pvpPresetCount, matchTotal, matches, candidates] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          pvpRating: true,
          pvpWins: true,
          pvpLosses: true,
          energy: true,
          energyMax: true,
          energyUpdatedAt: true,
        },
      }),
      prisma.pokemonInstance.count({
        where: { ownerId: userId, teamSlot: { not: null } },
      }),
      prisma.pokemonInstance.count({
        where: { ownerId: userId, pvpSlot: { not: null } },
      }),
      prisma.pvpMatch.count({
        where: {
          OR: [{ challengerId: userId }, { opponentId: userId }],
          status: { in: ["COMPLETED", "FORFEIT"] },
        },
      }),
      prisma.pvpMatch.findMany({
        where: {
          OR: [{ challengerId: userId }, { opponentId: userId }],
          status: { in: ["COMPLETED", "FORFEIT"] },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          challengerId: true,
          opponentId: true,
          winnerId: true,
          status: true,
          mode: true,
          challengerRatingBefore: true,
          challengerRatingAfter: true,
          opponentRatingBefore: true,
          opponentRatingAfter: true,
          challenger: { select: { username: true, country: true } },
          opponent: { select: { username: true, country: true } },
        },
      }),
      prisma.pokemonInstance.findMany({
        where: {
          ownerId: userId,
          OR: [{ teamSlot: { not: null } }, { pvpSlot: { not: null } }],
        },
        include: { species: { select: { name: true, spriteUrl: true } } },
        orderBy: [{ teamSlot: "asc" }, { pvpSlot: "asc" }],
        take: 40,
      }),
    ]);

  // Si no hay nada en team/pvpSlot, listamos PC reciente para armar preset.
  const pool =
    candidates.length > 0
      ? candidates
      : await prisma.pokemonInstance.findMany({
          where: { ownerId: userId },
          include: { species: { select: { name: true, spriteUrl: true } } },
          orderBy: { caughtAt: "desc" },
          take: 24,
        });

  const energy = getCurrentEnergy(me.energy, me.energyMax, me.energyUpdatedAt);
  const total = me.pvpWins + me.pvpLosses;
  const winRate = total > 0 ? Math.round((me.pvpWins / total) * 100) : 0;
  const hasTeam = adventureCount > 0 || pvpPresetCount > 0;
  const canFight = hasTeam && energy >= 1;
  const tier = tierForRating(me.pvpRating);
  const totalPages = Math.max(1, Math.ceil(matchTotal / PAGE_SIZE));

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <LiveRefresh />
      <div className="mx-auto max-w-3xl flex flex-col gap-6">
        <div>
          <h1 className="text-headline-lg md:text-display-lg text-white">{t("title")}</h1>
          <p className="text-label-md text-on-surface-variant mt-1">{t("subtitle")}</p>
          <div className="mt-3">
            <HandbookLink chapter="pvp" />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-error/40 bg-error-container/30 px-4 py-2 text-label-md text-error">
            {t(`errors.${error}`)}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-glass-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div>
                <div className="text-label-sm text-on-surface-variant uppercase tracking-wide">
                  {t("rating")}
                </div>
                <div className="text-display-sm font-mono text-electric-yellow">{me.pvpRating}</div>
                <span
                  className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-wide ${tierAccentClass(tier)}`}
                >
                  {t("tier")}: {t(`tiers.${tier}`)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 text-label-md">
                <span className="text-tertiary">{t("wins", { count: me.pvpWins })}</span>
                <span className="text-error">{t("losses", { count: me.pvpLosses })}</span>
                {total > 0 && (
                  <span className="text-on-surface-variant">{t("winRate", { pct: winRate })}</span>
                )}
                <span className="text-label-sm text-on-surface-variant mt-1">
                  {t("season", { key: seasonKey })}
                </span>
                <span className="text-label-sm text-on-surface-variant/70">
                  {t("seasonEnds", {
                    date: seasonEnd.toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                    }),
                  })}
                </span>
              </div>
            </div>

            <Link
              href="/ranking?view=ladder"
              className="text-label-sm text-on-surface-variant hover:text-on-surface flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]!">trophy</span>
              {t("viewLadder")}
            </Link>
          </div>
        </div>

        <section>
          <h2 className="text-headline-md text-on-surface mb-3">{t("modesTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-pokeball-red/30 bg-pokeball-red/5 p-4 flex flex-col gap-3">
              <div>
                <p className="text-label-lg font-bold text-white">{t("rankedMatch")}</p>
                <p className="text-label-sm text-on-surface-variant mt-1">{t("rankedBlurb")}</p>
              </div>
              <form action={startPvpRanked.bind(null, locale)}>
                <SubmitButton
                  label={
                    !hasTeam ? t("noTeam") : energy < 1 ? t("noEnergy") : t("rankedMatch")
                  }
                  pendingLabel={t("starting")}
                  disabled={!canFight}
                  className="w-full text-label-md px-5 py-2 rounded-lg bg-pokeball-red text-white hover:bg-pokeball-red/80 transition-colors"
                />
              </form>
              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]! text-electric-yellow">
                  bolt
                </span>
                {t("energyCost", { energy })}
              </span>
            </div>

            <div className="rounded-xl border border-white/10 bg-glass-surface p-4 flex flex-col gap-3">
              <div>
                <p className="text-label-lg font-bold text-white">{t("findMatch")}</p>
                <p className="text-label-sm text-on-surface-variant mt-1">{t("quickBlurb")}</p>
              </div>
              <form action={findMatch.bind(null, locale)}>
                <SubmitButton
                  label={!hasTeam ? t("noTeam") : energy < 1 ? t("noEnergy") : t("findMatch")}
                  pendingLabel={t("searching")}
                  disabled={!canFight}
                  className="w-full text-label-md px-5 py-2 rounded-lg border border-white/20 text-on-surface hover:bg-white/5 transition-colors"
                />
              </form>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-glass-surface p-4">
          <h2 className="text-headline-md text-on-surface mb-1">{t("challengeTitle")}</h2>
          <p className="text-label-sm text-on-surface-variant mb-3">{t("challengeBlurb")}</p>
          <form action={startPvpChallenge.bind(null, locale)} className="flex flex-wrap gap-2">
            <input
              name="username"
              required
              placeholder={t("challengePlaceholder")}
              className="min-w-[12rem] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50"
            />
            <SubmitButton
              label={t("challengeSubmit")}
              pendingLabel={t("starting")}
              disabled={!canFight}
              className="text-label-md px-4 py-2 rounded-lg bg-electric-yellow/90 text-black font-bold hover:bg-electric-yellow disabled:opacity-60"
            />
          </form>
        </section>

        <PvpTeamEditor
          locale={locale}
          candidates={pool.map((p) => ({
            id: p.id,
            name: p.nickname ?? p.species.name,
            speciesName: p.species.name,
            level: p.level,
            spriteUrl: p.species.spriteUrl,
            pvpSlot: p.pvpSlot,
            teamSlot: p.teamSlot,
          }))}
        />

        <section>
          <h2 className="text-headline-md text-on-surface mb-3">{t("historyTitle")}</h2>
          {matches.length === 0 ? (
            <div className="bg-glass-surface border border-white/5 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px]! mb-2 opacity-50">swords</span>
              <span className="text-label-md text-center">{t("emptyHistory")}</span>
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                {matches.map((m) => {
                  const iAmChallenger = m.challengerId === userId;
                  const foe = iAmChallenger ? m.opponent : m.challenger;
                  const foeId = iAmChallenger ? m.opponentId : m.challengerId;
                  const iWon = m.winnerId === userId;
                  const before = iAmChallenger
                    ? m.challengerRatingBefore
                    : m.opponentRatingBefore;
                  const after = iAmChallenger
                    ? (m.challengerRatingAfter ?? before)
                    : (m.opponentRatingAfter ?? before);
                  const delta = after - before;
                  const resultLabel =
                    m.status === "FORFEIT" && !iWon
                      ? t("forfeit")
                      : iWon
                        ? t("win")
                        : t("loss");

                  return (
                    <li key={m.id} className="flex items-center gap-2">
                      <Link
                        href={`/pvp/${m.id}`}
                        className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-xl transition-colors hover:border-pokeball-red/40 ${
                          iWon ? "border-tertiary/30 bg-tertiary/5" : "border-error/25 bg-error/5"
                        }`}
                      >
                        <span
                          className={`w-14 shrink-0 text-center text-label-sm font-bold uppercase rounded-md py-1 ${
                            iWon ? "bg-tertiary/15 text-tertiary" : "bg-error/15 text-error"
                          }`}
                        >
                          {resultLabel}
                        </span>
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <span className="text-[10px] uppercase text-on-surface-variant/70">
                            {m.mode === "RANKED" ? t("modeRanked") : t("modeQuick")}
                          </span>
                          <span className="text-label-md text-on-surface-variant">{t("vs")}</span>
                          <FlagIcon
                            code={foe.country}
                            className="h-3.5 w-auto rounded-[2px] shrink-0"
                          />
                          <span className="text-label-md text-on-surface truncate">
                            {foe.username}
                          </span>
                        </div>
                        <span
                          className={`text-label-md font-mono shrink-0 ${
                            delta >= 0 ? "text-tertiary" : "text-error"
                          }`}
                        >
                          {delta >= 0 ? "+" : ""}
                          {delta}
                        </span>
                      </Link>
                      <form action={startPvpRematch.bind(null, locale, foeId)}>
                        <SubmitButton
                          label={t("rematch")}
                          pendingLabel={t("starting")}
                          disabled={!canFight}
                          className="shrink-0 rounded-lg border border-white/15 px-2.5 py-2 text-label-sm text-on-surface-variant hover:text-on-surface hover:border-pokeball-red/40 disabled:opacity-50"
                        />
                      </form>
                    </li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between gap-3 text-label-sm">
                  {page > 1 ? (
                    <Link
                      href={`/pvp?page=${page - 1}`}
                      className="text-on-surface-variant hover:text-on-surface"
                    >
                      {t("pagination.prev")}
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-on-surface-variant">
                    {t("pagination.pageOf", { page, total: totalPages })}
                  </span>
                  {page < totalPages ? (
                    <Link
                      href={`/pvp?page=${page + 1}`}
                      className="text-on-surface-variant hover:text-on-surface"
                    >
                      {t("pagination.next")}
                    </Link>
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
