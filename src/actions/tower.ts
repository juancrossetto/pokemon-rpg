"use server";

import { redirect } from "@/i18n/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { blockIfInCombat, revalidateCombatUi } from "@/lib/battle-lock";
import {
  COMBAT_TOWER_CONFIG,
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_TOWER_ID,
  buildTowerTeamSnapshot,
  isTowerUnlocked,
  livingCount,
  parseTowerTeamSnapshot,
  primeTeamForTowerRun,
  TOWER_TEAM_INCLUDE,
  abandonTowerRunInTx,
  applyHealToSnapshot,
  applyRestRecovery,
  applyReviveOne,
  applySnapshotHpToInstances,
  getBlessing,
  getTowerFloor,
  pickBlessingOffers,
  towerTeamSnapshotJson,
} from "@/lib/tower";
import {
  consumeTowerAttemptInTx,
  getTowerAttemptState,
  reconcileTowerPeriodAttempts,
} from "@/lib/tower/attempts";
import { mergeBundles } from "@/lib/tower/loot";
import {
  buildFloorRewardBundle,
  parsePendingLoot,
  claimTowerRunLootInTx,
} from "@/lib/tower/settle";
import { scaleEnemyForFloor } from "@/lib/tower/scaling";
import { getMovesetForLevel } from "@/lib/moveset";
import { currentSeasonKey } from "@/lib/pvp/seasons";

async function requireUser(locale: string) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  return session.user.id;
}

export async function startTowerRun(locale: string, difficultyId = DEFAULT_DIFFICULTY_ID) {
  const userId = await requireUser(locale);
  if (!userId) return;

  if (await blockIfInCombat(userId, locale)) return;

  const difficulty = COMBAT_TOWER_CONFIG.difficulties.find((d) => d.id === difficultyId);
  if (!difficulty?.playable) {
    redirect({ href: "/tower?err=difficulty", locale });
    return;
  }

  const badgeCount = await prisma.badge.count({ where: { userId } });
  if (!isTowerUnlocked(badgeCount)) {
    redirect({ href: "/tower?err=locked", locale });
    return;
  }

  await reconcileTowerPeriodAttempts(userId);

  const existing = await prisma.towerRun.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "AWAITING_BLESSING", "RESTING"] },
    },
  });
  if (existing) {
    redirect({ href: "/tower", locale });
    return;
  }

  const attemptState = await getTowerAttemptState(userId);
  if (attemptState.attemptsRemaining <= 0) {
    redirect({ href: "/tower?err=no_attempts", locale });
    return;
  }

  const teamRows = await prisma.pokemonInstance.findMany({
    where: { ownerId: userId, teamSlot: { not: null } },
    include: TOWER_TEAM_INCLUDE,
    orderBy: { teamSlot: "asc" },
  });
  if (teamRows.length === 0) {
    redirect({ href: "/tower?err=no_team", locale });
    return;
  }

  const snapshot = buildTowerTeamSnapshot(teamRows);
  if (livingCount(snapshot) === 0) {
    redirect({ href: "/tower?err=no_team", locale });
    return;
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await lockUsers(tx, userId);
        await consumeTowerAttemptInTx(tx, userId);

        const seasonKey = currentSeasonKey();
        await tx.towerProgress.upsert({
          where: {
            userId_towerId_difficultyId: {
              userId,
              towerId: DEFAULT_TOWER_ID,
              difficultyId,
            },
          },
          create: {
            userId,
            towerId: DEFAULT_TOWER_ID,
            difficultyId,
            seasonKey,
            highestFloorAllTime: 0,
            highestFloorSeason: 0,
          },
          update: { seasonKey },
        });

        await tx.towerRun.create({
          data: {
            userId,
            towerId: DEFAULT_TOWER_ID,
            difficultyId,
            status: "ACTIVE",
            currentFloor: 1,
            teamSnapshot: towerTeamSnapshotJson(snapshot),
            teamChangesRemaining: COMBAT_TOWER_CONFIG.rules.teamChangesAllowed,
            attemptsConsumed: 1,
            pendingLoot: [],
          },
        });

        await primeTeamForTowerRun(tx, snapshot);
      },
      { timeout: 20_000 },
    );
  } catch {
    redirect({ href: "/tower?err=no_attempts", locale });
    return;
  }

  revalidatePath(`/${locale}/tower`);
  revalidateCombatUi(locale);
  redirect({ href: "/tower", locale });
}

export async function challengeTowerFloor(locale: string) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const existingBattle = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE" },
  });
  if (existingBattle) {
    redirect({ href: "/battle", locale });
    return;
  }

  const run = await prisma.towerRun.findFirst({
    where: { userId, status: "ACTIVE" },
  });
  if (!run) {
    redirect({ href: "/tower?err=no_run", locale });
    return;
  }

  const floor = getTowerFloor(run.currentFloor, run.towerId);
  if (!floor || floor.type === "rest") {
    redirect({ href: "/tower?err=rest_floor", locale });
    return;
  }

  const team = parseTowerTeamSnapshot(run.teamSnapshot);
  if (livingCount(team) === 0) {
    redirect({ href: "/tower?err=team_down", locale });
    return;
  }

  const living = team.filter((m) => !m.defeated && m.currentHp > 0);
  const leadSnap = living[0];
  if (!leadSnap) {
    redirect({ href: "/tower?err=team_down", locale });
    return;
  }

  const enemy = floor.enemies[0];
  if (!enemy) {
    redirect({ href: "/tower?err=no_enemy", locale });
    return;
  }

  // Elite (2 enemigos) + 2+ vivos → batalla doble (Torre).
  const DOUBLES_ENABLED = true;
  const wantDoubles =
    DOUBLES_ENABLED && floor.type === "elite" && floor.enemies.length >= 2 && living.length >= 2;
  const partnerSnap = wantDoubles ? living[1]! : null;
  const enemyB = wantDoubles ? floor.enemies[1]! : null;

  const species = await prisma.species.findUnique({ where: { id: enemy.speciesId } });
  if (!species) {
    redirect({ href: "/tower?err=no_enemy", locale });
    return;
  }

  const scaled = scaleEnemyForFloor({
    floorNumber: floor.floorNumber,
    baseLevel: enemy.level,
    baseHp: species.baseHp,
    hpMult: enemy.hpMult,
  });
  const wildMoveIds = await getMovesetForLevel(enemy.speciesId, scaled.level);
  const wildMoves = await prisma.move.findMany({ where: { id: { in: wildMoveIds } } });
  const wildMovePp = wildMoveIds.map((id) => wildMoves.find((m) => m.id === id)?.pp ?? 20);

  let fieldB: import("@/lib/doubles/field-b").DoublesFieldB | undefined;
  let speciesBName: string | null = null;
  if (wantDoubles && enemyB && partnerSnap) {
    const speciesB = await prisma.species.findUnique({ where: { id: enemyB.speciesId } });
    if (!speciesB) {
      redirect({ href: "/tower?err=no_enemy", locale });
      return;
    }
    speciesBName = speciesB.name;
    const scaledB = scaleEnemyForFloor({
      floorNumber: floor.floorNumber,
      baseLevel: enemyB.level,
      baseHp: speciesB.baseHp,
      hpMult: enemyB.hpMult,
    });
    const wildBMoveIds = await getMovesetForLevel(enemyB.speciesId, scaledB.level);
    const wildBMoves = await prisma.move.findMany({ where: { id: { in: wildBMoveIds } } });
    const wildBMovePp = wildBMoveIds.map((id) => wildBMoves.find((m) => m.id === id)?.pp ?? 20);
    const { buildDoublesFieldB, emptyPlayerBState } = await import("@/lib/doubles/field-b");
    fieldB = buildDoublesFieldB(
      {
        speciesId: enemyB.speciesId,
        level: scaledB.level,
        currentHp: scaledB.maxHp,
        maxHp: scaledB.maxHp,
        moveIds: wildBMoveIds,
        movePp: wildBMovePp,
        isShiny: false,
        status: null,
        sleepTurns: 0,
        atkStage: 0,
        defStage: 0,
        speStage: 0,
        heldItemId: null,
        itemConsumed: false,
        choiceLockMoveId: null,
        chargeMoveId: null,
        chargeTargetLane: null,
      },
      emptyPlayerBState(),
    );
  }

  const log = [
    `towerFloor:${floor.floorNumber}`,
    wantDoubles ? "format:double" : "format:single",
    `sendOut:${species.name}`,
    ...(speciesBName ? [`sendOut:${speciesBName}`] : []),
  ];

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    await applySnapshotHpToInstances(tx, team);
    await tx.battleSession.create({
      data: {
        userId,
        pokemonInstanceId: leadSnap.instanceId,
        pokemonInstanceBId: partnerSnap?.instanceId ?? null,
        format: wantDoubles ? "DOUBLE" : "SINGLE",
        fieldB: fieldB ? (JSON.parse(JSON.stringify(fieldB)) as object) : undefined,
        towerRunId: run.id,
        wildSpeciesId: enemy.speciesId,
        wildLevel: scaled.level,
        wildCurrentHp: scaled.maxHp,
        wildMaxHp: scaled.maxHp,
        wildMoveIds,
        wildMovePp,
        log,
        participantIds: partnerSnap
          ? [leadSnap.instanceId, partnerSnap.instanceId]
          : [leadSnap.instanceId],
      },
    });
  });

  revalidateCombatUi(locale);
  redirect({ href: "/battle", locale });
}

export async function abandonTowerRun(locale: string) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const run = await prisma.towerRun.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "AWAITING_BLESSING", "RESTING"] },
    },
  });
  if (!run) {
    redirect({ href: "/tower", locale });
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      await lockUsers(tx, userId);
      await abandonTowerRunInTx(tx, run.id, userId);
    },
    { timeout: 20_000 },
  );

  revalidatePath(`/${locale}/tower`);
  revalidateCombatUi(locale);
  redirect({ href: "/tower", locale });
}

export async function chooseTowerBlessing(blessingId: string, locale: string) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const run = await prisma.towerRun.findFirst({
    where: { userId, status: "AWAITING_BLESSING" },
  });
  if (!run) {
    redirect({ href: "/tower", locale });
    return;
  }
  if (!run.offeredBlessingIds.includes(blessingId)) {
    redirect({ href: "/tower?err=bad_blessing", locale });
    return;
  }
  const blessing = getBlessing(blessingId);
  if (!blessing) {
    redirect({ href: "/tower?err=bad_blessing", locale });
    return;
  }

  let team = parseTowerTeamSnapshot(run.teamSnapshot);
  const nextBlessings = [...run.blessingIds, blessingId];

  for (const effect of blessing.effects) {
    if (effect.kind === "heal_team_pct") {
      team = applyHealToSnapshot(team, effect.value);
    }
    if (effect.kind === "revive_one_pct") {
      team = applyReviveOne(team, effect.value);
    }
    if (effect.kind === "max_hp_pct") {
      team = team.map((m) => {
        const newMax = Math.max(1, Math.floor(m.maxHp * (1 + effect.value / 100)));
        const ratio = m.maxHp > 0 ? m.currentHp / m.maxHp : 1;
        return {
          ...m,
          maxHp: newMax,
          currentHp: m.defeated ? 0 : Math.min(newMax, Math.max(1, Math.floor(newMax * ratio))),
        };
      });
    }
  }

  const nextFloor = getTowerFloor(run.currentFloor, run.towerId);
  const nextStatus = nextFloor?.type === "rest" ? "RESTING" : "ACTIVE";

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    await tx.towerRun.update({
      where: { id: run.id },
      data: {
        status: nextStatus,
        blessingIds: nextBlessings,
        offeredBlessingIds: [],
        teamSnapshot: towerTeamSnapshotJson(team),
      },
    });
    await applySnapshotHpToInstances(tx, team);
  });

  revalidatePath(`/${locale}/tower`);
  redirect({ href: "/tower", locale });
}

/**
 * Piso de descanso.
 *
 * Antes era un botón único que curaba y avanzaba: entre bendición y bendición
 * el jugador no tomaba ninguna decisión, sólo apretaba "desafiar" cinco veces.
 * Ahora el descanso es una bifurcación con coste de oportunidad real:
 *
 * - `recover`: cura al equipo (lo de siempre) — sobrevivir el próximo tramo.
 * - `attune`:  renuncia a la cura y se lleva una bendición — apostar poder
 *              ahora a cambio de llegar al jefe más golpeado.
 *
 * No necesita columnas nuevas: las dos ramas se resuelven en el acto, la cura
 * sobre el snapshot y la bendición empujada a `blessingIds`.
 */
export type TowerRestChoice = "recover" | "attune";

export async function applyTowerRest(
  locale: string,
  choice: TowerRestChoice = "recover",
) {
  const userId = await requireUser(locale);
  if (!userId) return;

  const run = await prisma.towerRun.findFirst({
    where: { userId, status: { in: ["RESTING", "ACTIVE"] } },
  });
  if (!run) {
    redirect({ href: "/tower", locale });
    return;
  }

  const floor = getTowerFloor(run.currentFloor, run.towerId);
  if (run.status === "ACTIVE" && floor?.type !== "rest") {
    redirect({ href: "/tower?err=not_rest", locale });
    return;
  }

  // `attune` cambia la cura por poder: se pasa 0% de recuperación al snapshot
  // y más abajo se concede una bendición en su lugar.
  const pct = choice === "attune" ? 0 : COMBAT_TOWER_CONFIG.rules.recoveryPercentage;
  const team = applyRestRecovery(parseTowerTeamSnapshot(run.teamSnapshot), pct, true);

  // La bendición se elige acá, fuera de la transacción, para no meter lógica
  // de sorteo adentro del lock. Si el jugador ya tiene todo al máximo,
  // `pickBlessingOffers` viene vacío y la rama degrada a "no gana nada":
  // por eso la UI sólo ofrece `attune` cuando hay algo para ganar.
  const restBlessingId =
    choice === "attune" ? (pickBlessingOffers(run.blessingIds)[0] ?? null) : null;

  // Completar piso rest: recompensas al pendingLoot + avanzar
  const progress = await prisma.towerProgress.findUnique({
    where: {
      userId_towerId_difficultyId: {
        userId,
        towerId: run.towerId,
        difficultyId: run.difficultyId,
      },
    },
  });

  await prisma.$transaction(
    async (tx) => {
      await lockUsers(tx, userId);
      const { firstClearId, bundle } = buildFloorRewardBundle({
        towerId: run.towerId,
        floorNumber: run.currentFloor,
        blessingIds: run.blessingIds,
        claimedFirstClears: progress?.claimedFirstClears ?? [],
      });
      const pendingLoot = mergeBundles([parsePendingLoot(run.pendingLoot), bundle]);

      if (firstClearId && progress) {
        await tx.towerProgress.update({
          where: { id: progress.id },
          data: { claimedFirstClears: [...progress.claimedFirstClears, firstClearId] },
        });
      } else if (firstClearId) {
        await tx.towerProgress.upsert({
          where: {
            userId_towerId_difficultyId: {
              userId,
              towerId: run.towerId,
              difficultyId: run.difficultyId,
            },
          },
          create: {
            userId,
            towerId: run.towerId,
            difficultyId: run.difficultyId,
            seasonKey: currentSeasonKey(),
            claimedFirstClears: [firstClearId],
            highestFloorAllTime: run.currentFloor,
            highestFloorSeason: run.currentFloor,
          },
          update: {},
        });
      }

      const cleared = run.currentFloor;
      const nextFloor = cleared + 1;
      const total = COMBAT_TOWER_CONFIG.totalFloors;
      if (cleared >= total) {
        const { restoreAdventureTeam } = await import("@/lib/tower/team");
        await restoreAdventureTeam(tx, team);
        await tx.towerRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            teamSnapshot: towerTeamSnapshotJson(team),
            pendingLoot,
            endedAt: new Date(),
          },
        });
      } else {
        const earnedIds = restBlessingId
          ? [...run.blessingIds, restBlessingId]
          : run.blessingIds;
        const offers = pickBlessingOffers(earnedIds);
        const offerBlessing = COMBAT_TOWER_CONFIG.blessingOfferFloors.includes(cleared);
        await tx.towerRun.update({
          where: { id: run.id },
          data: {
            status: offerBlessing ? "AWAITING_BLESSING" : "ACTIVE",
            currentFloor: nextFloor,
            teamSnapshot: towerTeamSnapshotJson(team),
            blessingIds: earnedIds,
            offeredBlessingIds: offerBlessing ? offers : [],
            pendingLoot,
          },
        });
        await applySnapshotHpToInstances(tx, team);
      }
    },
    { timeout: 20_000 },
  );

  revalidatePath(`/${locale}/tower`);
  redirect({ href: "/tower", locale });
}

export async function claimTowerLoot(locale: string, runId: string) {
  const userId = await requireUser(locale);
  if (!userId) return;

  try {
    await prisma.$transaction(
      async (tx) => {
        await lockUsers(tx, userId);
        await claimTowerRunLootInTx(tx, { userId, runId });
      },
      { timeout: 20_000 },
    );
  } catch {
    redirect({ href: "/tower?err=bad_blessing", locale });
    return;
  }

  revalidatePath(`/${locale}/tower`);
  revalidatePath(`/${locale}/inventory`);
  revalidateCombatUi(locale);
  redirect({ href: "/tower", locale });
}
