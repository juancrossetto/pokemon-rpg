import { CdnImage as Image } from "@/components/cdn-image";
import { Link } from "@/i18n/navigation";
import { FlagIcon } from "@/components/flag-icon";
import { PvpRematchForm } from "@/components/pvp/pvp-rematch-form";
import { formatMoveName } from "@/lib/format-move-name";
import type { PvpTeamMemberSnap } from "@/lib/pvp/team";
import { parseKo } from "@/lib/pvp/ko-log";

export type PvpMatchReportLabels = {
  backToPvp: string;
  youWon: string;
  youLost: string;
  forfeit: string;
  active: string;
  winner: string;
  vsShort: string;
  teamsTitle: string;
  teamUnknown: string;
  levelShort: (level: number) => string;
  fainted: string;
  rematch: string;
  starting: string;
  battleLog: string;
  turnLog: string;
  turnLogShow: string;
  turnLogHide: string;
  defeated: (owner: string) => string;
  noKos: string;
  noTurnLog: string;
  turnsPlayed: string;
  modeRanked: string;
  modeQuick: string;
  coinsAwarded: (n: number) => string;
};

export type PvpMatchReportProps = {
  locale: string;
  settled: boolean;
  iAmInMatch: boolean;
  iWon: boolean;
  status: string;
  mode: "RANKED" | "QUICK" | string;
  coinsAwarded: number;
  foeId: string;
  /** Ms restantes para rematch contra este rival. */
  cooldownMsLeft?: number;
  challenger: { username: string; country: string };
  opponent: { username: string; country: string };
  challengerWon: boolean;
  challengerRatingBefore: number;
  challengerRatingAfter: number;
  opponentRatingBefore: number;
  opponentRatingAfter: number;
  challengerTeam: PvpTeamMemberSnap[];
  opponentTeam: PvpTeamMemberSnap[];
  faintedA: Set<string>;
  faintedB: Set<string>;
  koLog: string[];
  turnLog: string[];
  labels: PvpMatchReportLabels;
  formatTurnLine: (raw: string) => string;
};

/**
 * Recap post-partida PvP: resultado + scoreboard juntos → equipos densos → rematch → logs.
 */
export function PvpMatchReport({
  locale,
  settled,
  iAmInMatch,
  iWon,
  status,
  mode,
  coinsAwarded,
  foeId,
  cooldownMsLeft = 0,
  challenger,
  opponent,
  challengerWon,
  challengerRatingBefore,
  challengerRatingAfter,
  opponentRatingBefore,
  opponentRatingAfter,
  challengerTeam,
  opponentTeam,
  faintedA,
  faintedB,
  koLog,
  turnLog,
  labels,
  formatTurnLine,
}: PvpMatchReportProps) {
  const outcomeTone = !settled ? "active" : iWon ? "win" : "loss";
  const outcomeTitle = !settled
    ? labels.active
    : status === "FORFEIT" && !iWon
      ? labels.forfeit
      : iWon
        ? labels.youWon
        : labels.youLost;

  const byName = new Map<string, PvpTeamMemberSnap>();
  for (const m of challengerTeam) byName.set(m.name.toLowerCase(), m);
  for (const m of opponentTeam) {
    if (!byName.has(m.name.toLowerCase())) byName.set(m.name.toLowerCase(), m);
  }

  const sideName = (side: "a" | "b") =>
    side === "a" ? challenger.username : opponent.username;

  const showOutcomeHero = (iAmInMatch && settled) || !settled;
  const modeLabel = mode === "RANKED" ? labels.modeRanked : labels.modeQuick;

  return (
    <div className="pvp-report flex-1 px-margin-mobile py-4 md:px-margin-desktop md:py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <Link href="/pvp" className="pvp-report__back">
          <span className="material-symbols-outlined text-[16px]!">arrow_back</span>
          {labels.backToPvp}
        </Link>

        <section
          className={`pvp-report__summary pvp-report__summary--${outcomeTone}`}
          aria-label={labels.vsShort}
        >
          <div className="pvp-report__hero-glow" aria-hidden />

          {showOutcomeHero ? (
            <div className="pvp-report__summary-head">
              <div className="pvp-report__summary-meta">
                {settled ? (
                  <span className="pvp-report__eyebrow">{modeLabel}</span>
                ) : null}
                {settled && coinsAwarded > 0 ? (
                  <span className="pvp-report__coins">
                    {labels.coinsAwarded(coinsAwarded)}
                  </span>
                ) : null}
              </div>
              <h1 className="pvp-report__title page-title">{outcomeTitle}</h1>
            </div>
          ) : null}

          <div className="pvp-report__scoreboard">
            <Combatant
              username={challenger.username}
              country={challenger.country}
              won={challengerWon}
              ratingBefore={challengerRatingBefore}
              ratingAfter={challengerRatingAfter}
              winLabel={labels.winner}
              side="a"
            />
            <div className="pvp-report__vs" aria-hidden>
              <span className="pvp-report__vs-text page-title">{labels.vsShort}</span>
            </div>
            <Combatant
              username={opponent.username}
              country={opponent.country}
              won={settled && !challengerWon}
              ratingBefore={opponentRatingBefore}
              ratingAfter={opponentRatingAfter}
              winLabel={labels.winner}
              side="b"
              alignRight
            />
          </div>
        </section>

        {(challengerTeam.length > 0 || opponentTeam.length > 0) && (
          <section className="pvp-report__teams">
            <div className="pvp-report__teams-head">
              <h2 className="pvp-report__section-title">{labels.teamsTitle}</h2>
            </div>
            <div className="pvp-report__teams-grid">
              <TeamPanel
                username={challenger.username}
                side="a"
                team={challengerTeam}
                faintedNames={faintedA}
                emptyLabel={labels.teamUnknown}
                levelLabel={labels.levelShort}
                faintedLabel={labels.fainted}
              />
              <TeamPanel
                username={opponent.username}
                side="b"
                team={opponentTeam}
                faintedNames={faintedB}
                emptyLabel={labels.teamUnknown}
                levelLabel={labels.levelShort}
                faintedLabel={labels.fainted}
              />
            </div>
          </section>
        )}

        {iAmInMatch && settled ? (
          <PvpRematchForm
            locale={locale}
            foeId={foeId}
            label={labels.rematch}
            pendingLabel={labels.starting}
            cooldownMsLeft={cooldownMsLeft}
            wrapClassName="pvp-report__cta-wrap"
            className="pvp-report__cta"
          />
        ) : null}

        <section className="pvp-report__kos">
          <details className="pvp-report__log-details">
            <summary className="pvp-report__log-summary">
              <span className="pvp-report__section-title">{labels.battleLog}</span>
              <span className="pvp-report__log-hint">
                <span className="pvp-report__log-hint--closed">{labels.turnLogShow}</span>
                <span className="pvp-report__log-hint--open">{labels.turnLogHide}</span>
              </span>
            </summary>
            {koLog.length === 0 ? (
              <p className="pvp-report__empty">{labels.noKos}</p>
            ) : (
              <ol className="pvp-report__ko-list">
                {koLog.map((entry, i) => {
                  const parsed = parseKo(entry);
                  if (!parsed) return null;
                  const attackerIsChallenger = parsed.attackerSide === "a";
                  const attacker = byName.get(parsed.attackerName.toLowerCase());
                  const faintedMon = byName.get(parsed.faintedName.toLowerCase());
                  return (
                    <li key={i} className="pvp-report__ko">
                      {attacker?.spriteUrl ? (
                        <Sprite
                          src={attacker.spriteUrl}
                          alt={parsed.attackerName}
                          fainted={false}
                        />
                      ) : (
                        <span className="material-symbols-outlined pvp-report__ko-icon">
                          swords
                        </span>
                      )}
                      <span
                        className={`pvp-report__ko-name ${
                          attackerIsChallenger ? "is-a" : "is-b"
                        }`}
                      >
                        {parsed.attackerName}
                      </span>
                      <span className="pvp-report__ko-mid">
                        {labels.defeated(sideName(parsed.attackerSide))}
                      </span>
                      {faintedMon?.spriteUrl ? (
                        <Sprite
                          src={faintedMon.spriteUrl}
                          alt={parsed.faintedName}
                          fainted
                        />
                      ) : null}
                      <span className="pvp-report__ko-fainted capitalize">
                        {parsed.faintedName}
                      </span>
                      <span className="pvp-report__ko-owner">
                        ({sideName(parsed.faintedSide)})
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </details>
        </section>

        <section className="pvp-report__log">
          <details className="pvp-report__log-details">
            <summary className="pvp-report__log-summary">
              <span className="pvp-report__section-title">{labels.turnLog}</span>
              <span className="pvp-report__log-hint">
                <span className="pvp-report__log-hint--closed">{labels.turnLogShow}</span>
                <span className="pvp-report__log-hint--open">{labels.turnLogHide}</span>
              </span>
            </summary>
            {turnLog.length === 0 ? (
              <p className="pvp-report__empty">{labels.noTurnLog}</p>
            ) : (
              <ol className="pvp-report__turn-list">
                {turnLog.map((line, i) => {
                  const side = sideForLine(line, challengerTeam, opponentTeam);
                  return (
                    <li
                      key={i}
                      className={`pvp-report__turn ${
                        side === "a" ? "is-a" : side === "b" ? "is-b" : ""
                      }`}
                    >
                      {formatTurnLine(line)}
                    </li>
                  );
                })}
              </ol>
            )}
          </details>
          <p className="pvp-report__turns">{labels.turnsPlayed}</p>
        </section>
      </div>
    </div>
  );
}

function TeamPanel({
  username,
  side,
  team,
  faintedNames,
  emptyLabel,
  levelLabel,
  faintedLabel,
}: {
  username: string;
  side: "a" | "b";
  team: PvpTeamMemberSnap[];
  faintedNames: Set<string>;
  emptyLabel: string;
  levelLabel: (n: number) => string;
  faintedLabel: string;
}) {
  return (
    <div className={`pvp-report__team pvp-report__team--${side}`}>
      <div className="pvp-report__team-head">{username}</div>
      {team.length === 0 ? (
        <p className="pvp-report__empty">{emptyLabel}</p>
      ) : (
        <ul className="pvp-report__mons">
          {team.map((mon) => {
            const isFainted = faintedNames.has(mon.name.toLowerCase());
            return (
              <li
                key={mon.instanceId}
                title={
                  isFainted
                    ? `${mon.name} · ${levelLabel(mon.level)} · ${faintedLabel}`
                    : `${mon.name} · ${levelLabel(mon.level)}`
                }
                className={`pvp-report__mon ${isFainted ? "is-fainted" : ""}`}
              >
                <Sprite
                  src={mon.spriteUrl}
                  alt={mon.name}
                  fainted={isFainted}
                  size={40}
                />
                <span className="pvp-report__mon-name">{mon.name}</span>
                <span className="pvp-report__mon-lv">{levelLabel(mon.level)}</span>
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
      className={`pvp-report__sprite ${fainted ? "is-fainted" : ""}`}
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

  return (
    <div
      className={`pvp-report__fighter pvp-report__fighter--${side} ${
        alignRight ? "is-right" : ""
      } ${won ? "is-winner" : ""}`}
    >
      <div className="pvp-report__fighter-id">
        <FlagIcon code={country} className="h-3.5 w-auto rounded-[2px] shrink-0" />
        <span className="pvp-report__fighter-name">{username}</span>
        {won ? <span className="pvp-report__winner-chip">{winLabel}</span> : null}
      </div>
      <div className="pvp-report__elo">
        <span className="pvp-report__elo-value">{ratingAfter}</span>
        <span
          className={`pvp-report__elo-delta ${delta >= 0 ? "is-up" : "is-down"}`}
        >
          {delta >= 0 ? "+" : ""}
          {delta}
        </span>
      </div>
    </div>
  );
}

function nameSet(team: PvpTeamMemberSnap[]): Set<string> {
  return new Set(team.map((m) => m.name.toLowerCase()));
}

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

/** Formatea una línea cruda del turnLog con el traductor de batalla. */
export function formatPvpTurnLine(
  raw: string,
  tLog: (key: string, values?: Record<string, string | number>) => string,
  locale?: string | null,
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
      move: formatMoveName(rest.slice(i + 1), locale),
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
      move: formatMoveName(rest.slice(i + 1), locale),
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
