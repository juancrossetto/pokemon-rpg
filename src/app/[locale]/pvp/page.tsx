import Image from "next/image";
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
import { startPvpRanked, startPvpRematch } from "@/actions/start-pvp-battle";
import { PvpChallengeSearch } from "@/components/pvp-challenge-search";
import { PvpTeamEditor } from "@/components/pvp-team-editor";
import { tierAccentClass, tierForRating } from "@/lib/pvp/tiers";
import { currentSeasonKey, nextSeasonReset } from "@/lib/pvp/seasons";
import { HandbookLink } from "@/components/handbook/handbook-trigger";

const PAGE_SIZE = 10;
const SECTION_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45";

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
  const hasTeam = adventureCount > 0 || pvpPresetCount > 0;
  const canFight = hasTeam && energy >= 1;
  const tier = tierForRating(me.pvpRating);
  const totalPages = Math.max(1, Math.ceil(matchTotal / PAGE_SIZE));
  const rankedLabel = !hasTeam
    ? t("noTeam")
    : energy < 1
      ? t("noEnergy")
      : t("rankedMatch");
  const quickLabel = !hasTeam
    ? t("noTeam")
    : energy < 1
      ? t("noEnergy")
      : t("findMatch");
  const seasonEnds = seasonEnd.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-5 md:py-7">
      <LiveRefresh />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 md:gap-5">
        <header className="px-0.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff8a00]">
            {t("eyebrow")}
          </p>
          <h1 className="page-title text-headline-lg text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] md:text-display-lg">
            {t("title")}
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-white/60">{t("subtitle")}</p>
          <div className="mt-2.5">
            <HandbookLink chapter="pvp" />
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-error/40 bg-error-container/30 px-4 py-2.5 text-[13px] text-error">
            {t(`errors.${error}`)}
          </div>
        ) : null}

        {/* Rating — una sola superficie, sin chips anidados */}
        <section className="game-float-card relative overflow-hidden rounded-2xl p-4 sm:p-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -left-10 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(255,160,20,0.22),transparent_68%)]"
          />
          <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="flex min-w-0 flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className={SECTION_LABEL}>{t("rating")}</p>
                <p className="pvp-rating-num mt-0.5 font-[family-name:var(--font-lilita)] text-[3.35rem] leading-none tracking-wide sm:text-[3.85rem]">
                  {me.pvpRating}
                </p>
                <span
                  className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${tierAccentClass(tier)}`}
                >
                  {t(`tiers.${tier}`)}
                </span>
              </div>

              <div className="pb-0.5">
                <div className="flex items-center gap-5">
                  <div
                    className="flex items-center gap-1.5"
                    title={t("wins", { count: me.pvpWins })}
                    aria-label={t("wins", { count: me.pvpWins })}
                  >
                    <Image
                      src="/pvp/win-trophy.png"
                      alt=""
                      width={28}
                      height={42}
                      className="h-8 w-auto object-contain"
                      unoptimized
                    />
                    <span className="font-mono text-[1.25rem] font-bold tabular-nums text-white">
                      {me.pvpWins}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1.5"
                    title={t("losses", { count: me.pvpLosses })}
                    aria-label={t("losses", { count: me.pvpLosses })}
                  >
                    <Image
                      src="/pvp/lose-shield.png"
                      alt=""
                      width={28}
                      height={42}
                      className="h-8 w-auto object-contain"
                      unoptimized
                    />
                    <span className="font-mono text-[1.25rem] font-bold tabular-nums text-white">
                      {me.pvpLosses}
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-white/40">
                  {t("season", { key: seasonKey })} · {t("seasonEnds", { date: seasonEnds })}
                </p>
              </div>
            </div>

            <Link
              href="/ranking?view=ladder"
              className="inline-flex items-center gap-1.5 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45 transition hover:text-[#ffcb05]"
            >
              <Image
                src="/pvp/win-trophy.png"
                alt=""
                width={14}
                height={21}
                className="h-4 w-auto object-contain opacity-80"
                unoptimized
              />
              {t("viewLadder")}
            </Link>
          </div>
        </section>

        {/* Modos — misma altura, CTAs alineados */}
        <section>
          <p className={`mb-2 px-0.5 ${SECTION_LABEL}`}>{t("modesTitle")}</p>
          <div className="grid gap-3 sm:grid-cols-2 sm:items-stretch">
            <div className="game-float-card flex h-full flex-col gap-3 rounded-2xl p-4">
              <span className="w-fit rounded-md bg-pokeball-red px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">
                {t("modeRanked")}
              </span>
              <p className="flex-1 text-[12px] leading-relaxed text-white/55">
                {t("rankedBlurb")}
              </p>
              <div className="mt-auto flex flex-col gap-2">
                <form action={startPvpRanked.bind(null, locale)}>
                  <SubmitButton
                    label={rankedLabel}
                    pendingLabel={t("starting")}
                    disabled={!canFight}
                    className="game-cta game-cta--red"
                  />
                </form>
                <p className="flex items-center gap-1 text-[11px] text-white/40">
                  <span className="material-symbols-outlined text-[14px]! text-electric-yellow">
                    bolt
                  </span>
                  {t("energyCost", { energy })}
                </p>
              </div>
            </div>

            <div className="game-float-card flex h-full flex-col gap-3 rounded-2xl p-4">
              <span className="w-fit rounded-md bg-electric-yellow px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#1a1208]">
                {t("modeQuick")}
              </span>
              <p className="flex-1 text-[12px] leading-relaxed text-white/55">
                {t("quickBlurb")}
              </p>
              <div className="mt-auto flex flex-col gap-2">
                <form action={findMatch.bind(null, locale)}>
                  <SubmitButton
                    label={quickLabel}
                    pendingLabel={t("searching")}
                    disabled={!canFight}
                    className="game-cta"
                  />
                </form>
                <p className="flex items-center gap-1 text-[11px] text-white/40">
                  <span className="material-symbols-outlined text-[14px]! text-electric-yellow">
                    bolt
                  </span>
                  {t("energyCost", { energy })}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Desafío */}
        <section className="game-float-card rounded-2xl p-4 sm:p-5">
          <p className={SECTION_LABEL}>{t("challengeTitle")}</p>
          <p className="mt-1 mb-3 text-[12px] text-white/50">{t("challengeBlurb")}</p>
          <PvpChallengeSearch locale={locale} canFight={canFight} />
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

        {/* Historial */}
        <section>
          <p className={`mb-2 px-0.5 ${SECTION_LABEL}`}>{t("historyTitle")}</p>
          {matches.length === 0 ? (
            <div className="game-float-card rounded-2xl px-4 py-10 text-center">
              <Image
                src="/pvp/win-trophy.png"
                alt=""
                width={48}
                height={72}
                className="mx-auto mb-2 h-14 w-auto object-contain opacity-35"
                unoptimized
              />
              <p className="text-[12px] text-white/50">{t("emptyHistory")}</p>
            </div>
          ) : (
            <>
              <div className="game-float-card overflow-hidden rounded-2xl">
                <ul className="divide-y divide-white/10">
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
                      <li key={m.id} className="flex items-center gap-1 px-2 sm:px-3">
                        <Link
                          href={`/pvp/${m.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 transition hover:bg-white/3"
                          title={resultLabel}
                        >
                          <Image
                            src={iWon ? "/pvp/win-trophy.png" : "/pvp/lose-shield.png"}
                            alt={resultLabel}
                            width={22}
                            height={33}
                            className="h-7 w-auto shrink-0 object-contain"
                            unoptimized
                          />
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">
                              {m.mode === "RANKED" ? t("modeRanked") : t("modeQuick")}
                            </span>
                            <FlagIcon
                              code={foe.country}
                              className="h-3.5 w-auto shrink-0 rounded-xs"
                            />
                            <span className="truncate text-[13px] font-semibold text-white">
                              {foe.username}
                            </span>
                          </div>
                          <span
                            className={`shrink-0 font-mono text-[13px] font-bold ${
                              delta >= 0 ? "text-[#ffcb05]" : "text-[#ff6b6b]"
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
                            className="shrink-0 px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white"
                          />
                        </form>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-white/45">
                  {page > 1 ? (
                    <Link href={`/pvp?page=${page - 1}`} className="hover:text-white">
                      {t("pagination.prev")}
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span>{t("pagination.pageOf", { page, total: totalPages })}</span>
                  {page < totalPages ? (
                    <Link href={`/pvp?page=${page + 1}`} className="hover:text-white">
                      {t("pagination.next")}
                    </Link>
                  ) : (
                    <span />
                  )}
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
