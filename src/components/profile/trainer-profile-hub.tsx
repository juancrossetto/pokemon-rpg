"use client";

import { useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { MetricTile } from "@/components/metric-tile";

export type ProfileTabId = "summary" | "badges" | "team" | "stats";

export type ProfileHubLabels = {
  tabs: Record<ProfileTabId, string>;
  metrics: string;
  featuredBadges: string;
  viewAllBadges: string;
  manageTeam: string;
};

/**
 * Tabs internas del perfil. Sticky bajo el header global, sin pelear con bottom nav.
 */
export function TrainerProfileHub({
  labels,
  summary,
  badges,
  team,
  stats,
  metrics,
  featured,
}: {
  labels: ProfileHubLabels;
  summary: ReactNode;
  badges: ReactNode;
  team: ReactNode;
  stats: ReactNode;
  metrics: ReactNode;
  featured: ReactNode;
}) {
  const [tab, setTab] = useState<ProfileTabId>("summary");
  const tabs: ProfileTabId[] = ["summary", "badges", "team", "stats"];

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-1 bg-background/90 px-1 py-1.5 backdrop-blur-xl xl:top-16">
        <div
          role="tablist"
          aria-label="Profile sections"
          className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[#10131a]/95 p-1"
        >
          {tabs.map((id) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`min-h-10 flex-1 rounded-lg px-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition sm:text-[12px] ${
                  active
                    ? "bg-pokeball-red text-white shadow-[0_6px_16px_rgba(200,16,46,0.35)]"
                    : "text-on-surface-variant hover:bg-white/5 hover:text-white"
                }`}
              >
                {labels.tabs[id]}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "summary" && (
        <div className="flex flex-col gap-4" role="tabpanel">
          {featured}
          {metrics}
          {summary}
        </div>
      )}
      {tab === "badges" && (
        <div role="tabpanel">{badges}</div>
      )}
      {tab === "team" && (
        <div className="flex flex-col gap-3" role="tabpanel">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70">
              {labels.tabs.team}
            </p>
            <Link
              href="/team"
              className="rounded-lg border border-white/12 px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant transition hover:border-white/25 hover:text-white"
            >
              {labels.manageTeam}
            </Link>
          </div>
          {team}
        </div>
      )}
      {tab === "stats" && (
        <div role="tabpanel">{stats}</div>
      )}
    </div>
  );
}

export function TrainerMetricsSummary({
  sectionLabel,
  power,
  dexPct,
  dexHint,
  badgesLabel,
  badgesPct,
  pvpRecord,
  pvpHint,
  labels,
}: {
  sectionLabel: string;
  power: number;
  dexPct: number;
  dexHint: string;
  badgesLabel: string;
  badgesPct: number;
  pvpRecord: string;
  pvpHint: string;
  labels: {
    power: string;
    dex: string;
    badges: string;
    pvp: string;
  };
}) {
  return (
    <section>
      <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70">
        {sectionLabel}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <MetricTile
          icon="bolt"
          label={labels.power}
          numericValue={power}
          accent="#f2c000"
          delayMs={40}
        />
        <MetricTile
          icon="menu_book"
          label={labels.dex}
          numericValue={dexPct}
          suffix="%"
          barPct={dexPct / 100}
          hint={dexHint}
          accent="#60a5fa"
          delayMs={80}
        />
        <MetricTile
          icon="military_tech"
          label={labels.badges}
          value={badgesLabel}
          barPct={badgesPct}
          accent="#ee1515"
          delayMs={120}
        />
        <MetricTile
          icon="swords"
          label={labels.pvp}
          value={pvpRecord}
          hint={pvpHint}
          accent="#a78bfa"
          delayMs={160}
        />
      </div>
    </section>
  );
}
