import { Link } from "@/i18n/navigation";
import { HandbookLink } from "@/components/handbook/handbook-trigger";
import { PvpTeamEditor, type PvpTeamCandidate } from "@/components/pvp-team-editor";
import { PvpSeasonCountdown } from "@/components/pvp/pvp-season-countdown";
import { PvpRankBadge } from "@/components/pvp/pvp-rank-badge";
import {
  PvpRivalsHistory,
  type PvpHubMatchCard,
} from "@/components/pvp/pvp-rivals-history";
import { PvpModesPanel } from "@/components/pvp/pvp-modes-panel";
import { PvpHubProgressFill } from "@/components/pvp/pvp-hub-progress-fill";
import { PvpRankUpHost } from "@/components/pvp/pvp-rank-up-host";
import { PvpErrorNotice } from "@/components/pvp/pvp-error-notice";
import { type PvpDivision, type PvpTier } from "@/lib/pvp/tiers";
import type { SeasonTrackNode } from "@/lib/pvp/hub";
import type { RewardBundle } from "@/lib/events/rewards";

export type { PvpHubMatchCard };

type Props = {
  locale: string;
  labels: {
    eyebrow: string;
    title: string;
    rating: string;
    viewLadder: string;
    seasonLabel: string;
    winRate: string;
    streak: string;
    rankLabel: string;
    rankUnranked: string;
    modesTitle: string;
    modeRanked: string;
    modeQuick: string;
    modeChallenge: string;
    rankedBlurb: string;
    quickBlurb: string;
    challengeBlurb: string;
    rankedLabel: string;
    quickLabel: string;
    searching: string;
    starting: string;
    energyCost: string;
    energyCostShort: string;
    difficultyEasy: string;
    difficultyNormal: string;
    difficultyHard: string;
    rewardCoinsHint: string;
    emptyHistory: string;
    win: string;
    loss: string;
    forfeit: string;
    rematch: string;
    seasonTrackTitle: string;
    seasonTrackHint: string;
    rivalsTitle: string;
    missionTitle: string;
    missionNextTier: string;
    missionWins: string;
    vsShort: string;
    you: string;
    lastRival: string;
    winsLabel: string;
    lossesLabel: string;
    viewMatch: string;
    fainted: string;
    levelShort: string;
    teamUnknown: string;
    paginationPrev: string;
    paginationNext: string;
    paginationPageOf: string;
    errorDismiss: string;
    tiers: Record<PvpTier, string>;
  };
  error: string | null;
  /** Ms de cooldown PvP a mostrar en el popup (error=cooldown). */
  cooldownMsLeft?: number;
  rating: number;
  tier: PvpTier;
  division: PvpDivision;
  standingLabel: string;
  wins: number;
  losses: number;
  winPct: number;
  streak: number;
  ladderRank: number | null;
  energy: number;
  canFight: boolean;
  seasonEndsIso: string;
  seasonLabel: string;
  seasonTrack: SeasonTrackNode[];
  nextTierPct: number;
  nextTierLabel: string | null;
  candidates: PvpTeamCandidate[];
  matches: PvpHubMatchCard[];
  page: number;
  totalPages: number;
};

const REWARD_ICON: Record<"coins" | "gems" | "energy", string> = {
  coins: "/items/hd/gold-coin.png",
  gems: "/items/hd/gem.png",
  energy: "/items/hd/energy.png",
};

const SEASON_REWARD_SLOTS = ["coins", "energy", "gems"] as const;

function SeasonRewardRow({ bundle }: { bundle: RewardBundle }) {
  const rows = SEASON_REWARD_SLOTS.map((kind) => {
    const hit = bundle.find((r) => r.kind === kind);
    return hit && hit.kind !== "item" ? { kind, amount: hit.amount } : null;
  }).filter((r): r is { kind: (typeof SEASON_REWARD_SLOTS)[number]; amount: number } => r != null);

  return (
    <ul className="flex h-4 w-full flex-nowrap items-center justify-center gap-1 overflow-hidden">
      {rows.map((r) => (
        <li key={r.kind} className="flex shrink-0 items-center gap-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={REWARD_ICON[r.kind]} alt="" className="h-3 w-3 object-contain" />
          <span className="font-mono text-[9px] font-semibold tabular-nums text-white/70">
            {r.amount}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PvpArenaHub({
  locale,
  labels: L,
  error,
  cooldownMsLeft = 0,
  rating,
  tier,
  division,
  standingLabel,
  wins,
  losses,
  winPct,
  streak,
  ladderRank,
  canFight,
  seasonEndsIso,
  seasonLabel,
  seasonTrack,
  nextTierPct,
  nextTierLabel,
  candidates,
  matches,
  page,
  totalPages,
}: Props) {
  const rivalsLabels = {
    rivalsTitle: L.rivalsTitle,
    emptyHistory: L.emptyHistory,
    win: L.win,
    loss: L.loss,
    forfeit: L.forfeit,
    rematch: L.rematch,
    starting: L.starting,
    modeRanked: L.modeRanked,
    modeQuick: L.modeQuick,
    vsShort: L.vsShort,
    you: L.you,
    lastRival: L.lastRival,
    viewMatch: L.viewMatch,
    fainted: L.fainted,
    levelShort: L.levelShort,
    teamUnknown: L.teamUnknown,
    paginationPrev: L.paginationPrev,
    paginationNext: L.paginationNext,
    paginationPageOf: L.paginationPageOf,
  };

  return (
    <div className="pvp-arena relative isolate flex-1 overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,color-mix(in_srgb,var(--color-electric-yellow)_16%,transparent),transparent_45%),radial-gradient(ellipse_at_90%_10%,color-mix(in_srgb,var(--color-pokeball-red)_12%,transparent),transparent_40%)]"
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-3 py-3 pb-6 sm:px-margin-desktop sm:py-6 sm:pb-8">
        <PvpRankUpHost />
        <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
          <div className="min-w-0">
            <p className="mb-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em]">
              <span aria-hidden className="pvp-arena-dot h-1.5 w-1.5 rounded-full" />
              <span className="pvp-arena-accent-text">{L.eyebrow}</span>
            </p>
            <h1 className="page-title text-[clamp(1.45rem,5vw,2.4rem)] font-semibold leading-none tracking-tight text-white">
              {L.title}
            </h1>
          </div>
          <HandbookLink chapter="pvp" />
        </div>

        {error ? (
          <PvpErrorNotice
            message={error}
            dismissLabel={L.errorDismiss}
            cooldownMsLeft={cooldownMsLeft}
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.95fr)] lg:gap-5 lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Mobile: modos primero (ranked | quick + challenge). */}
            <div className="lg:hidden">
              <PvpModesPanel
                locale={locale}
                title={L.modesTitle}
                rankedLabel={L.rankedLabel}
                quickLabel={L.quickLabel}
                starting={L.starting}
                searching={L.searching}
                canFight={canFight}
              />
            </div>

            <section className="pvp-hero game-float-card relative overflow-visible rounded-2xl">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_0%_0%,color-mix(in_srgb,var(--color-electric-yellow)_12%,transparent),transparent_50%)]"
              />

              <div className="relative flex flex-col gap-5 p-4 sm:p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    {L.rating}
                  </p>
                  <Link
                    href="/ranking?view=ladder"
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45 transition hover:text-white"
                  >
                    <span className="material-symbols-outlined text-[14px]!">leaderboard</span>
                    {L.viewLadder}
                  </Link>
                </div>

                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="min-w-0 flex-1 overflow-visible">
                    <p className="page-title pvp-rating-num pt-1 text-[clamp(3.5rem,12vw,5.25rem)] leading-[1.05] tracking-wide">
                      {rating}
                    </p>
                    <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
                      {standingLabel}
                    </p>
                  </div>
                  <PvpRankBadge
                    tier={tier}
                    division={division}
                    label={L.tiers[tier]}
                    size="md"
                    className="shrink-0 drop-shadow-[0_0_18px_color-mix(in_srgb,var(--color-electric-yellow)_28%,transparent)]"
                  />
                </div>

                <div className="grid grid-cols-5 gap-1 border-y border-white/8 py-3 sm:gap-2">
                  <Kpi label={L.rankLabel} value={ladderRank != null ? `#${ladderRank}` : L.rankUnranked} />
                  <Kpi label={L.streak} value={String(streak)} hot={streak >= 3} />
                  <Kpi label={L.winRate} value={`${winPct}%`} />
                  <Kpi label={L.winsLabel} value={String(wins)} />
                  <Kpi label={L.lossesLabel} value={String(losses)} />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                    <span>{seasonLabel}</span>
                    <span className="text-white/15">·</span>
                    <PvpSeasonCountdown endsAtIso={seasonEndsIso} />
                  </div>
                  {nextTierLabel ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs sm:items-end">
                      <div className="flex w-full justify-between gap-2 text-[10px] text-white/40">
                        <span>{L.missionNextTier}</span>
                        <span className="font-mono text-white/70">
                          {nextTierPct}% · {nextTierLabel}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <PvpHubProgressFill pct={nextTierPct} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            {/* `pvp-mode-card` escalona la entrada por posición (nth-child): el
                hero ya traía la suya (`.pvp-hero`) y el resto de las cards
                aparecía seco, todas en el mismo frame. */}
            <section className="pvp-mode-card game-float-card rounded-2xl p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    {L.seasonTrackTitle}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/40">{L.seasonTrackHint}</p>
                </div>
                {nextTierLabel ? (
                  <span className="shrink-0 font-mono text-[11px] text-white/55">
                    {nextTierPct}% → {nextTierLabel}
                  </span>
                ) : null}
              </div>
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <PvpHubProgressFill
                  pct={nextTierPct}
                  className="pvp-arena-bar h-full rounded-full"
                />
              </div>
              <div className="no-scrollbar -mx-1 flex items-start justify-between gap-1 overflow-x-auto px-1 pb-1 sm:gap-2">
                {seasonTrack.map((node) => {
                  const locked = node.state === "locked";
                  const current = node.state === "current";
                  return (
                    <div
                      key={node.tier}
                      className={`flex min-w-[3.9rem] flex-1 flex-col items-center gap-1.5 sm:min-w-[4.5rem] ${
                        locked ? "opacity-40" : ""
                      }`}
                    >
                      <div
                        className={`relative flex h-16 w-16 shrink-0 items-center justify-center sm:h-[4.25rem] sm:w-[4.25rem] ${
                          locked ? "grayscale" : ""
                        }`}
                      >
                        {locked ? (
                          <span className="absolute z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white/70">
                            <span className="material-symbols-outlined text-[14px]!">lock</span>
                          </span>
                        ) : null}
                        <PvpRankBadge
                          tier={node.tier}
                          label={L.tiers[node.tier]}
                          size="md"
                          className={current ? "scale-105 drop-shadow-[0_0_10px_rgba(46,184,255,0.45)]" : ""}
                        />
                      </div>
                      <p
                        className={`h-4 w-full truncate text-center text-[9px] font-bold uppercase leading-4 tracking-wide ${
                          current ? "pvp-arena-accent-text" : "text-white/65"
                        }`}
                        title={L.tiers[node.tier]}
                      >
                        {L.tiers[node.tier]}
                      </p>
                      <SeasonRewardRow bundle={node.rewards} />
                    </div>
                  );
                })}
              </div>
            </section>

            <PvpTeamEditor locale={locale} candidates={candidates} />

            <div className="lg:hidden">
              <PvpRivalsHistory
                locale={locale}
                labels={rivalsLabels}
                matches={matches}
                canFight={canFight}
                page={page}
                totalPages={totalPages}
              />
            </div>
          </div>

          <aside className="hidden min-w-0 flex-col gap-4 lg:flex">
            <PvpRivalsHistory
              locale={locale}
              labels={rivalsLabels}
              matches={matches}
              canFight={canFight}
              page={page}
              totalPages={totalPages}
            />
            <PvpModesPanel
              locale={locale}
              title={L.modesTitle}
              rankedLabel={L.rankedLabel}
              quickLabel={L.quickLabel}
              starting={L.starting}
              searching={L.searching}
              canFight={canFight}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hot,
}: {
  label: string;
  value: string;
  hot?: boolean;
}) {
  return (
    <div className="min-w-0 text-center sm:text-left">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
      <p
        className={`mt-1 font-mono text-[1.05rem] font-bold tabular-nums leading-none sm:text-[1.2rem] ${
          hot ? "pvp-arena-accent-text" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
