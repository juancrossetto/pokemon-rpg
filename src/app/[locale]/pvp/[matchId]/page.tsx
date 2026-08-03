import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FlagIcon } from "@/components/flag-icon";
import { SubmitButton } from "@/components/submit-button";
import { startPvpRematch } from "@/actions/start-pvp-battle";
import { formatMoveName } from "@/lib/format-move-name";
import { parseTeamSnap, type PvpTeamMemberSnap } from "@/lib/pvp/team";
import { tierAccentClass, tierForRating } from "@/lib/pvp/tiers";

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

  const challengerTeam = parseTeamSnap(match.challengerTeam);
  const opponentTeam = parseTeamSnap(match.opponentTeam);
  const fainted = faintedBySide(match.koLog);

  const byName = new Map<string, PvpTeamMemberSnap>();
  for (const m of challengerTeam) byName.set(m.name.toLowerCase(), m);
  for (const m of opponentTeam) {
    if (!byName.has(m.name.toLowerCase())) byName.set(m.name.toLowerCase(), m);
  }

  const tLog = (key: string, values?: Record<string, string | number>) =>
    tBattle(`log.${key}`, values);

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

        {(challengerTeam.length > 0 || opponentTeam.length > 0) && (
          <section className="mb-4">
            <h2 className="text-headline-md text-on-surface mb-3">{t("teamsTitle")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TeamPanel
                username={match.challenger.username}
                accent="text-tertiary"
                ring="ring-tertiary/30"
                team={challengerTeam}
                faintedNames={fainted.a}
                emptyLabel={t("teamUnknown")}
                levelLabel={(n) => t("levelShort", { level: n })}
                faintedLabel={t("fainted")}
              />
              <TeamPanel
                username={match.opponent.username}
                accent="text-electric-yellow"
                ring="ring-electric-yellow/30"
                team={opponentTeam}
                faintedNames={fainted.b}
                emptyLabel={t("teamUnknown")}
                levelLabel={(n) => t("levelShort", { level: n })}
                faintedLabel={t("fainted")}
              />
            </div>
          </section>
        )}

        {iAmInMatch && settled && (
          <form action={startPvpRematch.bind(null, locale, foeId)} className="mb-4">
            <SubmitButton
              label={t("rematch")}
              pendingLabel={t("starting")}
              className="w-full ui-btn-primary px-4 py-2.5 text-label-md font-bold"
            />
          </form>
        )}

        <h2 className="text-headline-md text-on-surface mb-2">{t("battleLog")}</h2>
        {match.koLog.length === 0 ? (
          <p className="text-label-md text-on-surface-variant mb-4">{t("noKos")}</p>
        ) : (
          <ol className="flex flex-col gap-1.5 mb-4">
            {match.koLog.map((entry, i) => {
              const parsed = parseKo(entry);
              if (!parsed) return null;
              const attackerIsChallenger = parsed.attackerSide === "a";
              const attacker = byName.get(parsed.attackerName.toLowerCase());
              const faintedMon = byName.get(parsed.faintedName.toLowerCase());
              return (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-glass-surface px-3 py-2 text-label-md"
                >
                  {attacker?.spriteUrl ? (
                    <Sprite src={attacker.spriteUrl} alt={parsed.attackerName} fainted={false} />
                  ) : (
                    <span className="material-symbols-outlined text-[16px]! text-pokeball-red shrink-0">
                      swords
                    </span>
                  )}
                  <span
                    className={`capitalize ${attackerIsChallenger ? "text-tertiary" : "text-electric-yellow"}`}
                  >
                    {parsed.attackerName}
                  </span>
                  <span className="text-on-surface-variant">
                    {t("defeated", { owner: sideName(parsed.attackerSide) })}
                  </span>
                  {faintedMon?.spriteUrl && (
                    <Sprite src={faintedMon.spriteUrl} alt={parsed.faintedName} fainted />
                  )}
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
          <ol className="flex flex-col gap-1 max-h-96 overflow-y-auto mb-3 rounded-xl border border-white/10 bg-black/25 p-2">
            {match.turnLog.map((line, i) => {
              const side = sideForLine(line, challengerTeam, opponentTeam);
              return (
                <li
                  key={i}
                  className={`rounded-md px-3 py-1.5 text-label-sm border border-white/5 ${
                    side === "a"
                      ? "bg-tertiary/8 text-on-surface"
                      : side === "b"
                        ? "bg-electric-yellow/8 text-on-surface"
                        : "bg-white/3 text-on-surface-variant"
                  }`}
                >
                  {formatTurnLine(line, tLog)}
                </li>
              );
            })}
          </ol>
        )}

        <p className="text-label-sm text-on-surface-variant mt-3">
          {t("turnsPlayed", { count: match.turns })}
        </p>
      </div>
    </div>
  );
}

function TeamPanel({
  username,
  accent,
  ring,
  team,
  faintedNames,
  emptyLabel,
  levelLabel,
  faintedLabel,
}: {
  username: string;
  accent: string;
  ring: string;
  team: PvpTeamMemberSnap[];
  faintedNames: Set<string>;
  emptyLabel: string;
  levelLabel: (n: number) => string;
  faintedLabel: string;
}) {
  return (
    <div className={`rounded-xl border border-white/10 bg-glass-surface p-3 ring-1 ${ring}`}>
      <div className={`text-label-md font-bold truncate mb-2 ${accent}`}>{username}</div>
      {team.length === 0 ? (
        <p className="text-label-sm text-on-surface-variant">{emptyLabel}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {team.map((mon) => {
            const isFainted = faintedNames.has(mon.name.toLowerCase());
            return (
              <li
                key={mon.instanceId}
                className={`flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-2 ${
                  isFainted
                    ? "border-white/5 bg-black/30 opacity-55"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <Sprite src={mon.spriteUrl} alt={mon.name} fainted={isFainted} size={48} />
                <span className="text-[11px] font-semibold text-on-surface capitalize truncate max-w-full">
                  {mon.name}
                </span>
                <span className="text-[10px] text-on-surface-variant">
                  {levelLabel(mon.level)}
                </span>
                {isFainted && (
                  <span className="text-[9px] uppercase tracking-wide text-error">{faintedLabel}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Sprite({
  src,
  alt,
  fainted,
  size = 28,
}: {
  src: string;
  alt: string;
  fainted: boolean;
  size?: number;
}) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`shrink-0 object-contain ${fainted ? "grayscale" : ""}`}
      unoptimized
    />
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

function faintedBySide(koLog: string[]): { a: Set<string>; b: Set<string> } {
  const a = new Set<string>();
  const b = new Set<string>();
  for (const entry of koLog) {
    const parsed = parseKo(entry);
    if (!parsed) continue;
    if (parsed.faintedSide === "a") a.add(parsed.faintedName.toLowerCase());
    else b.add(parsed.faintedName.toLowerCase());
  }
  return { a, b };
}

function nameSet(team: PvpTeamMemberSnap[]): Set<string> {
  return new Set(team.map((m) => m.name.toLowerCase()));
}

/** Colorea la línea según el dueño del Pokémon mencionado. */
function sideForLine(
  line: string,
  challengerTeam: PvpTeamMemberSnap[],
  opponentTeam: PvpTeamMemberSnap[],
): "a" | "b" | null {
  const aNames = nameSet(challengerTeam);
  const bNames = nameSet(opponentTeam);
  const name = extractPrimaryName(line);
  if (!name) return null;
  const key = name.toLowerCase();
  if (aNames.has(key)) return "a";
  if (bNames.has(key)) return "b";
  return null;
}

function extractPrimaryName(line: string): string | null {
  const prefixes = [
    "used:",
    "damage:",
    "miss:",
    "residual:",
    "paralyzed:",
    "asleep:",
    "frozen:",
    "flinch:",
    "disobey:",
    "woke:",
    "thawed:",
    "status:",
    "fainted:",
    "sendOut:",
    "switchIn:",
    "switchForced:",
  ];
  for (const p of prefixes) {
    if (!line.startsWith(p)) continue;
    const rest = line.slice(p.length);
    const i = rest.indexOf(":");
    return i >= 0 ? rest.slice(0, i) : rest;
  }
  return null;
}

function formatTurnLine(
  raw: string,
  tLog: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (raw.startsWith("sendOut:")) return tLog("sendOut", { name: raw.slice("sendOut:".length) });
  if (raw.startsWith("switchIn:")) return tLog("switchIn", { name: raw.slice("switchIn:".length) });
  if (raw.startsWith("switchForced:")) {
    return tLog("switchForced", { name: raw.slice("switchForced:".length) });
  }
  if (raw.startsWith("paralyzed:")) return tLog("paralyzed", { name: raw.slice("paralyzed:".length) });
  if (raw.startsWith("asleep:")) return tLog("asleep", { name: raw.slice("asleep:".length) });
  if (raw.startsWith("frozen:")) return tLog("frozen", { name: raw.slice("frozen:".length) });
  if (raw.startsWith("flinch:")) return tLog("flinch", { name: raw.slice("flinch:".length) });
  if (raw.startsWith("disobey:")) return tLog("disobey", { name: raw.slice("disobey:".length) });
  if (raw.startsWith("woke:")) return tLog("woke", { name: raw.slice("woke:".length) });
  if (raw.startsWith("thawed:")) return tLog("thawed", { name: raw.slice("thawed:".length) });
  if (raw.startsWith("fainted:")) return tLog("fainted", { name: raw.slice("fainted:".length) });
  if (raw === "nothing") return tLog("nothingHappened");
  if (raw.startsWith("heal:")) {
    const [name, amount] = raw.slice("heal:".length).split(":");
    return tLog("healed", { name: name ?? "", amount: Number(amount) || 0 });
  }
  if (raw.startsWith("recoil:")) {
    const [name, dmg] = raw.slice("recoil:".length).split(":");
    return tLog("recoil", { name: name ?? "", damage: Number(dmg) || 0 });
  }
  if (raw.startsWith("residual:")) {
    const rest = raw.slice("residual:".length);
    const [name, dmg, kind] = rest.split(":");
    if (kind === "burn") return tLog("residualBurn", { name: name ?? "", damage: Number(dmg) || 0 });
    if (kind === "poison") {
      return tLog("residualPoison", { name: name ?? "", damage: Number(dmg) || 0 });
    }
    return tLog("residual", { name: name ?? "", damage: Number(dmg) || 0 });
  }
  if (raw.startsWith("used:")) {
    const rest = raw.slice("used:".length);
    const i = rest.indexOf(":");
    if (i < 0) return raw;
    return tLog("used", {
      name: rest.slice(0, i),
      move: formatMoveName(rest.slice(i + 1)),
    });
  }
  if (raw.startsWith("damage:")) {
    const rest = raw.slice("damage:".length);
    const i = rest.indexOf(":");
    if (i < 0) return raw;
    return tLog("damage", { name: rest.slice(0, i), damage: Number(rest.slice(i + 1)) || 0 });
  }
  if (raw.startsWith("miss:")) {
    const rest = raw.slice("miss:".length);
    const i = rest.indexOf(":");
    if (i < 0) return raw;
    return tLog("miss", {
      name: rest.slice(0, i),
      move: formatMoveName(rest.slice(i + 1)),
    });
  }
  if (raw.startsWith("status:")) {
    const rest = raw.slice("status:".length);
    const i = rest.indexOf(":");
    if (i < 0) return raw;
    return tLog("statusApplied", {
      name: rest.slice(0, i),
      status: rest.slice(i + 1).toLowerCase(),
    });
  }
  return raw;
}
