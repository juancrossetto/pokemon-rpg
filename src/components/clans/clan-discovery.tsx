"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { ClanAffinityChip } from "@/components/clans/clan-affinity-chip";
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
  affinity: string;
  focus: string;
  joinPolicy: string;
  spaceAvailable: string;
  all: string;
  members: string;
  power: string;
  joinOpen: string;
  requestJoin: string;
  inviteOnly: string;
  full: string;
  minLevel: string;
  empty: string;
  emptyFiltered: string;
  benefitsTitle: string;
  benefits: string[];
  createCta: string;
  recommended: string;
  affinities: Record<ClanAffinity, string>;
  focuses: Record<ClanFocus, string>;
  joinPolicies: Record<ClanJoinPolicy, string>;
};

type SortKey = "recommended" | "power" | "members" | "recent";

export function ClanDiscovery({
  clans,
  labels,
  showCreateHref = true,
}: {
  clans: DiscoveryClan[];
  labels: Labels;
  showCreateHref?: boolean;
}) {
  const [q, setQ] = useState("");
  const [affinity, setAffinity] = useState<"" | ClanAffinity>("");
  const [focus, setFocus] = useState<"" | ClanFocus>("");
  const [joinPolicy, setJoinPolicy] = useState<"" | ClanJoinPolicy>("");
  const [spaceOnly, setSpaceOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recommended");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = clans.filter((c) => {
      if (affinity && c.affinity !== affinity) return false;
      if (focus && c.focus !== focus) return false;
      if (joinPolicy && c.joinPolicy !== joinPolicy) return false;
      if (spaceOnly && c.memberCount >= CLAN_MAX_MEMBERS) return false;
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
      if (sort === "recent") return a.rank - b.rank; // rank already from power; keep stable
      // recommended: open/request with space first, then by rank
      const score = (c: DiscoveryClan) =>
        (c.memberCount < CLAN_MAX_MEMBERS ? 1000 : 0) +
        (c.joinPolicy === "OPEN" ? 200 : c.joinPolicy === "REQUEST" ? 100 : 0) -
        c.rank;
      return score(b) - score(a);
    });

    return list;
  }, [clans, q, affinity, focus, joinPolicy, spaceOnly, sort]);

  const featured = filtered[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
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

      {featured && (
        <section className="rounded-2xl border border-pokeball-red/30 bg-gradient-to-br from-pokeball-red/15 via-glass-surface to-glass-surface p-4">
          <p className="text-label-sm text-pokeball-red mb-2 uppercase tracking-wide">
            {labels.recommended}
          </p>
          <ClanCard clan={featured} labels={labels} highlight />
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
          className="min-h-11 w-full bg-surface-container border border-white/10 rounded-xl px-4 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50"
        />

        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-label-sm text-on-surface-variant mr-1">{labels.filters}</span>
          <select
            value={affinity}
            onChange={(e) => setAffinity(e.target.value as "" | ClanAffinity)}
            className="min-h-11 rounded-lg border border-white/10 bg-surface-container px-2 text-label-sm text-on-surface"
            aria-label={labels.affinity}
          >
            <option value="">{labels.all}</option>
            {CLAN_AFFINITIES.map((a) => (
              <option key={a} value={a}>
                {labels.affinities[a]}
              </option>
            ))}
          </select>
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value as "" | ClanFocus)}
            className="min-h-11 rounded-lg border border-white/10 bg-surface-container px-2 text-label-sm text-on-surface"
            aria-label={labels.focus}
          >
            <option value="">{labels.all}</option>
            {CLAN_FOCUSES.map((f) => (
              <option key={f} value={f}>
                {labels.focuses[f]}
              </option>
            ))}
          </select>
          <select
            value={joinPolicy}
            onChange={(e) => setJoinPolicy(e.target.value as "" | ClanJoinPolicy)}
            className="min-h-11 rounded-lg border border-white/10 bg-surface-container px-2 text-label-sm text-on-surface"
            aria-label={labels.joinPolicy}
          >
            <option value="">{labels.all}</option>
            {CLAN_JOIN_POLICIES.map((p) => (
              <option key={p} value={p}>
                {labels.joinPolicies[p]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSpaceOnly((v) => !v)}
            className={`min-h-11 px-3 rounded-lg border text-label-sm ${
              spaceOnly
                ? "border-tertiary/50 bg-tertiary/15 text-tertiary"
                : "border-white/10 text-on-surface-variant"
            }`}
          >
            {labels.spaceAvailable}
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="min-h-11 rounded-lg border border-white/10 bg-surface-container px-2 text-label-sm text-on-surface ml-auto"
            aria-label={labels.sortLabel}
          >
            <option value="recommended">{labels.sorts.recommended}</option>
            <option value="power">{labels.sorts.power}</option>
            <option value="members">{labels.sorts.members}</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-on-surface-variant">
          <p className="text-label-md">{clans.length === 0 ? labels.empty : labels.emptyFiltered}</p>
          {(affinity || focus || joinPolicy || spaceOnly || q) && (
            <button
              type="button"
              className="mt-3 min-h-11 px-4 rounded-lg border border-white/15 text-label-sm"
              onClick={() => {
                setQ("");
                setAffinity("");
                setFocus("");
                setJoinPolicy("");
                setSpaceOnly(false);
              }}
            >
              {labels.clearFilters}
            </button>
          )}
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <ClanCard clan={c} labels={labels} />
            </li>
          ))}
        </ul>
      )}

      {showCreateHref && (
        <a
          href="#create-clan"
          className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-pokeball-red/40 bg-pokeball-red/10 px-4 text-label-md text-on-surface hover:bg-pokeball-red/15"
        >
          <span className="material-symbols-outlined text-[20px]!">add_circle</span>
          {labels.createCta}
        </a>
      )}
    </div>
  );
}

function ClanCard({
  clan,
  labels,
  highlight,
}: {
  clan: DiscoveryClan;
  labels: Labels;
  highlight?: boolean;
}) {
  const full = clan.memberCount >= CLAN_MAX_MEMBERS;
  const cta =
    full
      ? labels.full
      : clan.joinPolicy === "OPEN"
        ? labels.joinOpen
        : clan.joinPolicy === "REQUEST"
          ? labels.requestJoin
          : labels.inviteOnly;

  return (
    <Link
      href={`/clans/${clan.id}`}
      className={`flex gap-3 rounded-xl border p-3 transition-colors ${
        highlight
          ? "border-pokeball-red/40 bg-black/20"
          : "border-white/10 bg-glass-surface hover:border-pokeball-red/35"
      }`}
    >
      <ClanEmblemBadge emblem={clan.emblem} size={48} title={clan.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-label-sm text-pokeball-red">#{clan.rank}</span>
          <span className="text-label-md text-on-surface truncate">
            <span className="font-mono text-pokeball-red">[{clan.tag}]</span> {clan.name}
          </span>
        </div>
        {clan.motto ? (
          <p className="text-label-sm text-on-surface-variant italic truncate">“{clan.motto}”</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-label-sm text-on-surface-variant">
          <ClanAffinityChip
            affinity={clan.affinity}
            label={labels.affinities[clan.affinity]}
            size="sm"
          />
          <span>{labels.focuses[clan.focus]}</span>
          <span>
            {labels.members}: {clan.memberCount}/{CLAN_MAX_MEMBERS}
          </span>
          <span>
            {labels.power}: {clan.power}
          </span>
          {clan.minPlayerLevel != null && (
            <span>
              {labels.minLevel} {clan.minPlayerLevel}
            </span>
          )}
        </div>
        <span className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-white/15 px-2.5 text-label-sm text-on-surface">
          {cta}
        </span>
      </div>
    </Link>
  );
}
