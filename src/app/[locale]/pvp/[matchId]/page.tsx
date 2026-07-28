import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FlagIcon } from "@/components/flag-icon";
import { SubmitButton } from "@/components/submit-button";
import { startPvpRematch } from "@/actions/start-pvp-battle";
import { tierAccentClass, tierForRating } from "@/lib/pvp/tiers";

export default async function PvpMatchPage({
  params,
}: {
  params: Promise<{ locale: string; matchId: string }>;
}) {
  const { locale, matchId } = await params;
  const [t, session] = await Promise.all([getTranslations("pvp"), auth()]);

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
      coinsAwarded: true,
      challengerRatingBefore: true,
      challengerRatingAfter: true,
      opponentRatingBefore: true,
      opponentRatingAfter: true,
      koLog: true,
      turnLog: true,
      turns: true,
      createdAt: true,
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

  const sideName = (side: "a" | "b") =>
    side === "a" ? match.challenger.username : match.opponent.username;

  const myAfter = iAmChallenger
    ? (match.challengerRatingAfter ?? match.challengerRatingBefore)
    : (match.opponentRatingAfter ?? match.opponentRatingBefore);
  const myTier = tierForRating(myAfter);

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/pvp"
          className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-on-surface mb-3"
        >
          <span className="material-symbols-outlined text-[16px]!">arrow_back</span>
          {t("backToPvp")}
        </Link>

        {iAmInMatch && settled && (
          <div
            className={`rounded-xl border px-4 py-3 mb-4 text-center ${
              iWon
                ? "border-tertiary/40 bg-tertiary/10 text-tertiary"
                : "border-error/40 bg-error/10 text-error"
            }`}
          >
            <div className="text-headline-md font-bold">
              {match.status === "FORFEIT" && !iWon
                ? t("forfeit")
                : iWon
                  ? t("youWon")
                  : t("youLost")}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-label-sm">
              <span
                className={`rounded-md border px-2 py-0.5 uppercase ${tierAccentClass(myTier)}`}
              >
                {t(`tiers.${myTier}`)}
              </span>
              <span className="text-on-surface-variant">
                {match.mode === "RANKED" ? t("modeRanked") : t("modeQuick")}
              </span>
              {(match.coinsAwarded ?? 0) > 0 && (
                <span className="text-tertiary">
                  {t("coinsAwarded", { n: match.coinsAwarded ?? 0 })}
                </span>
              )}
            </div>
          </div>
        )}

        {!settled && (
          <div className="rounded-xl border border-electric-yellow/40 bg-electric-yellow/10 px-4 py-3 mb-4 text-center text-electric-yellow">
            <div className="text-headline-md font-bold">{t("active")}</div>
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-glass-surface p-4 mb-4">
          <div className="flex items-center justify-between gap-3">
            <Combatant
              username={match.challenger.username}
              country={match.challenger.country}
              won={challengerWon}
              ratingBefore={match.challengerRatingBefore}
              ratingAfter={match.challengerRatingAfter ?? match.challengerRatingBefore}
              winLabel={t("winner")}
              side="a"
            />
            <span className="text-headline-lg text-on-surface-variant font-black shrink-0">
              {t("vsShort")}
            </span>
            <Combatant
              username={match.opponent.username}
              country={match.opponent.country}
              won={settled && !challengerWon}
              ratingBefore={match.opponentRatingBefore}
              ratingAfter={match.opponentRatingAfter ?? match.opponentRatingBefore}
              winLabel={t("winner")}
              side="b"
              alignRight
            />
          </div>
        </div>

        {iAmInMatch && settled && (
          <form action={startPvpRematch.bind(null, locale, foeId)} className="mb-4">
            <SubmitButton
              label={t("rematch")}
              pendingLabel={t("starting")}
              className="w-full rounded-lg bg-pokeball-red px-4 py-2.5 text-label-md text-white font-bold hover:bg-pokeball-red/80"
            />
          </form>
        )}

        <h2 className="text-headline-md text-on-surface mb-2">{t("battleLog")}</h2>
        {match.koLog.length === 0 ? (
          <p className="text-label-md text-on-surface-variant">{t("noKos")}</p>
        ) : (
          <ol className="flex flex-col gap-1.5 mb-4">
            {match.koLog.map((entry, i) => {
              const parsed = parseKo(entry);
              if (!parsed) return null;
              const attackerIsChallenger = parsed.attackerSide === "a";
              return (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-glass-surface px-3 py-2 text-label-md"
                >
                  <span className="material-symbols-outlined text-[16px]! text-pokeball-red shrink-0">
                    swords
                  </span>
                  <span
                    className={attackerIsChallenger ? "text-tertiary" : "text-electric-yellow"}
                  >
                    {parsed.attackerName}
                  </span>
                  <span className="text-on-surface-variant">
                    {t("defeated", { owner: sideName(parsed.attackerSide) })}
                  </span>
                  <span className="text-on-surface capitalize">{parsed.faintedName}</span>
                  <span className="text-on-surface-variant text-label-sm">
                    ({sideName(parsed.faintedSide)})
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <h2 className="text-headline-md text-on-surface mb-2 mt-4">{t("turnLog")}</h2>
        {match.turnLog.length === 0 ? (
          <p className="text-label-md text-on-surface-variant">{t("noTurnLog")}</p>
        ) : (
          <ol className="flex flex-col gap-1 max-h-80 overflow-y-auto mb-3">
            {match.turnLog.map((line, i) => (
              <li
                key={i}
                className="rounded-md border border-white/5 bg-black/20 px-3 py-1.5 text-label-sm text-on-surface-variant font-mono"
              >
                {line}
              </li>
            ))}
          </ol>
        )}

        <p className="text-label-sm text-on-surface-variant mt-3">
          {t("turnsPlayed", { count: match.turns })}
        </p>
      </div>
    </div>
  );
}

function Combatant({
  username,
  country,
  won,
  ratingBefore,
  ratingAfter,
  winLabel,
  side,
  alignRight = false,
}: {
  username: string;
  country: string;
  won: boolean;
  ratingBefore: number;
  ratingAfter: number;
  winLabel: string;
  side: "a" | "b";
  alignRight?: boolean;
}) {
  const delta = ratingAfter - ratingBefore;
  const accent = side === "a" ? "text-tertiary" : "text-electric-yellow";

  return (
    <div
      className={`min-w-0 flex-1 flex flex-col gap-1 ${alignRight ? "items-end text-right" : "items-start"}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <FlagIcon code={country} className="h-3.5 w-auto rounded-[2px] shrink-0" />
        <span className={`text-label-lg font-bold truncate ${accent}`}>{username}</span>
      </div>
      {won && (
        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-electric-yellow/15 text-electric-yellow border border-electric-yellow/40">
          {winLabel}
        </span>
      )}
      <div className="flex items-center gap-1.5 text-label-sm">
        <span className="font-mono text-on-surface">{ratingAfter}</span>
        <span className={`font-mono ${delta >= 0 ? "text-tertiary" : "text-error"}`}>
          ({delta >= 0 ? "+" : ""}
          {delta})
        </span>
      </div>
    </div>
  );
}

function parseKo(entry: string): {
  attackerSide: "a" | "b";
  attackerName: string;
  faintedSide: "a" | "b";
  faintedName: string;
} | null {
  const [attacker, fainted] = entry.split(">");
  if (!attacker || !fainted) return null;
  const ai = attacker.indexOf(":");
  const fi = fainted.indexOf(":");
  if (ai < 0 || fi < 0) return null;
  const attackerSide = attacker.slice(0, ai);
  const faintedSide = fainted.slice(0, fi);
  if (
    (attackerSide !== "a" && attackerSide !== "b") ||
    (faintedSide !== "a" && faintedSide !== "b")
  ) {
    return null;
  }
  return {
    attackerSide,
    attackerName: attacker.slice(ai + 1),
    faintedSide,
    faintedName: fainted.slice(fi + 1),
  };
}
