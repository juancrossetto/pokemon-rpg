import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  GymChallengeCorridor,
  type CorridorTrainer,
} from "@/components/gym-challenge-corridor";
import {
  gymBadgeImageUrl,
  gymDifficultyStars,
  gymLeaderImageUrl,
  gymLeaderPortraitUrl,
} from "@/lib/gym-art";
import {
  encounterDifficulty,
  subordinateReward,
  trainerClassFromName,
  trainerSpriteSlugFromName,
} from "@/lib/gym-corridor-theme";
import { showdownTrainerSpriteUrl } from "@/lib/avatars";
import { GYM_TM_REWARD_BY_TYPE } from "@/lib/gym-tm-rewards";
import { GYM_BATTLE_ENERGY_COST, getCurrentEnergy } from "@/lib/energy";

const TYPE_KEYS = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;

export default async function GymRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; gymId: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const [{ locale, gymId }, { err }] = await Promise.all([params, searchParams]);
  const [t, tDex, session] = await Promise.all([
    getTranslations("gyms"),
    getTranslations("pokedex"),
    auth(),
  ]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  const [run, user] = await Promise.all([
    prisma.gymRun.findFirst({
      where: { userId, gymId, status: "ACTIVE" },
      include: {
        gym: {
          include: {
            trainers: {
              orderBy: { slot: "asc" },
              include: {
                team: {
                  orderBy: { slot: "asc" },
                  include: { species: { select: { name: true, spriteUrl: true, types: true } } },
                },
              },
            },
            team: {
              orderBy: { slot: "asc" },
              include: { species: { select: { name: true, spriteUrl: true, types: true } } },
            },
          },
        },
      },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { energy: true, energyMax: true, energyUpdatedAt: true },
    }),
  ]);
  if (!run) {
    redirect({ href: `/gyms/${gymId}`, locale });
    return null;
  }

  const activeBattle = await prisma.battleSession.findFirst({
    where: { gymRunId: run.id, status: "ACTIVE" },
  });
  if (activeBattle) {
    redirect({ href: "/battle", locale });
    return null;
  }

  const { gym } = run;
  const totalSteps = gym.trainers.length + 1;
  const progressPct = Math.round((run.clearedTrainerSlots / totalSteps) * 100);

  const tmMoveName = GYM_TM_REWARD_BY_TYPE[gym.type];
  const tmItem = tmMoveName
    ? await prisma.item.findFirst({
        where: { type: "MACHINE", move: { name: tmMoveName } },
        select: { name: true },
      })
    : null;

  const typeLabels: Record<string, string> = {};
  for (const key of TYPE_KEYS) {
    typeLabels[key] = tDex(`pokemonTypes.${key}`);
  }

  const trainers: CorridorTrainer[] = gym.trainers.map((trainer) => {
    const levels = trainer.team.map((m) => m.level);
    const avg =
      levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / levels.length : 10;
    const rewards = subordinateReward(gym.coinReward, trainer.slot, levels);
    const cleared = trainer.slot <= run.clearedTrainerSlots;
    const current = trainer.slot === run.clearedTrainerSlots + 1;

    return {
      id: trainer.id,
      slot: trainer.slot,
      name: trainer.name,
      trainerClass: trainerClassFromName(trainer.name),
      spriteUrl: showdownTrainerSpriteUrl(trainerSpriteSlugFromName(trainer.name)),
      status: cleared ? "cleared" : current ? "active" : "locked",
      difficulty: encounterDifficulty(avg, gym.order),
      rewardCoins: rewards.coins,
      rewardXp: rewards.xp,
      team: trainer.team.map((m) => ({
        name: m.species.name,
        level: m.level,
        spriteUrl: m.species.spriteUrl,
        types: m.species.types,
      })),
    };
  });

  const leaderTeam = gym.team.map((m) => ({
    name: m.species.name,
    level: m.level,
    spriteUrl: m.species.spriteUrl,
    types: m.species.types,
  }));

  const energy = getCurrentEnergy(user.energy, user.energyMax, user.energyUpdatedAt);
  const canAffordBattle = energy >= GYM_BATTLE_ENERGY_COST;

  return (
    <GymChallengeCorridor
      gymRunId={run.id}
      locale={locale}
      gymName={gym.name}
      leaderName={gym.leaderName}
      badgeName={gym.badgeName}
      gymType={gym.type}
      badgeUrl={gymBadgeImageUrl(gym.type)}
      coinReward={gym.coinReward}
      tmRewardName={tmItem?.name ?? null}
      portraitUrl={gymLeaderPortraitUrl(gym.leaderName)}
      leaderSpriteUrl={gymLeaderImageUrl(gym.leaderName)}
      leaderTeam={leaderTeam}
      leaderDifficulty={gymDifficultyStars(gym.order)}
      trainers={trainers}
      clearedSlots={run.clearedTrainerSlots}
      progressPct={progressPct}
      energy={energy}
      energyCost={GYM_BATTLE_ENERGY_COST}
      canAffordBattle={canAffordBattle}
      energyError={err === "no_energy"}
      leadError={err === "fainted_lead"}
      labels={{
        title: t("corridorTitle"),
        target: t("corridorTarget", { name: gym.leaderName }),
        progress: t("progressLabel"),
        warning: t("corridorWarning"),
        specialty: t("corridorSpecialty"),
        team: t("enemyTeam"),
        reward: t("targetReward"),
        status: t("corridorStatus"),
        nextChallenge: t("corridorNextChallenge"),
        completed: t("corridorCompleted"),
        noLosses: t("corridorNoLosses"),
        bonus: t("corridorBonus"),
        accumulated: t("corridorAccumulated"),
        // Plantillas con placeholders: se interpolan en el cliente.
        // `t()` exige las vars ICU; `t.raw()` devuelve el string sin formatear.
        coins: t.raw("corridorCoins"),
        xp: t.raw("corridorXp"),
        finalReward: t("corridorFinalReward"),
        badge: t("corridorBadge"),
        leader: t("corridorLeader"),
        leaderUnknown: t("corridorLeaderUnknown"),
        teamUnknown: t("corridorTeamUnknown"),
        leaderQuote: t("corridorLeaderQuote"),
        difficulty: t("difficulty"),
        initiateCombat: t("initiateCombat"),
        statusCleared: t("statusCleared"),
        statusPending: t("statusPending"),
        statusLocked: t("statusLocked"),
        leaderLockedHint: t("leaderLockedHint"),
        room: t.raw("corridorRoom"),
        lastBeforeLeader: t("corridorLastBeforeLeader"),
        leaderChamber: t("corridorLeaderChamber"),
        entry: t("corridorEntry"),
        subordinate: t.raw("subordinate"),
        energyCostHint: t("corridorEnergyCost", { cost: GYM_BATTLE_ENERGY_COST }),
        noEnergy: t("corridorNoEnergy"),
        faintedLead: t("corridorFaintedLead"),
        typeLabels,
        exit: {
          emergencyExit: t("emergencyExit"),
          warningTitle: t("warningTitle"),
          warningBody: t("warningBody"),
          confirmExit: t("confirmExit"),
          returnToChallenge: t("returnToChallenge"),
        },
      }}
    />
  );
}
