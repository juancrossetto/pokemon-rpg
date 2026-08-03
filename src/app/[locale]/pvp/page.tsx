import { LiveRefresh } from "@/components/live-refresh";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentEnergy } from "@/lib/energy";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { PVP_ERRORS, pickCode } from "@/lib/feedback-codes";
import { PvpArenaHub } from "@/components/pvp/pvp-arena-hub";
import type { PvpHubMatchCard } from "@/components/pvp/pvp-rivals-history";
import { currentSeasonKey, nextSeasonReset } from "@/lib/pvp/seasons";
import {
  buildSeasonTrack,
  currentWinStreak,
  nextRankProgress,
} from "@/lib/pvp/hub";
import {
  isPvpRankingEligible,
  PVP_MIN_MATCHES,
  winRate,
} from "@/lib/ranking";
import { avatarById } from "@/lib/avatars";
import { speciesRarity } from "@/lib/pokedex";
import { parseTeamSnap } from "@/lib/pvp/team";
import { faintedBySide } from "@/lib/pvp/ko-log";
import {
  divisionRoman,
  rankForRating,
  type PvpTier,
} from "@/lib/pvp/tiers";
import { getTranslations } from "next-intl/server";
import { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 5;

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

  const errorCode = pickCode(query.error, PVP_ERRORS);
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const seasonKey = currentSeasonKey();
  const seasonEnd = nextSeasonReset();

  const [me, adventureCount, pvpPresetCount, matchTotal, matches, candidates] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          username: true,
          avatarId: true,
          country: true,
          createdAt: true,
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
          challengerTeam: true,
          opponentTeam: true,
          koLog: true,
          challenger: {
            select: { username: true, country: true, avatarId: true },
          },
          opponent: {
            select: { username: true, country: true, avatarId: true },
          },
        },
      }),
      prisma.pokemonInstance.findMany({
        where: {
          ownerId: userId,
          OR: [{ teamSlot: { not: null } }, { pvpSlot: { not: null } }],
        },
        include: {
          species: {
            select: {
              id: true,
              name: true,
              spriteUrl: true,
              types: true,
              captureRate: true,
            },
          },
        },
        orderBy: [{ teamSlot: "asc" }, { pvpSlot: "asc" }],
        take: 40,
      }),
    ]);

  const pool =
    candidates.length > 0
      ? candidates
      : await prisma.pokemonInstance.findMany({
          where: { ownerId: userId },
          include: {
            species: {
              select: {
                id: true,
                name: true,
                spriteUrl: true,
                types: true,
                captureRate: true,
              },
            },
          },
          orderBy: { caughtAt: "desc" },
          take: 24,
        });

  let ladderRank: number | null = null;
  if (isPvpRankingEligible(me.pvpWins, me.pvpLosses)) {
    const rows = await prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n
      FROM "User" u
      WHERE u.id <> ${userId}
        AND (u."pvpWins" + u."pvpLosses") >= ${PVP_MIN_MATCHES}
        AND (
          u."pvpRating" > ${me.pvpRating}
          OR (u."pvpRating" = ${me.pvpRating} AND u."pvpWins" > ${me.pvpWins})
          OR (
            u."pvpRating" = ${me.pvpRating}
            AND u."pvpWins" = ${me.pvpWins}
            AND u."createdAt" < ${me.createdAt}
          )
        )
    `);
    ladderRank = Number(rows[0]?.n ?? BigInt(0)) + 1;
  }

  const energy = getCurrentEnergy(me.energy, me.energyMax, me.energyUpdatedAt);
  const hasTeam = adventureCount > 0 || pvpPresetCount > 0;
  const canFight = hasTeam && energy >= 1;
  const standing = rankForRating(me.pvpRating);
  const tier = standing.tier;
  const division = standing.division;
  const totalPages = Math.max(1, Math.ceil(matchTotal / PAGE_SIZE));
  const winPct = winRate(me.pvpWins, me.pvpLosses);
  const streak = currentWinStreak(matches, userId);
  const seasonTrack = buildSeasonTrack(me.pvpRating);
  const rankProgress = nextRankProgress(me.pvpRating);
  const formatStanding = (s: { tier: PvpTier; division: typeof division }) =>
    `${t(`tiers.${s.tier}`)} ${divisionRoman(s.division)}`;
  const nextRankLabel =
    rankProgress.next != null ? formatStanding(rankProgress.next) : null;

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

  const avatarHeroSrc = (id: string | null) => {
    const av = avatarById(id);
    return av?.stageSrc ?? av?.profileSrc ?? av?.src ?? null;
  };

  const selfAvatarSrc = avatarHeroSrc(me.avatarId);
  const hubMatches: PvpHubMatchCard[] = matches.map((m) => {
    const iAmChallenger = m.challengerId === userId;
    const foe = iAmChallenger ? m.opponent : m.challenger;
    const foeId = iAmChallenger ? m.opponentId : m.challengerId;
    const before = iAmChallenger ? m.challengerRatingBefore : m.opponentRatingBefore;
    const after = iAmChallenger
      ? (m.challengerRatingAfter ?? before)
      : (m.opponentRatingAfter ?? before);
    const challengerTeam = parseTeamSnap(m.challengerTeam);
    const opponentTeam = parseTeamSnap(m.opponentTeam);
    const fainted = faintedBySide(m.koLog);
    const mapTeam = (
      team: ReturnType<typeof parseTeamSnap>,
      side: "a" | "b",
    ) =>
      team.map((mon) => ({
        id: mon.instanceId,
        name: mon.name,
        spriteUrl: mon.spriteUrl,
        level: mon.level,
        fainted: fainted[side].has(mon.name.toLowerCase()),
      }));

    return {
      id: m.id,
      foeId,
      foeName: foe.username,
      foeCountry: foe.country,
      foeAvatarSrc: avatarHeroSrc(foe.avatarId),
      selfName: me.username,
      selfAvatarSrc,
      mode: m.mode,
      status: m.status,
      iWon: m.winnerId === userId,
      delta: after - before,
      myTeam: mapTeam(
        iAmChallenger ? challengerTeam : opponentTeam,
        iAmChallenger ? "a" : "b",
      ),
      foeTeam: mapTeam(
        iAmChallenger ? opponentTeam : challengerTeam,
        iAmChallenger ? "b" : "a",
      ),
    };
  });

  const tierLabels = {
    beginner: t("tiers.beginner"),
    rising: t("tiers.rising"),
    advanced: t("tiers.advanced"),
    elite: t("tiers.elite"),
    bronzeMaster: t("tiers.bronzeMaster"),
    crystalMaster: t("tiers.crystalMaster"),
    champion: t("tiers.champion"),
    legendary: t("tiers.legendary"),
  } as Record<PvpTier, string>;

  return (
    <>
      <LiveRefresh />
      <PvpArenaHub
        locale={locale}
        error={errorCode ? t(`errors.${errorCode}`) : null}
        rating={me.pvpRating}
        tier={tier}
        division={division}
        wins={me.pvpWins}
        losses={me.pvpLosses}
        winPct={winPct}
        streak={streak}
        ladderRank={ladderRank}
        energy={energy}
        canFight={canFight}
        seasonEndsIso={seasonEnd.toISOString()}
        seasonLabel={t("season", { key: seasonKey })}
        seasonTrack={seasonTrack}
        nextTierPct={rankProgress.pct}
        nextTierLabel={nextRankLabel}
        standingLabel={formatStanding(standing)}
        candidates={pool.map((p) => ({
          id: p.id,
          name: p.nickname ?? p.species.name,
          speciesName: p.species.name,
          level: p.level,
          spriteUrl: p.species.spriteUrl,
          types: p.species.types,
          rarity: speciesRarity({
            id: p.species.id,
            captureRate: p.species.captureRate,
          }),
          isShiny: p.isShiny,
          pvpSlot: p.pvpSlot,
          teamSlot: p.teamSlot,
        }))}
        matches={hubMatches}
        page={page}
        totalPages={totalPages}
        labels={{
          eyebrow: t("eyebrow"),
          title: t("title"),
          rating: t("rating"),
          viewLadder: t("viewLadder"),
          seasonLabel: t("season", { key: seasonKey }),
          winRate: t("winRateShort"),
          streak: t("streak"),
          rankLabel: t("rankLabel"),
          rankUnranked: t("rankUnranked"),
          modesTitle: t("modesTitle"),
          modeRanked: t("modeRanked"),
          modeQuick: t("modeQuick"),
          modeChallenge: t("modeChallenge"),
          rankedBlurb: t("rankedBlurbShort"),
          quickBlurb: t("quickBlurbShort"),
          challengeBlurb: t("challengeBlurbShort"),
          rankedLabel,
          quickLabel,
          searching: t("searching"),
          starting: t("starting"),
          energyCost: t("energyCost", { energy }),
          energyCostShort: t("energyCostShort", { energy }),
          difficultyEasy: t("difficultyEasy"),
          difficultyNormal: t("difficultyNormal"),
          difficultyHard: t("difficultyHard"),
          rewardCoinsHint: t("rewardCoinsHint"),
          emptyHistory: t("emptyHistory"),
          win: t("win"),
          loss: t("loss"),
          forfeit: t("forfeit"),
          rematch: t("rematch"),
          seasonTrackTitle: t("seasonTrackTitle"),
          seasonTrackHint: t("seasonTrackHint"),
          rivalsTitle: t("rivalsTitle"),
          missionTitle: t("missionTitle"),
          missionNextTier: t("missionNextTier"),
          missionWins: t("missionWins"),
          vsShort: t("vsShort"),
          you: t("you"),
          lastRival: t("lastRival"),
          winsLabel: t("winsLabel"),
          lossesLabel: t("lossesLabel"),
          viewMatch: t("viewMatch"),
          fainted: t("fainted"),
          levelShort: t("levelShort", { level: "{level}" }),
          teamUnknown: t("teamUnknown"),
          paginationPrev: t("pagination.prev"),
          paginationNext: t("pagination.next"),
          paginationPageOf: t("pagination.pageOf", { page, total: totalPages }),
          tiers: tierLabels,
        }}
      />
    </>
  );
}
