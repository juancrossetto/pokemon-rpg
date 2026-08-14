import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { FlagIcon } from "@/components/flag-icon";
import { RankingEmptyState } from "@/components/ranking/ranking-empty-state";
import { TrainerAvatar } from "@/components/trainer-avatar";
import { avatarById } from "@/lib/avatars";
import { spriteFor } from "@/lib/shiny";
import {
  divisionRoman,
  rankForRating,
  tierBadgeSrc,
  tierGlowColor,
  type PvpTier,
} from "@/lib/pvp/tiers";
import {
  RANKING_PAGE_SIZE,
  rankingHref,
  type RankingCategory,
  type RankingEntry,
  type RankingScope,
} from "@/lib/ranking";

type BoardCategory = "combat_power" | "pvp";

type BoardLabels = {
  you: string;
  yourTitle: string;
  listTitle: string;
  scopeLabel?: string;
  emptyTitle: string;
  emptyBody?: string;
  emptyCta?: string;
  emptyCtaHref?: string;
  emptyIcon: string;
  prev: string;
  next: string;
  pageOf: (page: number, total: number) => string;
  metricLabel: string;
  position: string;
  trainer: string;
  team: string;
  league: string;
  record: string;
  medals: string;
  winsShort: string;
  lossesShort: string;
};

export function RankingBoardView({
  category,
  scope,
  countryCode,
  page,
  entries,
  labels,
  formatPrimary,
  formatSecondary,
  tierLabels,
  empty,
}: {
  category: BoardCategory;
  scope: RankingScope;
  countryCode?: string;
  page: number;
  entries: RankingEntry[];
  labels: BoardLabels;
  formatPrimary: (entry: RankingEntry) => string;
  formatSecondary?: (entry: RankingEntry) => string | undefined;
  tierLabels?: Record<PvpTier, string>;
  empty?: boolean;
}) {
  if (empty || entries.length === 0) {
    return (
      <RankingEmptyState
        icon={labels.emptyIcon}
        title={labels.emptyTitle}
        body={labels.emptyBody}
        ctaHref={labels.emptyCtaHref}
        ctaLabel={labels.emptyCta}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(entries.length / RANKING_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * RANKING_PAGE_SIZE;
  const pageRows = entries.slice(start, start + RANKING_PAGE_SIZE);
  const me = entries.find((entry) => entry.isCurrentPlayer) ?? null;

  return (
    <div className="space-y-3 md:space-y-4">
      {me ? (
        <CurrentStanding
          category={category}
          entry={me}
          labels={labels}
          primaryMetric={formatPrimary(me)}
          tierLabels={tierLabels}
        />
      ) : null}

      <section className="overflow-hidden rounded-[22px] border border-white/10 bg-surface-container-low">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
          <div>
            <p className="text-sm font-bold text-white">{labels.listTitle}</p>
            {labels.scopeLabel ? <p className="mt-0.5 text-[10px] text-white/35">{labels.scopeLabel}</p> : null}
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] ${category === "pvp" ? "border-fuchsia-300/15 bg-fuchsia-300/8 text-fuchsia-200" : "border-cyan-300/15 bg-cyan-300/8 text-cyan-200"}`}>
            {labels.metricLabel}
          </span>
        </div>

        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] items-center border-b border-white/8 px-3 py-2 text-[8px] font-black uppercase tracking-[0.12em] text-white/28 sm:grid-cols-[3.5rem_minmax(0,1fr)_12rem_7rem_6rem] sm:px-5">
          <span>{labels.position}</span>
          <span>{labels.trainer}</span>
          <span className="hidden sm:block">{category === "pvp" ? labels.league : labels.team}</span>
          <span className="hidden text-center sm:block">{category === "pvp" ? labels.record : labels.medals}</span>
          <span className="text-right">{labels.metricLabel}</span>
        </div>

        <ol className="divide-y divide-white/7">
          {pageRows.map((entry) => (
            <BoardRow
              key={`${entry.playerId}-${entry.position}`}
              category={category}
              entry={entry}
              labels={labels}
              primaryMetric={formatPrimary(entry)}
              secondaryMetric={formatSecondary?.(entry)}
              tierLabels={tierLabels}
            />
          ))}
        </ol>
      </section>

      <RankingPagination
        category={category}
        scope={scope}
        countryCode={countryCode}
        page={currentPage}
        totalPages={totalPages}
        prevLabel={labels.prev}
        nextLabel={labels.next}
        pageOfLabel={labels.pageOf(currentPage, totalPages)}
      />
    </div>
  );
}

function CurrentStanding({
  category,
  entry,
  labels,
  primaryMetric,
  tierLabels,
}: {
  category: BoardCategory;
  entry: RankingEntry;
  labels: BoardLabels;
  primaryMetric: string;
  tierLabels?: Record<PvpTier, string>;
}) {
  const isPvp = category === "pvp";
  const standing = rankForRating(entry.rating ?? 0);
  return (
    <section className={`relative overflow-hidden rounded-[24px] border bg-[#111018] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:px-5 md:px-6 ${isPvp ? "border-fuchsia-300/20" : "border-cyan-300/20"}`}>
      <div aria-hidden className={`pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full blur-3xl ${isPvp ? "bg-fuchsia-500/12" : "bg-cyan-500/10"}`} />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 left-[22%] h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <TrainerAvatar name={entry.playerName} src={avatarById(entry.avatarId ?? null)?.src ?? null} size="md" framed={false} />
          <div className="min-w-0">
            <p className={`text-[9px] font-black uppercase tracking-[0.16em] ${isPvp ? "text-fuchsia-200/70" : "text-cyan-200/70"}`}>{labels.yourTitle}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="truncate text-base font-bold text-white">{entry.playerName}</p>
              {entry.countryCode ? <FlagIcon code={entry.countryCode} className="h-3 w-auto rounded-[2px] opacity-75" /> : null}
            </div>
            {isPvp ? (
              <p className="mt-0.5 font-mono text-[10px] text-white/45">{entry.wins ?? 0}{labels.winsShort} · {entry.losses ?? 0}{labels.lossesShort} · {entry.winRate ?? 0}%</p>
            ) : (
              <span className="sm:hidden"><TeamSprites entry={entry} compact /></span>
            )}
          </div>
        </div>

        {isPvp ? (
          <div className="order-3 col-span-2 border-t border-white/8 pt-3 sm:order-none sm:col-span-1 sm:border-t-0 sm:pt-0">
            <LeagueBadge tier={standing.tier} division={standing.division} label={tierLabels?.[standing.tier] ?? standing.tier} />
          </div>
        ) : (
          <div className="hidden min-w-40 sm:block"><TeamSprites entry={entry} /></div>
        )}

        <div className="col-start-2 row-start-1 flex h-full min-w-[5.75rem] flex-col justify-center gap-1.5 border-l border-white/8 pl-3 sm:col-auto sm:row-auto sm:block sm:h-auto sm:min-w-0 sm:py-1 sm:pl-5 sm:text-right">
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">{labels.position}</p>
            <p className="font-mono text-xl font-black text-white">#{entry.position}</p>
          </div>
          <div className="flex items-baseline justify-between gap-2 sm:mt-2 sm:block">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/30">{labels.metricLabel}</p>
            <p className={`font-mono text-lg font-black ${isPvp ? "text-fuchsia-200" : "text-cyan-200"}`}>{primaryMetric}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function BoardRow({
  category,
  entry,
  labels,
  primaryMetric,
  secondaryMetric,
  tierLabels,
}: {
  category: BoardCategory;
  entry: RankingEntry;
  labels: BoardLabels;
  primaryMetric: string;
  secondaryMetric?: string;
  tierLabels?: Record<PvpTier, string>;
}) {
  const isPvp = category === "pvp";
  const standing = rankForRating(entry.rating ?? 0);
  return (
    <li className={`grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] items-center px-3 py-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_12rem_7rem_6rem] sm:px-5 ${entry.isCurrentPlayer ? (isPvp ? "bg-fuchsia-400/[0.07]" : "bg-cyan-400/[0.06]") : "hover:bg-white/[0.025]"}`}>
      <span className={`font-mono text-sm font-black ${entry.position <= 3 ? "text-amber-300" : "text-white/38"}`}>#{entry.position}</span>
      <div className="flex min-w-0 items-center gap-2.5">
        <TrainerAvatar name={entry.playerName} src={avatarById(entry.avatarId ?? null)?.src ?? null} size="xs" framed={false} />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-white sm:text-sm">
            <span className="truncate">{entry.playerName}</span>
            {entry.countryCode ? <FlagIcon code={entry.countryCode} className="h-2.5 w-auto shrink-0 rounded-[1px] opacity-65" /> : null}
            {entry.isCurrentPlayer ? <span className={`shrink-0 text-[8px] font-black uppercase ${isPvp ? "text-fuchsia-300" : "text-cyan-300"}`}>{labels.you}</span> : null}
          </p>
          <div className="mt-0.5 sm:hidden">
            {isPvp ? (
              <p className="truncate text-[9px] text-white/38">{tierLabels?.[standing.tier] ?? standing.tier} {divisionRoman(standing.division)} · {secondaryMetric}</p>
            ) : (
              <TeamSprites entry={entry} compact />
            )}
          </div>
        </div>
      </div>
      <div className="hidden sm:block">
        {isPvp ? <LeagueBadge tier={standing.tier} division={standing.division} label={tierLabels?.[standing.tier] ?? standing.tier} compact /> : <TeamSprites entry={entry} />}
      </div>
      <p className="hidden text-center font-mono text-[11px] font-bold text-white/50 sm:block">
        {isPvp ? secondaryMetric : String(entry.medals ?? 0)}
      </p>
      <p className={`text-right font-mono text-sm font-black ${isPvp ? "text-fuchsia-200" : "text-cyan-200"}`}>{primaryMetric}</p>
    </li>
  );
}

function TeamSprites({ entry, compact = false }: { entry: RankingEntry; compact?: boolean }) {
  const team = entry.teamSprites ?? [];
  if (!team.length) return <span className="text-[10px] text-white/25">—</span>;
  return (
    <span className={`flex items-center ${compact ? "-space-x-1" : "gap-0.5"}`} aria-label={team.map((pokemon) => pokemon.name).join(", ")}>
      {team.map((pokemon, index) => (
        <Image
          key={`${pokemon.name}-${index}`}
          src={spriteFor(pokemon.image, !!pokemon.isShiny)}
          alt=""
          width={30}
          height={30}
          title={pokemon.name}
          className={`${compact ? "h-[22px] w-[22px]" : "h-7 w-7"} object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]`}
          unoptimized
        />
      ))}
    </span>
  );
}

function LeagueBadge({ tier, division, label, compact = false }: { tier: PvpTier; division: 1 | 2 | 3; label: string; compact?: boolean }) {
  const glow = tierGlowColor(tier);
  return (
    <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
      <Image src={tierBadgeSrc(tier)} alt="" width={compact ? 34 : 48} height={compact ? 34 : 48} className={`${compact ? "h-8 w-8" : "h-11 w-11"} shrink-0 object-contain`} style={{ filter: `drop-shadow(0 0 9px ${glow}55)` }} />
      <div className="min-w-0">
        <p className={`${compact ? "text-[11px]" : "text-xs"} truncate font-bold text-white`}>{label}</p>
        <p className="mt-0.5 font-mono text-[9px] font-black" style={{ color: glow }}>{divisionRoman(division)}</p>
      </div>
    </div>
  );
}

function RankingPagination({ category, scope, countryCode, page, totalPages, prevLabel, nextLabel, pageOfLabel }: { category: RankingCategory; scope: RankingScope; countryCode?: string; page: number; totalPages: number; prevLabel: string; nextLabel: string; pageOfLabel: string }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-3 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {page > 1 ? <Link href={rankingHref(category, scope, countryCode, page - 1)} className="min-h-10 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 hover:text-white">{prevLabel}</Link> : <span className="px-3 py-2 text-xs text-white/25">{prevLabel}</span>}
      <span className="text-xs text-white/40">{pageOfLabel}</span>
      {page < totalPages ? <Link href={rankingHref(category, scope, countryCode, page + 1)} className="min-h-10 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 hover:text-white">{nextLabel}</Link> : <span className="px-3 py-2 text-xs text-white/25">{nextLabel}</span>}
    </nav>
  );
}
