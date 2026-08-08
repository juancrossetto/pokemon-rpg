import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseTeamSnap } from "@/lib/pvp/team";
import { faintedBySide } from "@/lib/pvp/ko-log";
import { pvpChallengeCooldownRemainingMs } from "@/lib/pvp/cooldown";
import {
  formatPvpTurnLine,
  PvpMatchReport,
} from "@/components/pvp/pvp-match-report";
import { PvpRankUpHost } from "@/components/pvp/pvp-rank-up-host";

export default async function PvpMatchPage({
  params,
}: {
  params: Promise<{ locale: string; matchId: string }>;
}) {
  const { locale, matchId } = await params;
  const [t, tBattle, session] = await Promise.all([
    getTranslations("pvp"),
    getTranslations("battle"),
    auth(),
  ]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  const match = await prisma.pvpMatch.findUnique({
    where: { id: matchId },
    select: {
      challengerId: true,
      opponentId: true,
      winnerId: true,
      status: true,
      mode: true,
      seasonKey: true,
      createdAt: true,
      coinsAwarded: true,
      challengerRatingBefore: true,
      challengerRatingAfter: true,
      opponentRatingBefore: true,
      opponentRatingAfter: true,
      challengerTeam: true,
      opponentTeam: true,
      koLog: true,
      turnLog: true,
      turns: true,
      challenger: { select: { username: true, country: true } },
      opponent: { select: { username: true, country: true } },
    },
  });

  if (!match) notFound();

  const settled = match.status === "COMPLETED" || match.status === "FORFEIT";
  const challengerWon = settled && match.winnerId === match.challengerId;
  const iAmChallenger = match.challengerId === userId;
  const iAmInMatch = iAmChallenger || match.opponentId === userId;
  const iWon = iAmInMatch && settled && match.winnerId === userId;
  const foeId = iAmChallenger ? match.opponentId : match.challengerId;

  const latestPair = iAmInMatch
    ? await prisma.pvpMatch.findFirst({
        where: {
          OR: [
            { challengerId: userId, opponentId: foeId },
            { challengerId: foeId, opponentId: userId },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
    : null;
  const cooldownMsLeft = pvpChallengeCooldownRemainingMs(
    latestPair?.createdAt ?? match.createdAt,
  );

  const challengerTeam = parseTeamSnap(match.challengerTeam);
  const opponentTeam = parseTeamSnap(match.opponentTeam);
  const fainted = faintedBySide(match.koLog);

  const tLog = (key: string, values?: Record<string, string | number>) =>
    tBattle(`log.${key}`, values);

  return (
    <>
      <PvpRankUpHost />
      <PvpMatchReport
      locale={locale}
      settled={settled}
      iAmInMatch={iAmInMatch}
      iWon={iWon}
      status={match.status}
      mode={match.mode}
      coinsAwarded={match.coinsAwarded ?? 0}
      foeId={foeId}
      cooldownMsLeft={cooldownMsLeft}
      challenger={match.challenger}
      opponent={match.opponent}
      challengerWon={challengerWon}
      challengerRatingBefore={match.challengerRatingBefore}
      challengerRatingAfter={
        match.challengerRatingAfter ?? match.challengerRatingBefore
      }
      opponentRatingBefore={match.opponentRatingBefore}
      opponentRatingAfter={
        match.opponentRatingAfter ?? match.opponentRatingBefore
      }
      challengerTeam={challengerTeam}
      opponentTeam={opponentTeam}
      faintedA={fainted.a}
      faintedB={fainted.b}
      koLog={match.koLog}
      turnLog={match.turnLog}
      labels={{
        backToPvp: t("backToPvp"),
        youWon: t("youWon"),
        youLost: t("youLost"),
        forfeit: t("forfeit"),
        active: t("active"),
        winner: t("winner"),
        vsShort: t("vsShort"),
        teamsTitle: t("teamsTitle"),
        teamUnknown: t("teamUnknown"),
        levelShort: (level) => t("levelShort", { level }),
        fainted: t("fainted"),
        rematch: t("rematch"),
        starting: t("starting"),
        battleLog: t("battleLog"),
        turnLog: t("turnLog"),
        turnLogShow: t("turnLogShow"),
        turnLogHide: t("turnLogHide"),
        defeated: (owner) => t("defeated", { owner }),
        noKos: t("noKos"),
        noTurnLog: t("noTurnLog"),
        turnsPlayed: t("turnsPlayed", { count: match.turns }),
        modeRanked: t("modeRanked"),
        modeQuick: t("modeQuick"),
        coinsAwarded: (n) => t("coinsAwarded", { n }),
      }}
      formatTurnLine={(raw) => formatPvpTurnLine(raw, tLog, locale)}
    />
    </>
  );
}
