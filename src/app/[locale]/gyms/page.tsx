import { getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { typeColor } from "@/lib/type-colors";
import { computeGymStatuses } from "@/lib/gym-status";
import { marketFeeDiscount, obedienceLevelCap } from "@/lib/badge-perks";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { GymCard } from "@/components/gym-card";

export default async function GymsPage({
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

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-4 md:py-6">
      <div className="mx-auto max-w-5xl">
        {/* En mobile el título y "Ver mapa" comparten fila: apilados se comían
            media pantalla antes de la primera card. */}
        <div className="flex items-start justify-between gap-3 mb-3 md:mb-6">
          <div className="min-w-0">
            <h1 className="text-headline-lg md:text-display-lg text-white">{t("title")}</h1>
            {/* 12px en mobile para ganar alto; 14px desde md como estaba antes.
                El tamaño de md va en valor arbitrario porque `md:text-label-md`
                no genera nada (ver nota en gym-card.tsx). */}
            <p className="text-label-sm md:text-[14px] md:tracking-[0.05em] text-on-surface-variant mt-0.5">
              {t("subtitle")}
            </p>
          </div>
          <Link
            href="/gyms/map"
            aria-label={t("viewMap")}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 md:px-4 md:py-2 text-label-sm md:text-[14px] md:tracking-[0.05em] text-on-surface hover:border-pokeball-red/50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]!">map</span>
            <span className="hidden sm:inline">{t("viewMap")}</span>
          </Link>
        </div>

        {/* Medallero: un rombo por gimnasio, teñido del color del tipo cuando
            la medalla está ganada. Da la progresión de un vistazo, que el
            contador "0/8" solo no transmitía. */}
        <div className="flex items-center gap-2 mb-4 md:mb-6 flex-wrap">
          <div className="flex items-center gap-1">
            {statuses.map(({ gym, badgeEarned }) => {
              const color = typeColor(gym.type);
              return (
                <span
                  key={gym.id}
                  title={`${gym.name} · ${gym.badgeName}`}
                  className="w-2.5 h-2.5 rotate-45 rounded-[2px] border transition-colors"
                  style={
                    badgeEarned
                      ? { backgroundColor: color, borderColor: color, boxShadow: `0 0 6px ${color}88` }
                      : { borderColor: "rgba(255,255,255,0.18)" }
                  }
                />
              );
            })}
          </div>
          <span className="text-label-sm text-tertiary font-mono">
            {t("badgeProgress", { count: badgeCount })}
          </span>
        </div>

        {badgeCount > 0 && (
          <p className="text-label-sm text-on-surface-variant mb-4 -mt-2">
            {t("obedienceCap", { level: obedienceLevelCap(badgeCount) })}
            <span className="mx-1.5 text-white/20">·</span>
            {t("marketDiscount", { pct: Math.round(marketFeeDiscount(badgeCount) * 100) })}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:gap-2.5">
          {statuses.map((status) => (
            <GymCard key={status.gym.id} status={status} />
          ))}
        </div>
      </div>
    </div>
  );
}
