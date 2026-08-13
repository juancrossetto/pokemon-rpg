import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { typeColor } from "@/lib/type-colors";
import { typeIcon } from "@/lib/type-icons";
import { gymBadgeImageUrl, gymLeaderPortraitUrl } from "@/lib/gym-art";
import { nowMs } from "@/lib/time";
import { StartGymRunButton } from "@/components/start-gym-run-button";
import { SkipGymCooldownButton } from "@/components/skip-gym-cooldown-button";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { formatGymCooldown, gymCooldownRemainingMs } from "@/lib/gym-cooldown";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import {
  areChapterStagesCompleteForGym,
  canChallengeGym,
  countTeamReadyAtLevel,
  GYM_READY_TEAM_SIZE,
  gymReadyLevel,
} from "@/lib/campaign";
import { regionDef } from "@/lib/regions";
import { gymBattleEnergyCost } from "@/lib/energy";
import type { ReactNode } from "react";

function TeamNotReadyBanner({
  title,
  leadOk,
  leadLabel,
  depthOk,
  depthLabel,
  ctaLabel,
}: {
  title: string;
  leadOk: boolean;
  leadLabel: string;
  depthOk: boolean;
  depthLabel: string;
  ctaLabel: string;
}): ReactNode {
  return (
    <div
      role="status"
      className="w-full rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2.5 text-left shadow-[0_0_24px_rgba(251,191,36,0.12)] sm:px-4"
    >
      <div className="flex items-start gap-2 sm:items-center sm:gap-3">
        <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px]! text-amber-300 sm:mt-0">
          warning
        </span>
        <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
          <p className="text-[12px] font-semibold text-amber-100 sm:shrink-0 sm:text-[13px]">
            {title}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 sm:mt-0 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1">
            <li
              className={`flex items-center gap-1.5 text-[11px] leading-snug ${
                leadOk ? "text-emerald-300/90" : "text-amber-100/80"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]!">
                {leadOk ? "check_circle" : "radio_button_unchecked"}
              </span>
              {leadLabel}
            </li>
            <li
              className={`flex items-center gap-1.5 text-[11px] leading-snug ${
                depthOk ? "text-emerald-300/90" : "text-amber-100/80"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]!">
                {depthOk ? "check_circle" : "radio_button_unchecked"}
              </span>
              {depthLabel}
            </li>
          </ul>
          <Link
            href="/battle"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-200/95 underline-offset-2 hover:underline sm:ml-auto sm:mt-0 sm:shrink-0"
          >
            <span className="material-symbols-outlined text-[14px]!">explore</span>
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function GymLeaderPage({
  params,
}: {
  params: Promise<{ locale: string; gymId: string }>;
}) {
  const { locale, gymId } = await params;
  const [t, tBattle, tTypes, session] = await Promise.all([
    getTranslations("gyms"),
    getTranslations("battle.errors"),
    getTranslations("pokedex.pokemonTypes"),
    auth(),
  ]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;
  await redirectIfInBattle(userId, locale);

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    include: {
      team: { orderBy: { slot: "asc" }, include: { species: true } },
      trainers: { orderBy: { slot: "asc" }, include: { team: true } },
    },
  });
  if (!gym) redirect({ href: "/gyms", locale });
  if (!gym) return null;

  const region = regionDef(gym.regionId);
  if (!region.playable || !region.gymsAvailable) {
    redirect({ href: "/gyms", locale });
    return null;
  }

  const [badge, previousBadge, activeRun, lastAttempt, user, progress, teamRows] =
    await Promise.all([
      prisma.badge.findUnique({ where: { userId_gymId: { userId, gymId } } }),
      gym.order > 1
        ? prisma.badge.findFirst({
            where: { userId, gym: { order: gym.order - 1, regionId: gym.regionId } },
          })
        : Promise.resolve(true),
      prisma.gymRun.findFirst({ where: { userId, gymId, status: "ACTIVE" } }),
      prisma.gymAttempt.findFirst({ where: { userId, gymId }, orderBy: { attemptedAt: "desc" } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { gems: true } }),
      ensureCampaignProgress(userId),
      prisma.pokemonInstance.findMany({
        where: { ownerId: userId, teamSlot: { not: null } },
        select: { level: true },
      }),
    ]);

  const locked = gym.order > 1 && !previousBadge;
  const stagesIncomplete =
    !badge &&
    !areChapterStagesCompleteForGym(
      gym.order,
      progress.completedStageIds,
      gym.regionId,
    );
  const remainingMs =
    !badge && lastAttempt && !lastAttempt.won
      ? gymCooldownRemainingMs({
          cooldownHours: gym.cooldownHours,
          attemptedAt: lastAttempt.attemptedAt,
          now: nowMs(),
        })
      : 0;
  const onCooldown = remainingMs > 0;
  const hoursLeft = onCooldown ? Math.ceil(remainingMs / (60 * 60 * 1000)) : 0;

  const color = typeColor(gym.type);
  const leaderPortrait = gymLeaderPortraitUrl(gym.leaderName);
  const levels = gym.team.map((p) => p.level);
  const minLevel = Math.min(...levels);
  const maxLevel = Math.max(...levels);
  const typeKey = gym.type.toLowerCase();
  const typeLabel = tTypes.has(typeKey as "fire") ? tTypes(typeKey as "fire") : gym.type;
  const badgeKey = `badges.${gym.order}`;
  const badgeLabel = t.has(badgeKey) ? t(badgeKey) : gym.badgeName;
  const nameKey = `names.${gym.order}`;
  const gymNameLabel = t.has(nameKey) ? t(nameKey) : gym.name;

  // El botón sólo aparece cuando no hay corrida activa, así que el primer
  // combate es contra el pasillo — salvo que el gimnasio no tenga entrenadores.
  const firstBattleEnergyCost = gymBattleEnergyCost(
    gym.trainers.length > 0 ? "trainer" : "leader",
  );

  const recommendedLevel = Math.max(...levels, 1);
  const readyLevel = gymReadyLevel(recommendedLevel);
  const teamLevels = teamRows.map((p) => p.level);
  const teamMaxLevel = Math.max(...teamLevels, 0);
  const teamReadyCount = countTeamReadyAtLevel(teamLevels, readyLevel);
  const teamCanChallenge =
    Boolean(badge) ||
    canChallengeGym(gym.order, progress.completedStageIds, {
      regionId: gym.regionId,
      teamMaxLevel,
      teamReadyCount,
      recommendedLevel,
    });
  const showTeamGate = !badge && !locked && !stagesIncomplete && !teamCanChallenge;

  const errors = {
    no_lead: tBattle("noLead"),
    fainted_lead: tBattle("faintedLead"),
    locked: t("lockedHint"),
    region_locked: t("regionLockedBody"),
    on_cooldown: t("cooldownHint", { time: formatGymCooldown(remainingMs) }),
    closed: t("closedHint"),
    stages_incomplete: t("stagesIncompleteHint"),
    team_not_ready: t("teamNotReadyHint"),
  };

  const teamWarning = showTeamGate ? (
    <TeamNotReadyBanner
      title={t("teamNotReadyTitle")}
      leadOk={teamMaxLevel >= recommendedLevel}
      leadLabel={t("teamNotReadyLead", { leaderLevel: recommendedLevel })}
      depthOk={teamReadyCount >= GYM_READY_TEAM_SIZE}
      depthLabel={t("teamNotReadyDepth", {
        have: teamReadyCount,
        need: GYM_READY_TEAM_SIZE,
        readyLevel,
      })}
      ctaLabel={t("teamNotReadyCta")}
    />
  ) : null;

  const rewardBlock = (
    <div className="flex min-w-0 items-center gap-3">
      <Image src={gymBadgeImageUrl(gym.type)} alt={badgeLabel} width={40} height={40} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-label-sm uppercase text-on-surface-variant">{t("targetReward")}</p>
        <p className="text-headline-md text-on-surface truncate">{badgeLabel}</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-label-sm uppercase text-on-surface-variant mb-1">{t("leaderAnalysis")}</p>
        <h1 className="page-title mb-4 text-headline-lg text-white md:mb-6 md:text-display-lg">{gymNameLabel}</h1>

        {/* Horizontal también en mobile: apilado, el retrato empujaba el nombre
            y el nivel de amenaza fuera de la primera pantalla. */}
        <div className="glass-panel p-3 sm:p-4 mb-4 flex items-center gap-3 sm:gap-4">
          {leaderPortrait ? (
            <div
              className="w-20 h-[104px] sm:w-32 sm:h-40 rounded-xl overflow-hidden shrink-0 border-2 bg-surface-container-high"
              style={{ borderColor: color, boxShadow: `0 0 20px ${color}44` }}
            >
              <Image
                src={leaderPortrait}
                alt={gym.leaderName}
                width={160}
                height={200}
                className="w-full h-full object-cover object-top"
                priority
              />
            </div>
          ) : (
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shrink-0 border-2"
              style={{ backgroundColor: `${color}22`, borderColor: color }}
            >
              <span className="material-symbols-outlined text-[40px]!" style={{ color }}>
                {typeIcon(gym.type)}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-headline-md text-on-surface truncate">{gym.leaderName}</h2>
            <p className="text-label-md" style={{ color }}>
              {t("primaryType", { type: typeLabel })}
            </p>
            <p className="text-label-sm text-on-surface-variant mt-1">{t("threatLevel", { min: minLevel, max: maxLevel })}</p>
          </div>
        </div>

        <div className="glass-panel p-3 sm:p-4 mb-4">
          <p className="text-label-sm uppercase text-on-surface-variant mb-2 sm:mb-3">{t("detectedSquad")}</p>
          <div className="flex flex-col gap-1.5 sm:gap-2">
            {gym.team.map((member) => (
              <div key={member.id} className="flex items-center gap-2.5 bg-surface-container-low p-1.5 sm:p-2 rounded border border-white/5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-surface-container-high overflow-hidden shrink-0">
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

        <div className="glass-panel p-3 sm:p-4 mb-4 sm:mb-6 flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px]! sm:text-[24px]! text-on-surface-variant shrink-0">
            groups
          </span>
          {/* `text-label-md` fijo y no `sm:text-label-md`: la escala custom no
              genera variantes responsive (ver nota en gym-card.tsx). */}
          <p className="text-label-md text-on-surface-variant">
            {t("trainerCount", { count: gym.trainers.length })}
          </p>
        </div>

        {/* Recompensa + CTA; Equipo no listo queda en la card. El popup es el hint al iniciar. */}
        <div className="glass-panel border-tertiary/40 p-3 sm:p-6">
          {(() => {
            if (badge) {
              return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  {rewardBlock}
                  <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                    <span className="flex items-center gap-1 self-start text-label-md text-tertiary sm:self-end">
                      <span className="material-symbols-outlined text-[18px]!">check_circle</span>
                      {t("badgeEarned")}
                    </span>
                    {!locked && !activeRun && (
                      <>
                        <p className="max-w-full text-label-sm text-on-surface-variant sm:max-w-[220px] sm:text-right">{t("rematchHint")}</p>
                        <StartGymRunButton
                          gymId={gymId}
                          locale={locale}
                          label={t("rematch")}
                          energyCost={firstBattleEnergyCost}
                          errors={errors}
                        />
                      </>
                    )}
                    {activeRun && (
                      <Link
                        href={`/gyms/${gymId}/run`}
                        className="game-cta game-cta--red w-full sm:w-auto"
                      >
                        <span className="material-symbols-outlined game-cta__icon">play_arrow</span>
                        <span className="game-cta__label">
                          {t("continueRun", {
                            cleared: activeRun.clearedTrainerSlots,
                            total: gym.trainers.length,
                          })}
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            }

            if (locked) {
              return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  {rewardBlock}
                  <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]!">lock</span>
                    {t("locked")}
                  </span>
                </div>
              );
            }

            if (stagesIncomplete) {
              return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  {rewardBlock}
                  <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                    <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
                      <span className="material-symbols-outlined text-[18px]!">hiking</span>
                      {t("stagesIncomplete")}
                    </span>
                    <p className="max-w-full text-label-sm text-on-surface-variant/80 sm:max-w-[260px] sm:text-right">
                      {t("stagesIncompleteHint")}
                    </p>
                    <Link
                      href="/campaign"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-label-sm font-semibold text-on-surface transition hover:bg-white/10"
                    >
                      <span className="material-symbols-outlined text-[16px]!">map</span>
                      {t("goToCampaign")}
                    </Link>
                  </div>
                </div>
              );
            }

            if (activeRun) {
              return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  {rewardBlock}
                  <Link
                    href={`/gyms/${gymId}/run`}
                    className="game-cta game-cta--red w-full sm:w-auto"
                  >
                    <span className="material-symbols-outlined game-cta__icon">play_arrow</span>
                    <span className="game-cta__label">
                      {t("continueRun", { cleared: activeRun.clearedTrainerSlots, total: gym.trainers.length })}
                    </span>
                  </Link>
                </div>
              );
            }

            if (onCooldown) {
              return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  {rewardBlock}
                  <SkipGymCooldownButton
                    gymId={gymId}
                    hoursLeft={hoursLeft}
                    remainingMs={remainingMs}
                    gems={user.gems}
                  />
                </div>
              );
            }

            return (
              <StartGymRunButton
                gymId={gymId}
                locale={locale}
                label={t("startChallenge")}
                energyCost={firstBattleEnergyCost}
                errors={errors}
                warning={teamWarning}
              >
                {rewardBlock}
              </StartGymRunButton>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
