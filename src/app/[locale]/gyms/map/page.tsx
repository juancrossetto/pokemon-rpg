import { getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { typeColor } from "@/lib/type-colors";
import { computeGymStatuses } from "@/lib/gym-status";
import { GYM_MAP_POINTS } from "@/lib/gym-map";
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

  const routePoints = GYM_MAP_POINTS.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-4">
          <div>
            <h1 className="text-headline-lg md:text-display-lg text-white mb-1">{t("mapTitle")}</h1>
            <p className="text-label-md text-on-surface-variant">{t("badgeProgress", { count: badgeCount })}</p>
          </div>
          <Link
            href="/gyms"
            className="flex items-center gap-2 self-start rounded-lg border border-white/10 px-4 py-2 text-label-md text-on-surface hover:border-pokeball-red/50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">view_list</span>
            {t("backToList")}
          </Link>
        </div>

        <div className="glass-panel rounded-xl border border-white/10 p-4">
          <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-surface-container-lowest">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              <defs>
                <pattern id="mapGrid" width="5" height="5" patternUnits="userSpaceOnUse">
                  <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.2" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#mapGrid)" />
              <polygon
                points="8,45 22,20 48,15 62,22 70,40 62,55 70,75 58,95 40,98 22,90 10,70"
                fill="rgba(238,21,21,0.04)"
                stroke="rgba(238,21,21,0.25)"
                strokeWidth="0.4"
              />
              <polyline
                points={routePoints}
                fill="none"
                stroke="rgba(238,21,21,0.3)"
                strokeWidth="0.5"
                strokeDasharray="1.5,1.5"
              />
            </svg>

            {statuses.map(({ gym, badgeEarned, locked }) => {
              const point = pointByOrder.get(gym.order);
              if (!point) return null;
              const color = typeColor(gym.type);

              const pin = (
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-transform ${
                    locked ? "opacity-50" : "hover:scale-110"
                  }`}
                  style={{
                    backgroundColor: badgeEarned ? `${color}55` : "rgba(19,19,19,0.9)",
                    borderColor: color,
                    boxShadow: badgeEarned ? `0 0 12px ${color}88` : undefined,
                  }}
                  title={`${gym.name} — ${gym.leaderName}`}
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ color: locked ? "#8a8a8a" : color }}>
                    {badgeEarned ? "check" : locked ? "lock" : "swords"}
                  </span>
                </div>
              );

              return (
                <div
                  key={gym.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  {locked ? pin : <Link href={`/gyms/${gym.id}`}>{pin}</Link>}
                  <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap bg-background/70 px-1 rounded">
                    {point.city}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
