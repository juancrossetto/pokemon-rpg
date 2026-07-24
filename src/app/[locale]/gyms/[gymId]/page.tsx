import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { typeColor } from "@/lib/type-colors";
import { typeIcon } from "@/lib/type-icons";
import { gymBadgeImageUrl, gymLeaderImageUrl } from "@/lib/gym-art";
import { nowMs } from "@/lib/time";
import { StartGymRunButton } from "@/components/start-gym-run-button";

export default async function GymLeaderPage({
  params,
}: {
  params: Promise<{ locale: string; gymId: string }>;
}) {
  const { locale, gymId } = await params;
  const [t, tBattle, session] = await Promise.all([
    getTranslations("gyms"),
    getTranslations("battle.errors"),
    auth(),
  ]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    include: {
      team: { orderBy: { slot: "asc" }, include: { species: true } },
      trainers: { orderBy: { slot: "asc" }, include: { team: true } },
    },
  });
  if (!gym) redirect({ href: "/gyms", locale });
  if (!gym) return null;

  const [badge, previousBadge, activeRun, lastAttempt] = await Promise.all([
    prisma.badge.findUnique({ where: { userId_gymId: { userId, gymId } } }),
    gym.order > 1
      ? prisma.badge.findFirst({ where: { userId, gym: { order: gym.order - 1 } } })
      : Promise.resolve(true),
    prisma.gymRun.findFirst({ where: { userId, gymId, status: "ACTIVE" } }),
    prisma.gymAttempt.findFirst({ where: { userId, gymId }, orderBy: { attemptedAt: "desc" } }),
  ]);

  const locked = gym.order > 1 && !previousBadge;
  const cooldownMs = gym.cooldownHours * 60 * 60 * 1000;
  const elapsedMs = lastAttempt ? nowMs() - lastAttempt.attemptedAt.getTime() : Infinity;
  const onCooldown = !badge && !!lastAttempt && !lastAttempt.won && elapsedMs < cooldownMs;
  const hoursLeft = onCooldown ? Math.ceil((cooldownMs - elapsedMs) / (60 * 60 * 1000)) : 0;

  const color = typeColor(gym.type);
  const leaderImage = gymLeaderImageUrl(gym.leaderName);
  const levels = gym.team.map((p) => p.level);
  const minLevel = Math.min(...levels);
  const maxLevel = Math.max(...levels);

  const errors = {
    no_lead: tBattle("noLead"),
    fainted_lead: tBattle("faintedLead"),
    locked: t("lockedHint"),
    on_cooldown: t("cooldownHint", { hours: hoursLeft }),
  };

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-label-sm uppercase text-on-surface-variant mb-1">{t("leaderAnalysis")}</p>
        <h1 className="text-headline-lg md:text-display-lg text-white mb-6">{gym.name}</h1>

        <div className="glass-panel rounded-xl border border-white/10 p-6 mb-4 flex items-center gap-4">
          {leaderImage ? (
            <div
              className="w-20 h-24 rounded-lg overflow-hidden shrink-0 border-2"
              style={{ borderColor: color, boxShadow: `0 0 16px ${color}44` }}
            >
              <Image src={leaderImage} alt={gym.leaderName} width={80} height={96} className="w-full h-full object-cover object-top" />
            </div>
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 border-2"
              style={{ backgroundColor: `${color}22`, borderColor: color }}
            >
              <span className="material-symbols-outlined text-[40px]" style={{ color }}>
                {typeIcon(gym.type)}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-headline-md text-on-surface">{gym.leaderName}</h2>
            <p className="text-label-md" style={{ color }}>
              {t("primaryType", { type: gym.type })}
            </p>
            <p className="text-label-sm text-on-surface-variant mt-1">{t("threatLevel", { min: minLevel, max: maxLevel })}</p>
          </div>
        </div>

        <div className="glass-panel rounded-xl border border-white/10 p-4 mb-4">
          <p className="text-label-sm uppercase text-on-surface-variant mb-3">{t("detectedSquad")}</p>
          <div className="flex flex-col gap-2">
            {gym.team.map((member) => (
              <div key={member.id} className="flex items-center gap-3 bg-surface-container-low p-2 rounded border border-white/5">
                <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden shrink-0">
                  {member.species.spriteUrl && (
                    <Image src={member.species.spriteUrl} alt={member.species.name} width={40} height={40} className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="text-label-md text-on-surface capitalize flex-1">{member.species.name}</span>
                <span className="text-label-sm text-on-surface-variant">{t("levelLabel", { level: member.level })}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-xl border border-white/10 p-4 mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-on-surface-variant">groups</span>
          <p className="text-label-md text-on-surface-variant">{t("trainerCount", { count: gym.trainers.length })}</p>
        </div>

        <div className="glass-panel rounded-xl border border-tertiary/40 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src={gymBadgeImageUrl(gym.type)} alt={gym.badgeName} width={40} height={40} className="shrink-0" />
            <div>
              <p className="text-label-sm uppercase text-on-surface-variant">{t("targetReward")}</p>
              <p className="text-headline-md text-on-surface">{gym.badgeName}</p>
            </div>
          </div>

          {badge ? (
            <span className="flex items-center gap-1 text-label-md text-tertiary">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {t("badgeEarned")}
            </span>
          ) : locked ? (
            <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">lock</span>
              {t("locked")}
            </span>
          ) : activeRun ? (
            <Link
              href={`/gyms/${gymId}/run`}
              className="flex items-center gap-2 rounded-lg bg-pokeball-red px-6 py-3 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              {t("continueRun", { cleared: activeRun.clearedTrainerSlots, total: gym.trainers.length })}
            </Link>
          ) : (
            <StartGymRunButton gymId={gymId} locale={locale} label={t("startChallenge")} errors={errors} />
          )}
        </div>
      </div>
    </div>
  );
}
