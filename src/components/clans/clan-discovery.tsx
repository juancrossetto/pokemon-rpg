"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ClanCard, type ClanCardLabels } from "@/components/clans/clan-card";
import { CLAN_AFFINITIES, CLAN_FOCUSES, CLAN_JOIN_POLICIES, CLAN_MAX_MEMBERS } from "@/lib/clan-rules";
import type { ClanAffinity, ClanFocus, ClanJoinPolicy } from "@/lib/clan-types";

export type DiscoveryClan = {
  id: string;
  name: string;
  tag: string;
  motto: string | null;
  description: string | null;
  affinity: ClanAffinity;
  focus: ClanFocus;
  joinPolicy: ClanJoinPolicy;
  language: string | null;
  minPlayerLevel: number | null;
  emblem: unknown;
  memberCount: number;
  badges: number;
  power: number;
  rank: number;
};

type Labels = {
  searchPlaceholder: string;
  filters: string;
  clearFilters: string;
  sortLabel: string;
  sorts: {
    recommended: string;
    power: string;
    members: string;
    recent: string;
  };
  spaceAvailable: string;
  all: string;
  empty: string;
  emptyFiltered: string;
  benefitsTitle: string;
  benefits: string[];
  createCta: string;
  recommended: string;
  recommendedOpen: string;
  recommendedNew: string;
  recommendedDefault: string;
  openFilters: string;
  applyFilters: string;
  affinity: string;
  focus: string;
  joinPolicy: string;
  card: ClanCardLabels;
};

type SortKey = "recommended" | "power" | "members" | "recent";

type FilterState = {
  affinity: "" | ClanAffinity;
  focus: "" | ClanFocus;
  joinPolicy: "" | ClanJoinPolicy;
  spaceOnly: boolean;
};

function filterCount(filters: FilterState): number {
  return (
    (filters.affinity ? 1 : 0) +
    (filters.focus ? 1 : 0) +
    (filters.joinPolicy ? 1 : 0)
  );
}

function featuredReason(clan: DiscoveryClan, labels: Labels): string {
  if (clan.joinPolicy === "OPEN" && clan.memberCount < CLAN_MAX_MEMBERS) {
    return labels.recommendedOpen;
  }
  if (clan.memberCount <= 3) return labels.recommendedNew;
  return labels.recommendedDefault;
}

export function ClanDiscovery({
  clans,
  labels,
  showCreateHref = true,
  compact = false,
  onCreateClick,
}: {
  clans: DiscoveryClan[];
  labels: Labels;
  showCreateHref?: boolean;
  compact?: boolean;
  onCreateClick?: () => void;
}) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    affinity: "",
    focus: "",
    joinPolicy: "",
    spaceOnly: false,
  });
  const [sort, setSort] = useState<SortKey>("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);

  useEffect(() => {
    return () => setFiltersOpen(false);
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = clans.filter((c) => {
      if (filters.affinity && c.affinity !== filters.affinity) return false;
      if (filters.focus && c.focus !== filters.focus) return false;
      if (filters.joinPolicy && c.joinPolicy !== filters.joinPolicy) return false;
      if (filters.spaceOnly && c.memberCount >= CLAN_MAX_MEMBERS) return false;
      if (!query) return true;
      return (
        c.name.toLowerCase().includes(query) ||
        c.tag.toLowerCase().includes(query) ||
        (c.motto?.toLowerCase().includes(query) ?? false)
      );
    });

    list = [...list].sort((a, b) => {
      if (sort === "power") return b.power - a.power || a.rank - b.rank;
      if (sort === "members") return b.memberCount - a.memberCount || a.rank - b.rank;
      if (sort === "recent") return a.rank - b.rank;
      const score = (c: DiscoveryClan) =>
        (c.memberCount < CLAN_MAX_MEMBERS ? 1000 : 0) +
        (c.joinPolicy === "OPEN" ? 200 : c.joinPolicy === "REQUEST" ? 100 : 0) -
        c.rank;
      return score(b) - score(a);
    });

    return list;
  }, [clans, q, filters, sort]);

  const featured = compact ? null : filtered[0] ?? null;
  const listing = featured ? filtered.filter((c) => c.id !== featured.id) : filtered;
  const activeCount = filterCount(filters);

  function clearFilters() {
    setFilters({ affinity: "", focus: "", joinPolicy: "", spaceOnly: false });
    setQ("");
  }

  const chipClass = (active: boolean) =>
    `min-h-11 shrink-0 rounded-full border px-3 text-label-sm transition-colors ${
      active
        ? "border-pokeball-red/45 bg-pokeball-red/12 text-on-surface"
        : "border-white/10 text-on-surface-variant hover:border-white/20"
    }`;

  return (
    <div className="relative flex flex-col gap-5">
      {!compact && (
        <div className="rounded-xl border border-white/10 bg-glass-surface p-4">
          <h2 className="text-headline-md text-on-surface mb-2">{labels.benefitsTitle}</h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {labels.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-label-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-pokeball-red text-[16px]! mt-0.5">
                  check_circle
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {featured && (
        <section>
          <p className="mb-2 text-label-sm uppercase tracking-wide text-tertiary">
            {labels.recommended}
          </p>
          <ClanCard
            clan={featured}
            labels={labels.card}
            highlight
            featuredReason={featuredReason(featured, labels)}
          />
        </section>
      )}

      <div className="flex flex-col gap-3">
        <label className="sr-only" htmlFor="clan-search">
          {labels.searchPlaceholder}
        </label>
        <input
          id="clan-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={labels.searchPlaceholder}
          className="min-h-11 w-full rounded-xl border border-white/10 bg-surface-container px-4 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:border-pokeball-red/50 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={chipClass(activeCount === 0 && !filters.spaceOnly && !q)} onClick={clearFilters}>
            {labels.all}
          </button>
          <button
            type="button"
            className={chipClass(filters.spaceOnly)}
            onClick={() => setFilters((f) => ({ ...f, spaceOnly: !f.spaceOnly }))}
          >
            {labels.spaceAvailable}
          </button>

          <button
            type="button"
            className={`${chipClass(false)} sm:hidden`}
            onClick={() => setFiltersOpen(true)}
            aria-expanded={filtersOpen}
          >
            {labels.openFilters}
            {activeCount > 0 ? ` (${activeCount})` : ""}
          </button>

          <button
            type="button"
            className={`${chipClass(desktopFiltersOpen)} hidden sm:inline-flex`}
            onClick={() => setDesktopFiltersOpen((v) => !v)}
            aria-expanded={desktopFiltersOpen}
          >
            {labels.filters}
            {activeCount > 0 ? ` · ${activeCount}` : ""}
          </button>

          <label className="ml-auto flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 px-3 text-label-sm text-on-surface-variant">
            <span className="hidden md:inline">{labels.sortLabel}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-transparent text-label-sm text-on-surface focus:outline-none"
              aria-label={labels.sortLabel}
            >
              <option value="recommended">{labels.sorts.recommended}</option>
              <option value="power">{labels.sorts.power}</option>
              <option value="members">{labels.sorts.members}</option>
            </select>
          </label>
        </div>

        {desktopFiltersOpen && (
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            labels={labels}
            onApply={() => setDesktopFiltersOpen(false)}
            onClear={clearFilters}
            className="hidden rounded-xl border border-white/10 bg-black/25 p-3 sm:block"
          />
        )}
      </div>

      {listing.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-on-surface-variant">
          <p className="text-label-md">{clans.length === 0 ? labels.empty : labels.emptyFiltered}</p>
          {(activeCount > 0 || filters.spaceOnly || q) && (
            <button
              type="button"
              className="mt-3 min-h-11 rounded-lg border border-white/15 px-4 text-label-sm"
              onClick={clearFilters}
            >
              {labels.clearFilters}
            </button>
          )}
        </div>
      ) : (
        <ul className={`grid gap-2 ${compact ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"}`}>
          {listing.map((c) => (
            <li key={c.id}>
              <ClanCard clan={c} labels={labels.card} />
            </li>
          ))}
        </ul>
      )}

      {showCreateHref && onCreateClick && (
        <button
          type="button"
          onClick={onCreateClick}
          className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-pokeball-red/40 bg-pokeball-red/10 px-4 text-label-md text-on-surface hover:bg-pokeball-red/15"
        >
          <span className="material-symbols-outlined text-[20px]!">add_circle</span>
          {labels.createCta}
        </button>
      )}

      <ClanFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
        labels={labels}
        onClear={clearFilters}
      />
    </div>
  );
}

function FilterPanel({
  filters,
  onChange,
  labels,
  onApply,
  onClear,
  className,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  labels: Labels;
  onApply?: () => void;
  onClear: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="grid gap-3 sm:grid-cols-3">
        <FilterSelect
          label={labels.affinity}
          value={filters.affinity}
          onChange={(value) => onChange({ ...filters, affinity: value as "" | ClanAffinity })}
          options={[{ value: "", label: labels.all }, ...CLAN_AFFINITIES.map((a) => ({ value: a, label: labels.card.affinities[a] }))]}
        />
        <FilterSelect
          label={labels.focus}
          value={filters.focus}
          onChange={(value) => onChange({ ...filters, focus: value as "" | ClanFocus })}
          options={[{ value: "", label: labels.all }, ...CLAN_FOCUSES.map((f) => ({ value: f, label: labels.card.focuses[f] }))]}
        />
        <FilterSelect
          label={labels.joinPolicy}
          value={filters.joinPolicy}
          onChange={(value) => onChange({ ...filters, joinPolicy: value as "" | ClanJoinPolicy })}
          options={[
            { value: "", label: labels.all },
            ...CLAN_JOIN_POLICIES.map((p) => ({
              value: p,
              label:
                p === "OPEN"
                  ? labels.card.joinOpen
                  : p === "REQUEST"
                    ? labels.card.requestJoin
                    : labels.card.inviteOnly,
            })),
          ]}
        />
      </div>
      <div className="mt-3 flex gap-2">
        {filterCount(filters) > 0 && (
          <button type="button" onClick={onClear} className="min-h-11 rounded-lg border border-white/10 px-3 text-label-sm text-on-surface-variant">
            {labels.clearFilters}
          </button>
        )}
        {onApply && (
          <button type="button" onClick={onApply} className="ui-btn-primary min-h-11 px-4 text-label-sm">
            {labels.applyFilters}
          </button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-sm text-on-surface-variant">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-lg border border-white/10 bg-surface-container px-2 text-label-sm text-on-surface"
      >
        {options.map((opt) => (
          <option key={opt.value || "all"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ClanFilterSheet({
  open,
  onClose,
  filters,
  onChange,
  labels,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  labels: Labels;
  onClear: () => void;
}) {
  const titleId = useId();

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 sm:hidden" role="presentation">
      <button
        type="button"
        aria-label={labels.clearFilters}
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-white/12 bg-[#0b0d13]/98 backdrop-blur-xl"
      >
        <div className="relative flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <span aria-hidden className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-white/20" />
          <h2 id={titleId} className="text-label-md font-semibold text-on-surface">
            {labels.filters}
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10">
            <span className="material-symbols-outlined text-[20px]!">close</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <FilterPanel filters={filters} onChange={onChange} labels={labels} onClear={onClear} />
        </div>
        <div className="shrink-0 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="ui-btn-primary min-h-11 w-full text-label-sm font-semibold"
          >
            {labels.applyFilters}
          </button>
        </div>
      </div>
    </div>
  );
}
