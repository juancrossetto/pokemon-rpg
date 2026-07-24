import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { typeColor } from "@/lib/type-colors";
import { typeIcon } from "@/lib/type-icons";
import { gymBadgeImageUrl } from "@/lib/gym-art";
import { computeGymStatuses } from "@/lib/gym-status";

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

  const statuses = await computeGymStatuses(session.user.id);

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-6">
          <div>
            <h1 className="text-headline-lg md:text-display-lg text-white mb-1">{t("title")}</h1>
            <p className="text-label-md text-on-surface-variant">{t("subtitle")}</p>
          </div>
          <Link
            href="/gyms/map"
            className="flex items-center gap-2 self-start rounded-lg border border-white/10 px-4 py-2 text-label-md text-on-surface hover:border-pokeball-red/50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            {t("viewMap")}
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {statuses.map(({ gym, badgeEarned, locked, onCooldown, hoursLeft }) => {
            const color = typeColor(gym.type);

            const cardContent = (
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 border-2"
                  style={{ backgroundColor: `${color}22`, borderColor: color }}
                >
                  <span className="material-symbols-outlined text-[28px]" style={{ color }}>
                    {typeIcon(gym.type)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-label-sm text-on-surface-variant">#{gym.order}</span>
                    <h2 className="text-headline-md text-on-surface leading-tight">{gym.name}</h2>
                  </div>
                  <p className="text-label-md text-on-surface-variant">{t("leaderLabel", { name: gym.leaderName })}</p>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-label-sm text-on-surface-variant">{t("team")}:</span>
                    <div className="flex -space-x-2">
                      {gym.team.map((member) => (
                        <div
                          key={member.id}
                          className="w-8 h-8 rounded-full bg-surface-container-high border border-white/20 overflow-hidden"
                          title={`${member.species.name} Nv. ${member.level}`}
                        >
                          {member.species.spriteUrl && (
                            <Image
                              src={member.species.spriteUrl}
                              alt={member.species.name}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0 w-40 text-right">
                  <span className="text-label-sm text-tertiary">{t("coinReward", { coins: gym.coinReward })}</span>
                  {badgeEarned ? (
                    <span className="flex items-center gap-1 text-label-sm text-tertiary">
                      <Image src={gymBadgeImageUrl(gym.type)} alt={gym.badgeName} width={18} height={18} />
                      {gym.badgeName}
                    </span>
                  ) : locked ? (
                    <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-[18px]">lock</span>
                      {t("locked")}
                    </span>
                  ) : onCooldown ? (
                    <span className="text-label-sm text-error">{t("cooldownHint", { hours: hoursLeft })}</span>
                  ) : (
                    <span className="text-label-sm text-pokeball-red font-bold">{t("challenge")} →</span>
                  )}
                </div>
              </div>
            );

            const cardClass = `bg-glass-surface backdrop-blur-xl rounded-xl p-4 border ${
              badgeEarned ? "border-tertiary/50" : "border-white/10"
            } ${locked ? "opacity-60" : "hover:border-pokeball-red/50 transition-colors"}`;

            return locked ? (
              <article key={gym.id} className={cardClass}>
                {cardContent}
              </article>
            ) : (
              <Link key={gym.id} href={`/gyms/${gym.id}`} className={`block ${cardClass}`}>
                {cardContent}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
