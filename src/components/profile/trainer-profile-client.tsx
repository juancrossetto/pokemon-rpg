"use client";

import { useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import {
  TrainerIdentityHero,
  type IdentityHeroLabels,
} from "@/components/profile/trainer-identity-hero";
import {
  TrainerMetricsSummary,
  type ProfileHubLabels,
  type ProfileTabId,
} from "@/components/profile/trainer-profile-hub";
import { TrainerFeaturedBadges } from "@/components/profile/trainer-featured-badges";
import type { AvatarPickerLabels } from "@/components/avatar-picker";
import type { RankProgress, Achievement } from "@/lib/trainer-profile";
import type { TrainerAppearance } from "@/lib/trainer-appearance";
import type { FeaturedGymBadge } from "@/components/profile/trainer-featured-badges";

export function TrainerProfileClient({
  hero,
  hubLabels,
  metrics,
  featured,
  vault,
  team,
  stats,
  summaryExtra,
}: {
  hero: {
    username: string;
    companionLine: string | null;
    sceneLabel: string;
    country: string;
    title: string;
    rank: RankProgress;
    power: number;
    badges: number;
    totalGyms: number;
    memberSince: string;
    trainerSpriteUrl: string | null;
    companionSpriteUrl: string | null;
    companionName: string | null;
    companionAccent: string;
    appearance?: TrainerAppearance | null;
    canEdit: boolean;
    currentAvatarId: string | null;
    avatarLabels: AvatarPickerLabels;
    labels: IdentityHeroLabels;
  };
  hubLabels: ProfileHubLabels;
  metrics: {
    sectionLabel: string;
    power: number;
    dexPct: number;
    dexHint: string;
    badgesLabel: string;
    badgesPct: number;
    pvpRecord: string;
    pvpHint: string;
    labels: { power: string; dex: string; badges: string; pvp: string };
  };
  featured: {
    gymBadges: FeaturedGymBadge[];
    achievements: Achievement[];
    labels: {
      title: string;
      seeAll: string;
      locked: string;
      achievement: Record<string, { name: string }>;
    };
  };
  vault: ReactNode;
  team: ReactNode;
  stats: ReactNode;
  summaryExtra: ReactNode;
}) {
  const [tab, setTab] = useState<ProfileTabId>("summary");
  const tabs: ProfileTabId[] = ["summary", "badges", "team", "stats"];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 md:gap-5">
      <TrainerIdentityHero {...hero} />

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
                  {hubLabels.tabs[id]}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "summary" && (
          <div className="flex flex-col gap-4" role="tabpanel">
            <TrainerFeaturedBadges {...featured} onSeeAll={() => setTab("badges")} />
            <TrainerMetricsSummary {...metrics} />
            {summaryExtra}
          </div>
        )}
        {tab === "badges" && <div role="tabpanel">{vault}</div>}
        {tab === "team" && (
          <div className="flex flex-col gap-3" role="tabpanel">
            <div className="flex justify-end">
              <Link
                href="/team"
                className="rounded-lg border border-white/12 px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant transition hover:border-white/25 hover:text-white"
              >
                {hubLabels.manageTeam}
              </Link>
            </div>
            {team}
          </div>
        )}
        {tab === "stats" && <div role="tabpanel">{stats}</div>}
      </div>
    </div>
  );
}
