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

export default async function PvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
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

  const [me, teamCount, matches] = await Promise.all([
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
    prisma.pokemonInstance.count({ where: { ownerId: userId, teamSlot: { not: null } } }),
    prisma.pvpMatch.findMany({
      where: { OR: [{ challengerId: userId }, { opponentId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        challengerId: true,
        winnerId: true,
        challengerRatingBefore: true,
        challengerRatingAfter: true,
        opponentRatingBefore: true,
        opponentRatingAfter: true,
        challenger: { select: { username: true, country: true } },
        opponent: { select: { username: true, country: true } },
      },
    }),
  ]);

  const energy = getCurrentEnergy(me.energy, me.energyMax, me.energyUpdatedAt);
  const total = me.pvpWins + me.pvpLosses;
  const winRate = total > 0 ? Math.round((me.pvpWins / total) * 100) : 0;
  const canFight = teamCount > 0 && energy >= 1;

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <LiveRefresh />
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-headline-lg md:text-display-lg text-white">{t("title")}</h1>
          <p className="text-label-md text-on-surface-variant mt-1">{t("subtitle")}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-error/40 bg-error-container/30 px-4 py-2 text-label-md text-error">
            {t(`errors.${error}`)}
          </div>
        )}

        {/* Panel de rating + acción */}
        <div className="rounded-xl border border-white/10 bg-glass-surface p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div>
                <div className="text-label-sm text-on-surface-variant uppercase tracking-wide">
                  {t("rating")}
                </div>
                <div className="text-display-sm font-mono text-electric-yellow">{me.pvpRating}</div>
              </div>
              <div className="flex flex-col gap-0.5 text-label-md">
                <span className="text-tertiary">{t("wins", { count: me.pvpWins })}</span>
                <span className="text-error">{t("losses", { count: me.pvpLosses })}</span>
                {total > 0 && (
                  <span className="text-on-surface-variant">{t("winRate", { pct: winRate })}</span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <form action={findMatch.bind(null, locale)}>
                <SubmitButton
                  label={teamCount === 0 ? t("noTeam") : energy < 1 ? t("noEnergy") : t("findMatch")}
                  pendingLabel={t("searching")}
                  disabled={!canFight}
                  className="text-label-md px-5 py-2 rounded-lg bg-pokeball-red text-white hover:bg-pokeball-red/80 transition-colors"
                />
              </form>
              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-electric-yellow">bolt</span>
                {t("energyCost", { energy })}
              </span>
              <Link
                href="/ranking?view=ladder"
                className="text-label-sm text-on-surface-variant hover:text-on-surface flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">trophy</span>
                {t("viewLadder")}
              </Link>
            </div>
          </div>
        </div>

        <h2 className="text-headline-md text-on-surface mb-3">{t("historyTitle")}</h2>
        {matches.length === 0 ? (
          <div className="bg-glass-surface border border-white/5 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[40px] mb-2 opacity-50">swords</span>
            <span className="text-label-md text-center">{t("emptyHistory")}</span>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {matches.map((m) => {
              const iAmChallenger = m.challengerId === userId;
              const foe = iAmChallenger ? m.opponent : m.challenger;
              const iWon = m.winnerId === userId;
              const before = iAmChallenger ? m.challengerRatingBefore : m.opponentRatingBefore;
              const after = iAmChallenger ? m.challengerRatingAfter : m.opponentRatingAfter;
              const delta = after - before;

              return (
                <li key={m.id}>
                  <Link
                    href={`/pvp/${m.id}`}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-xl transition-colors hover:border-pokeball-red/40 ${
                      iWon ? "border-tertiary/30 bg-tertiary/5" : "border-error/25 bg-error/5"
                    }`}
                  >
                    <span
                      className={`w-14 shrink-0 text-center text-label-sm font-bold uppercase rounded-md py-1 ${
                        iWon ? "bg-tertiary/15 text-tertiary" : "bg-error/15 text-error"
                      }`}
                    >
                      {iWon ? t("win") : t("loss")}
                    </span>
                    <div className="min-w-0 flex-1 flex items-center gap-1.5">
                      <span className="text-label-md text-on-surface-variant">{t("vs")}</span>
                      <FlagIcon code={foe.country} className="h-3.5 w-auto rounded-[2px] shrink-0" />
                      <span className="text-label-md text-on-surface truncate">{foe.username}</span>
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
