"use client";

import { ProgressRail } from "@/components/trainer-profile-parts";
import { gymBadgeImageUrl } from "@/lib/gym-art";
import type { Achievement } from "@/lib/trainer-profile";

export type FeaturedGymBadge = {
  id: string;
  badgeName: string;
  type: string;
  accent: string;
};

/**
 * Insignias destacadas estilo colección (no copia GO): medallas + logros con barra.
 */
export function TrainerFeaturedBadges({
  gymBadges,
  achievements,
  labels,
  onSeeAll,
}: {
  gymBadges: FeaturedGymBadge[];
  achievements: Achievement[];
  labels: {
    title: string;
    seeAll: string;
    locked: string;
    achievement: Record<string, { name: string }>;
  };
  onSeeAll?: () => void;
}) {
  const featuredAchievements = achievements.slice(0, 4);
  const featuredGyms = gymBadges.slice(0, 4);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70">
          {labels.title}
        </p>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[11px] font-semibold text-primary transition hover:text-white"
          >
            {labels.seeAll}
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-white/8 bg-[#0e1118]/90 p-3">
        {featuredGyms.length > 0 && (
          <ul className="mb-3 grid grid-cols-4 gap-2">
            {featuredGyms.map((b) => (
              <li key={b.id} className="flex flex-col items-center gap-1">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full border bg-black/35"
                  style={{ borderColor: `${b.accent}66`, boxShadow: `0 0 16px ${b.accent}22` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gymBadgeImageUrl(b.type)}
                    alt={b.badgeName}
                    className="h-9 w-9 object-contain"
                  />
                </span>
                <p className="max-w-full truncate text-center text-[9px] text-white/70">
                  {b.badgeName}
                </p>
              </li>
            ))}
          </ul>
        )}

        <ul className="grid grid-cols-4 gap-2">
          {featuredAchievements.map((a) => {
            const name = labels.achievement[a.id]?.name ?? a.id;
            return (
              <li key={a.id} className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full border ${
                    a.unlocked
                      ? "border-white/20 bg-white/6 text-electric-yellow"
                      : "border-white/8 bg-black/30 text-white/25"
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]!">{a.icon}</span>
                </span>
                <p className="max-w-full truncate text-center text-[9px] text-white/65">{name}</p>
                <div className="w-full px-1">
                  <ProgressRail
                    pct={a.pct}
                    color={a.unlocked ? "#f2c000" : "#64748b"}
                    height={3}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {featuredGyms.length === 0 && featuredAchievements.length === 0 && (
          <p className="py-4 text-center text-[12px] text-on-surface-variant">{labels.locked}</p>
        )}
      </div>
    </section>
  );
}
