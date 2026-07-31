import { Link } from "@/i18n/navigation";
import { CurrentPlayerRanking } from "@/components/ranking/current-player-ranking";
import { RankingEmptyState } from "@/components/ranking/ranking-empty-state";
import { RankingList } from "@/components/ranking/ranking-list";
import {
  RANKING_PAGE_SIZE,
  rankingHref,
  type RankingCategory,
  type RankingEntry,
  type RankingScope,
} from "@/lib/ranking";

export function RankingBoardView({
  category,
  scope,
  countryCode,
  page,
  entries,
  labels,
  formatPrimary,
  formatSecondary,
  empty,
}: {
  category: "combat_power" | "pvp";
  scope: RankingScope;
  countryCode?: string;
  page: number;
  entries: RankingEntry[];
  labels: {
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
    /** Rótulo corto: "PC" / "CP" / "Elo". */
    metricLabel: string;
  };
  formatPrimary: (e: RankingEntry) => string;
  formatSecondary?: (e: RankingEntry) => string | undefined;
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

  const total = entries.length;
  const totalPages = Math.max(1, Math.ceil(total / RANKING_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * RANKING_PAGE_SIZE;
  const pageRows = entries.slice(start, start + RANKING_PAGE_SIZE);

  const me = entries.find((e) => e.isCurrentPlayer) ?? null;
  // Si estás en Top 3 de la página 1, la fila ya te marca VOS; igual mostramos
  // la banda compacta para anclar la posición sin una card aparte.
  const showYouStrip = !!me;

  return (
    <div className="flex flex-col gap-2.5 md:gap-3">
      {showYouStrip && me ? (
        <CurrentPlayerRanking entry={me} title={labels.yourTitle} />
      ) : null}

      <RankingList
        entries={pageRows}
        youLabel={labels.you}
        title={labels.listTitle}
        scopeLabel={labels.scopeLabel}
        formatPrimary={formatPrimary}
        formatSecondary={formatSecondary}
        portrait={category === "combat_power" ? "avatar" : "creature"}
        metricKind={category === "combat_power" ? "cp" : "elo"}
        metricLabel={labels.metricLabel}
      />

      <RankingPagination
        category={category}
        scope={scope}
        countryCode={countryCode}
        page={clampedPage}
        totalPages={totalPages}
        prevLabel={labels.prev}
        nextLabel={labels.next}
        pageOfLabel={labels.pageOf(clampedPage, totalPages)}
      />
    </div>
  );
}

function RankingPagination({
  category,
  scope,
  countryCode,
  page,
  totalPages,
  prevLabel,
  nextLabel,
  pageOfLabel,
}: {
  category: RankingCategory;
  scope: RankingScope;
  countryCode?: string;
  page: number;
  totalPages: number;
  prevLabel: string;
  nextLabel: string;
  pageOfLabel: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-1 flex items-center justify-center gap-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {page > 1 ? (
        <Link
          href={rankingHref(category, scope, countryCode, page - 1)}
          className="min-h-11 rounded-md border border-white/10 px-3 py-2 text-label-sm text-on-surface-variant hover:border-white/25 hover:text-on-surface"
        >
          {prevLabel}
        </Link>
      ) : (
        <span className="px-3 py-2 text-label-sm text-on-surface-variant/40">{prevLabel}</span>
      )}
      <span className="text-label-sm text-on-surface-variant">{pageOfLabel}</span>
      {page < totalPages ? (
        <Link
          href={rankingHref(category, scope, countryCode, page + 1)}
          className="min-h-11 rounded-md border border-white/10 px-3 py-2 text-label-sm text-on-surface-variant hover:border-white/25 hover:text-on-surface"
        >
          {nextLabel}
        </Link>
      ) : (
        <span className="px-3 py-2 text-label-sm text-on-surface-variant/40">{nextLabel}</span>
      )}
    </nav>
  );
}
