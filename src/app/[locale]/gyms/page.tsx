import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { typeColor } from "@/lib/type-colors";
import { typeIcon } from "@/lib/type-icons";
import { gymBadgeImageUrl, gymLeaderPortraitUrl } from "@/lib/gym-art";
import { computeGymStatuses } from "@/lib/gym-status";
import { marketFeeDiscount, obedienceLevelCap } from "@/lib/badge-perks";
import { redirectIfInBattle } from "@/lib/battle-lock";

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
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-headline-lg md:text-display-lg text-white mb-1">{t("title")}</h1>
            <p className="text-label-md text-on-surface-variant">{t("subtitle")}</p>
            <p className="text-label-sm text-tertiary mt-2 font-mono">{t("badgeProgress", { count: badgeCount })}</p>
            {badgeCount > 0 && (
              <p className="text-label-sm text-on-surface-variant mt-1">
                {t("obedienceCap", { level: obedienceLevelCap(badgeCount) })} ·{" "}
                {t("marketDiscount", { pct: Math.round(marketFeeDiscount(badgeCount) * 100) })}
              </p>
            )}
          </div>
          <Link
            href="/gyms/map"
            className="flex items-center gap-2 self-start rounded-lg border border-white/10 px-4 py-2 text-label-md text-on-surface hover:border-pokeball-red/50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            {t("viewMap")}
          </Link>
        </div>

        <div className="flex flex-col gap-2.5">
          {statuses.map(({ gym, badgeEarned, locked, onCooldown, hoursLeft }) => {
            const color = typeColor(gym.type);
            const portrait = gymLeaderPortraitUrl(gym.leaderName);
            const badgeSrc = gymBadgeImageUrl(gym.type);

            const statusChip = badgeEarned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-tertiary/15 border border-tertiary/40 px-2 py-0.5 text-label-sm text-tertiary">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                {t("badgeEarned")}
              </span>
            ) : locked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-label-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[13px]">lock</span>
                {t("locked")}
              </span>
            ) : onCooldown ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-error/10 border border-error/30 px-2 py-0.5 text-label-sm text-error">
                {t("cooldownHint", { hours: hoursLeft })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-pokeball-red/15 border border-pokeball-red/40 px-2 py-0.5 text-label-sm text-pokeball-red font-bold">
                {t("challenge")}
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </span>
            );

            const card = (
              <article
                className={`relative overflow-hidden rounded-xl border backdrop-blur-xl transition-all ${
                  badgeEarned
                    ? "border-tertiary/40 bg-glass-surface"
                    : locked
                      ? "border-white/5 bg-glass-surface opacity-70"
                      : "border-white/10 bg-glass-surface hover:border-pokeball-red/45 hover:bg-surface-container/80"
                }`}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-25"
                  style={{
                    background: `linear-gradient(105deg, ${color}33 0%, transparent 48%)`,
                  }}
                />

                <div className="relative flex gap-3 p-3">
                  {/* Portrait */}
                  <div
                    className="relative w-20 h-24 sm:w-24 sm:h-28 rounded-lg overflow-hidden shrink-0 border"
                    style={{ borderColor: `${color}88`, boxShadow: `0 0 16px ${color}22` }}
                  >
                    {portrait ? (
                      <Image
                        src={portrait}
                        alt={gym.leaderName}
                        fill
                        sizes="96px"
                        className="object-cover object-top"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: `${color}22` }}
                      >
                        <span className="material-symbols-outlined text-[28px]" style={{ color }}>
                          {typeIcon(gym.type)}
                        </span>
                      </div>
                    )}
                    <span
                      className="absolute top-1 left-1 rounded px-1 py-0.5 text-[10px] font-mono font-bold text-white/90 backdrop-blur-sm"
                      style={{ backgroundColor: `${color}cc` }}
                    >
                      #{gym.order}
                    </span>
                    {locked && (
                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white/80 text-[22px]">lock</span>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5 py-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-label-lg sm:text-headline-md text-white leading-tight truncate">{gym.name}</h2>
                        <p className="text-label-sm text-on-surface-variant truncate">
                          {t("leaderLabel", { name: gym.leaderName })}
                          <span className="mx-1.5 text-white/20">·</span>
                          <span className="capitalize" style={{ color }}>
                            {gym.type}
                          </span>
                        </p>
                      </div>

                      <div
                        className={`shrink-0 w-11 h-11 rounded-lg border flex items-center justify-center ${
                          badgeEarned
                            ? "border-tertiary/50 bg-tertiary/10"
                            : "border-white/10 bg-surface-container-high/80"
                        }`}
                        title={gym.badgeName}
                      >
                        <Image
                          src={badgeSrc}
                          alt={gym.badgeName}
                          width={28}
                          height={28}
                          className={`object-contain ${badgeEarned ? "drop-shadow-[0_0_6px_rgba(242,192,0,0.55)]" : "opacity-80"}`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex -space-x-1.5">
                        {gym.team.map((member) => (
                          <div
                            key={member.id}
                            className="w-7 h-7 rounded-full bg-surface-container-highest border border-white/15 overflow-hidden"
                            title={`${member.species.name} · ${t("levelLabel", { level: member.level })}`}
                          >
                            {member.species.spriteUrl && (
                              <Image
                                src={member.species.spriteUrl}
                                alt={member.species.name}
                                width={28}
                                height={28}
                                className="w-full h-full object-contain"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <span className="text-label-sm text-electric-yellow font-mono shrink-0">
                        {t("coinReward", { coins: gym.coinReward })}
                      </span>
                      <div className="ml-auto shrink-0">{statusChip}</div>
                    </div>
                  </div>
                </div>
              </article>
            );

            return locked ? (
              <div key={gym.id}>{card}</div>
            ) : (
              <Link key={gym.id} href={`/gyms/${gym.id}`} className="block group">
                {card}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
