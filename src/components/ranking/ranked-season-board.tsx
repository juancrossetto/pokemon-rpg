import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { FlagIcon } from "@/components/flag-icon";
import { PvpSeasonCountdown } from "@/components/pvp/pvp-season-countdown";
import { TrainerAvatar } from "@/components/trainer-avatar";
import { avatarById } from "@/lib/avatars";
import { RANKING_PAGE_SIZE, rankingHref, type RankedSeasonBoardData } from "@/lib/ranking";
import {
  divisionRoman,
  tierBadgeSrc,
  tierGlowColor,
  type PvpTier,
} from "@/lib/pvp/tiers";

type Labels = {
  eyebrow: string;
  seasonLabel: string;
  endsLabel: string;
  live: string;
  liveStatus: string;
  yourStanding: string;
  unrankedTitle: string;
  unrankedBody: string;
  playRanked: string;
  position: string;
  trainer: string;
  league: string;
  record: string;
  rating: string;
  winsShort: string;
  lossesShort: string;
  you: string;
  emptyTitle: string;
  emptyBody: string;
  championsEyebrow: string;
  championsTitle: string;
  championsEmpty: string;
  prev: string;
  next: string;
  pageOf: (page: number, total: number) => string;
};

export function RankedSeasonBoard({
  data,
  page,
  endsAtIso,
  tierLabels,
  labels,
}: {
  data: RankedSeasonBoardData;
  page: number;
  endsAtIso: string;
  tierLabels: Record<PvpTier, string>;
  labels: Labels;
}) {
  const totalPages = Math.max(1, Math.ceil(data.entries.length / RANKING_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * RANKING_PAGE_SIZE;
  const entries = data.entries.slice(start, start + RANKING_PAGE_SIZE);
  const me = data.currentPlayer;

  return (
    <div className="space-y-3 md:space-y-4">
      <section className="relative overflow-hidden rounded-[24px] border border-fuchsia-300/20 bg-[#111018] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:px-5 md:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-fuchsia-500/12 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 left-[22%] h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-fuchsia-200/80">
                {labels.eyebrow}
              </p>
            </div>
            <h2 className="mt-1.5 text-xl font-black text-white md:text-2xl">
              {labels.seasonLabel}
            </h2>
          </div>
          <div className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-right">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/35">
              {labels.endsLabel}
            </p>
            <PvpSeasonCountdown endsAtIso={endsAtIso} />
          </div>
        </div>

        {me ? (
          <div className="relative mt-4 grid items-center gap-3 border-t border-white/8 pt-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-5">
            <div className="flex min-w-0 items-center gap-3">
              <TrainerAvatar
                name={me.playerName}
                src={avatarById(me.avatarId ?? null)?.src ?? null}
                size="md"
                framed={false}
              />
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/38">
                  {labels.yourStanding}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="truncate text-base font-bold text-white">{me.playerName}</p>
                  {me.countryCode ? <FlagIcon code={me.countryCode} className="h-3 w-auto rounded-[2px] opacity-75" /> : null}
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-white/45">
                  {me.wins}{labels.winsShort} · {me.losses}{labels.lossesShort} · {me.winRate}%
                </p>
              </div>
            </div>
            <RankBadge tier={me.tier} division={me.division} label={tierLabels[me.tier]} />
            <div className="flex items-end justify-between border-t border-white/8 pt-3 sm:block sm:border-t-0 sm:border-l sm:py-1 sm:pl-5 sm:text-right">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
                {labels.position}
              </p>
              <p className="font-mono text-xl font-black text-white">#{me.position}</p>
            </div>
          </div>
        ) : (
          <div className="relative mt-4 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-white">{labels.unrankedTitle}</p>
              <p className="mt-1 text-xs leading-5 text-white/45">{labels.unrankedBody}</p>
            </div>
            <Link href="/pvp" className="game-cta game-cta--primary min-h-10 shrink-0 px-5 sm:w-auto">
              <span className="game-cta__label">{labels.playRanked}</span>
            </Link>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-white/10 bg-surface-container-low">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
          <div>
            <p className="text-sm font-bold text-white">{labels.live}</p>
            <p className="mt-0.5 text-[10px] text-white/35">{labels.seasonLabel}</p>
          </div>
          <span className="rounded-full border border-emerald-300/15 bg-emerald-300/8 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-emerald-300">
            {labels.liveStatus}
          </span>
        </div>

        {entries.length ? (
          <>
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_4rem] items-center border-b border-white/8 px-3 py-2 text-[8px] font-black uppercase tracking-[0.12em] text-white/28 sm:grid-cols-[3.5rem_minmax(0,1fr)_11rem_8rem_6rem] sm:px-5">
              <span>{labels.position}</span>
              <span>{labels.trainer}</span>
              <span className="hidden sm:block">{labels.league}</span>
              <span className="hidden text-center sm:block">{labels.record}</span>
              <span className="text-right">{labels.rating}</span>
            </div>
            <ol className="divide-y divide-white/7">
              {entries.map((entry) => (
                <li
                  key={entry.playerId}
                  className={`grid grid-cols-[2.5rem_minmax(0,1fr)_4rem] items-center px-3 py-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_11rem_8rem_6rem] sm:px-5 ${entry.isCurrentPlayer ? "bg-fuchsia-400/[0.07]" : "hover:bg-white/[0.025]"}`}
                >
                  <span className={`font-mono text-sm font-black ${entry.position <= 3 ? "text-amber-300" : "text-white/38"}`}>
                    #{entry.position}
                  </span>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <TrainerAvatar
                      name={entry.playerName}
                      src={avatarById(entry.avatarId ?? null)?.src ?? null}
                      size="xs"
                      framed={false}
                    />
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-white sm:text-sm">
                        <span className="truncate">{entry.playerName}</span>
                        {entry.countryCode ? <FlagIcon code={entry.countryCode} className="h-2.5 w-auto shrink-0 rounded-[1px] opacity-65" /> : null}
                        {entry.isCurrentPlayer ? <span className="shrink-0 text-[8px] font-black uppercase text-fuchsia-300">{labels.you}</span> : null}
                      </p>
                      <p className="mt-0.5 truncate text-[9px] text-white/38 sm:hidden">
                        {tierLabels[entry.tier]} {divisionRoman(entry.division)} · {entry.wins}{labels.winsShort} {entry.losses}{labels.lossesShort}
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <RankBadge tier={entry.tier} division={entry.division} label={tierLabels[entry.tier]} compact />
                  </div>
                  <p className="hidden text-center font-mono text-[11px] font-bold text-white/50 sm:block">
                    {entry.wins}{labels.winsShort} · {entry.losses}{labels.lossesShort}
                    <span className="ml-1 text-white/28">{entry.winRate}%</span>
                  </p>
                  <p className="text-right font-mono text-sm font-black text-fuchsia-200">{entry.rating}</p>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div className="px-5 py-10 text-center">
            <span className="material-symbols-outlined text-[30px]! text-white/25">swords</span>
            <p className="mt-2 font-bold text-white">{labels.emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-white/42">{labels.emptyBody}</p>
            <Link href="/pvp" className="game-cta game-cta--primary mx-auto mt-4 min-h-10 max-w-xs">
              <span className="game-cta__label">{labels.playRanked}</span>
            </Link>
          </div>
        )}
      </section>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-3 py-1">
          {currentPage > 1 ? <Link href={rankingHref("ranked", "global", undefined, currentPage - 1)} className="min-h-10 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 hover:text-white">{labels.prev}</Link> : <span className="px-3 py-2 text-xs text-white/25">{labels.prev}</span>}
          <span className="text-xs text-white/40">{labels.pageOf(currentPage, totalPages)}</span>
          {currentPage < totalPages ? <Link href={rankingHref("ranked", "global", undefined, currentPage + 1)} className="min-h-10 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 hover:text-white">{labels.next}</Link> : <span className="px-3 py-2 text-xs text-white/25">{labels.next}</span>}
        </nav>
      ) : null}

      <section className="rounded-[22px] border border-white/10 bg-surface-container-low px-4 py-4 sm:px-5">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300/75">{labels.championsEyebrow}</p>
        <h3 className="mt-1 text-lg font-bold text-white">{labels.championsTitle}</h3>
        {data.champions.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.champions.map((champion) => (
              <div key={champion.seasonKey} className="flex items-center gap-3 border-t border-white/8 py-3 sm:border sm:border-white/8 sm:px-3">
                <TrainerAvatar name={champion.playerName} src={avatarById(champion.avatarId ?? null)?.src ?? null} size="xs" framed={false} />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/30">{champion.seasonKey}</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-white">{champion.playerName}</p>
                </div>
                <div className="text-right">
                  <Image src={tierBadgeSrc(champion.tier)} alt="" width={30} height={30} className="ml-auto h-7 w-7 object-contain" />
                  <p className="font-mono text-[10px] font-black text-amber-200">{champion.rating}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-xs text-white/38">{labels.championsEmpty}</p>}
      </section>
    </div>
  );
}

function RankBadge({
  tier,
  division,
  label,
  compact = false,
}: {
  tier: PvpTier;
  division: 1 | 2 | 3;
  label: string;
  compact?: boolean;
}) {
  const glow = tierGlowColor(tier);
  return (
    <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
      <Image
        src={tierBadgeSrc(tier)}
        alt=""
        width={compact ? 34 : 48}
        height={compact ? 34 : 48}
        className={`${compact ? "h-8 w-8" : "h-11 w-11"} shrink-0 object-contain`}
        style={{ filter: `drop-shadow(0 0 9px ${glow}55)` }}
      />
      <div className="min-w-0">
        <p className={`${compact ? "text-[11px]" : "text-xs"} truncate font-bold text-white`}>{label}</p>
        <p className="mt-0.5 font-mono text-[9px] font-black" style={{ color: glow }}>
          {divisionRoman(division)}
        </p>
      </div>
    </div>
  );
}
