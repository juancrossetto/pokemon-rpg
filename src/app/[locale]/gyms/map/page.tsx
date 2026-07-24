import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { typeColor } from "@/lib/type-colors";
import { computeGymStatuses } from "@/lib/gym-status";
import { GYM_MAP_POINTS, KANTO_MAP_IMAGE } from "@/lib/gym-map";
import { gymBadgeImageUrl } from "@/lib/gym-art";
import { redirectIfInBattle } from "@/lib/battle-lock";

export default async function GymMapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, session] = await Promise.all([getTranslations("gyms"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  await redirectIfInBattle(session.user.id, locale);

  const statuses = await computeGymStatuses(session.user.id);
  const badgeCount = statuses.filter((s) => s.badgeEarned).length;
  const pointByOrder = new Map(GYM_MAP_POINTS.map((p) => [p.order, p]));

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-headline-lg md:text-display-lg text-white mb-1">{t("mapTitle")}</h1>
            <p className="text-label-sm md:text-[14px] md:tracking-[0.05em] text-on-surface-variant">
              {t("badgeProgress", { count: badgeCount })}
            </p>
          </div>
          <Link
            href="/gyms"
            aria-label={t("backToList")}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 md:px-4 md:py-2 text-label-sm md:text-[14px] md:tracking-[0.05em] text-on-surface hover:border-pokeball-red/50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]!">view_list</span>
            <span className="hidden sm:inline">{t("backToList")}</span>
          </Link>
        </div>

        <div className="glass-panel rounded-xl border border-white/10 p-2 sm:p-3">
          <div className="relative w-full aspect-[1177/1056] rounded-lg overflow-hidden bg-[#1a2a3a]">
            <Image
              src={KANTO_MAP_IMAGE}
              alt={t("mapTitle")}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover opacity-90"
            />
            {/* Vignette para que los pines de medalla lean mejor sobre el mapa claro */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35" />

            {statuses.map(({ gym, badgeEarned, locked }) => {
              const point = pointByOrder.get(gym.order);
              if (!point) return null;
              const color = typeColor(gym.type);
              const badgeSrc = gymBadgeImageUrl(gym.type);

              const pin = (
                <div
                  className={`relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 bg-background/90 backdrop-blur-sm transition-transform ${
                    locked ? "opacity-70" : "hover:scale-110"
                  }`}
                  style={{
                    borderColor: color,
                    boxShadow: badgeEarned
                      ? `0 0 14px ${color}aa`
                      : locked
                        ? undefined
                        : `0 0 10px ${color}55`,
                  }}
                  title={`${gym.name} — ${gym.leaderName}${gym.badgeName ? ` · ${gym.badgeName}` : ""}`}
                >
                  <Image
                    src={badgeSrc}
                    alt={gym.badgeName || gym.name}
                    width={28}
                    height={28}
                    className={`w-5 h-5 sm:w-6 sm:h-6 object-contain ${
                      locked && !badgeEarned ? "opacity-45 grayscale" : ""
                    } ${badgeEarned ? "drop-shadow-[0_0_6px_rgba(242,192,0,0.65)]" : ""}`}
                  />
                  {locked && !badgeEarned && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-background border border-white/20">
                      <span className="material-symbols-outlined text-[10px]! sm:text-[11px]! leading-none text-on-surface-variant">
                        lock
                      </span>
                    </span>
                  )}
                  {badgeEarned && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-tertiary text-surface">
                      <span className="material-symbols-outlined text-[10px]! sm:text-[11px]! leading-none">
                        check
                      </span>
                    </span>
                  )}
                </div>
              );

              return (
                <div
                  key={gym.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  {locked ? pin : <Link href={`/gyms/${gym.id}`}>{pin}</Link>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
