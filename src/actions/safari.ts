"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { blockIfInCombat } from "@/lib/battle-lock";
import { weekKey } from "@/lib/events/time";
import { getMovesetForLevel } from "@/lib/moveset";
import { calculateMaxHp, unspentPointsForLevel, xpForLevel } from "@/lib/stats";
import {
  SAFARI_BALLS_PER_RUN,
  SAFARI_ENCOUNTERS_PER_RUN,
  SAFARI_WEEKLY_RUNS,
  rollSafariCatch,
  rollSafariSpawn,
  safariBiome,
  safariCatchScore,
  safariRarity,
  safariReward,
} from "@/lib/safari";
import type { Prisma } from "@/generated/prisma/client";

export type SafariActionError =
  | "unauthorized"
  | "invalid_biome"
  | "active_run"
  | "no_attempts"
  | "no_run"
  | "encounter_pending"
  | "no_encounter"
  | "no_balls"
  | "finished";

export type SafariActionResult =
  | { ok: true; caught?: boolean; score?: number; finished?: boolean }
  | { ok: false; error: SafariActionError };

async function safariUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

function refreshSafari(locale: string) {
  revalidatePath(`/${locale}/safari`);
  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/pokedex`);
  revalidatePath(`/${locale}`);
}

async function finishRunInTx(
  tx: Prisma.TransactionClient,
  run: { id: string; userId: string; weekKey: string; bestScore: number; status: string },
) {
  if (run.status !== "ACTIVE") return safariReward(run.bestScore);
  const reward = safariReward(run.bestScore);
  await tx.safariRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      encounterSpeciesId: null,
      encounterLevel: null,
      encounterIsShiny: false,
      rewardCoins: reward.coins,
      rewardGems: reward.gems,
      endedAt: new Date(),
    },
  });
  await tx.user.update({
    where: { id: run.userId },
    data: {
      coins: { increment: reward.coins },
      gems: { increment: reward.gems },
    },
  });
  await tx.rewardLedger.create({
    data: {
      userId: run.userId,
      source: "safari",
      sourceRef: `${run.weekKey}:${run.id}`,
      payload: { coins: reward.coins, gems: reward.gems, score: run.bestScore, tier: reward.tier },
    },
  });
  return reward;
}

export async function startSafariRun(
  locale: string,
  biomeId: string,
): Promise<SafariActionResult> {
  const userId = await safariUserId();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!safariBiome(biomeId)) return { ok: false, error: "invalid_biome" };
  if (await blockIfInCombat(userId, locale)) return { ok: false, error: "active_run" };

  let result: SafariActionResult = { ok: true };
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    const active = await tx.safariRun.findFirst({ where: { userId, status: "ACTIVE" } });
    if (active) {
      result = { ok: false, error: "active_run" };
      return;
    }
    const currentWeek = weekKey();
    const used = await tx.safariRun.count({ where: { userId, weekKey: currentWeek } });
    if (used >= SAFARI_WEEKLY_RUNS) {
      result = { ok: false, error: "no_attempts" };
      return;
    }
    await tx.safariRun.create({
      data: {
        userId,
        weekKey: currentWeek,
        biomeId,
        ballsRemaining: SAFARI_BALLS_PER_RUN,
      },
    });
  });
  refreshSafari(locale);
  return result;
}

export async function searchSafariEncounter(locale: string): Promise<SafariActionResult> {
  const userId = await safariUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  let result: SafariActionResult = { ok: true };
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    const run = await tx.safariRun.findFirst({ where: { userId, status: "ACTIVE" } });
    if (!run) {
      result = { ok: false, error: "no_run" };
      return;
    }
    if (run.encounterSpeciesId != null) {
      result = { ok: false, error: "encounter_pending" };
      return;
    }
    if (run.encountersUsed >= SAFARI_ENCOUNTERS_PER_RUN || run.ballsRemaining <= 0) {
      await finishRunInTx(tx, run);
      result = { ok: true, finished: true };
      return;
    }
    const biome = safariBiome(run.biomeId);
    if (!biome) {
      result = { ok: false, error: "invalid_biome" };
      return;
    }
    const spawn = rollSafariSpawn(biome);
    await tx.safariRun.update({
      where: { id: run.id },
      data: {
        encountersUsed: { increment: 1 },
        encounterSpeciesId: spawn.speciesId,
        encounterLevel: spawn.level,
        encounterIsShiny: spawn.isShiny,
      },
    });
    await tx.pokedexEntry.createMany({
      data: [{ userId, speciesId: spawn.speciesId }],
      skipDuplicates: true,
    });
  });
  refreshSafari(locale);
  return result;
}

export async function skipSafariEncounter(locale: string): Promise<SafariActionResult> {
  const userId = await safariUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  let result: SafariActionResult = { ok: true };
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    const run = await tx.safariRun.findFirst({ where: { userId, status: "ACTIVE" } });
    if (!run) {
      result = { ok: false, error: "no_run" };
      return;
    }
    if (run.encounterSpeciesId == null) {
      result = { ok: false, error: "no_encounter" };
      return;
    }
    await tx.safariRun.update({
      where: { id: run.id },
      data: { encounterSpeciesId: null, encounterLevel: null, encounterIsShiny: false },
    });
    if (run.encountersUsed >= SAFARI_ENCOUNTERS_PER_RUN) {
      await finishRunInTx(tx, run);
      result = { ok: true, finished: true };
    }
  });
  refreshSafari(locale);
  return result;
}

export async function throwSafariBall(locale: string): Promise<SafariActionResult> {
  const userId = await safariUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const snapshot = await prisma.safariRun.findFirst({
    where: { userId, status: "ACTIVE", encounterSpeciesId: { not: null } },
    include: { encounterSpecies: true },
  });
  if (!snapshot?.encounterSpecies || snapshot.encounterLevel == null) {
    return { ok: false, error: "no_encounter" };
  }
  const moveIds = await getMovesetForLevel(snapshot.encounterSpeciesId!, snapshot.encounterLevel);
  const moves = await prisma.move.findMany({ where: { id: { in: moveIds } } });

  let result: SafariActionResult = { ok: false, error: "no_encounter" };
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    const run = await tx.safariRun.findFirst({
      where: { id: snapshot.id, userId, status: "ACTIVE" },
      include: { encounterSpecies: true },
    });
    if (!run?.encounterSpecies || run.encounterLevel == null) {
      result = { ok: false, error: "no_encounter" };
      return;
    }
    if (
      run.encounterSpeciesId !== snapshot.encounterSpeciesId ||
      run.encounterLevel !== snapshot.encounterLevel
    ) {
      result = { ok: false, error: "no_encounter" };
      return;
    }
    if (run.ballsRemaining <= 0) {
      result = { ok: false, error: "no_balls" };
      return;
    }

    const rarity = safariRarity(run.biomeId, run.encounterSpecies.id);
    const caught = rollSafariCatch(run.encounterSpecies.captureRate, rarity);
    const ballsRemaining = run.ballsRemaining - 1;

    if (!caught) {
      const shouldFinish = ballsRemaining <= 0;
      await tx.safariRun.update({
        where: { id: run.id },
        data: { ballsRemaining },
      });
      if (shouldFinish) await finishRunInTx(tx, run);
      result = { ok: true, caught: false, finished: shouldFinish };
      return;
    }

    const score = safariCatchScore({
      rarity,
      level: run.encounterLevel,
      captureRate: run.encounterSpecies.captureRate,
      isShiny: run.encounterIsShiny,
    });
    const maxHp = calculateMaxHp(run.encounterSpecies.baseHp, run.encounterLevel);
    const instance = await tx.pokemonInstance.create({
      data: {
        ownerId: userId,
        speciesId: run.encounterSpecies.id,
        level: run.encounterLevel,
        xp: xpForLevel(run.encounterLevel),
        currentHp: maxHp,
        teamSlot: null,
        isShiny: run.encounterIsShiny,
        unspentPoints: unspentPointsForLevel(run.encounterLevel),
        moves: {
          create: moveIds.map((moveId, index) => ({
            moveId,
            slot: index + 1,
            currentPp: moves.find((move) => move.id === moveId)?.pp ?? 20,
          })),
        },
      },
    });
    await tx.safariCatch.create({
      data: {
        runId: run.id,
        pokemonInstanceId: instance.id,
        speciesId: run.encounterSpecies.id,
        level: run.encounterLevel,
        isShiny: run.encounterIsShiny,
        score,
      },
    });
    const isBest = score > run.bestScore;
    await tx.safariRun.update({
      where: { id: run.id },
      data: {
        ballsRemaining,
        catches: { increment: 1 },
        encounterSpeciesId: null,
        encounterLevel: null,
        encounterIsShiny: false,
        ...(isBest
          ? {
              bestScore: score,
              bestSpeciesId: run.encounterSpecies.id,
              bestLevel: run.encounterLevel,
              bestIsShiny: run.encounterIsShiny,
            }
          : {}),
      },
    });
    await tx.pokedexEntry.createMany({
      data: [{ userId, speciesId: run.encounterSpecies.id }],
      skipDuplicates: true,
    });
    const shouldFinish =
      ballsRemaining <= 0 || run.encountersUsed >= SAFARI_ENCOUNTERS_PER_RUN;
    if (shouldFinish) {
      await finishRunInTx(tx, {
        ...run,
        bestScore: Math.max(run.bestScore, score),
      });
    }
    result = { ok: true, caught: true, score, finished: shouldFinish };
  });
  refreshSafari(locale);
  return result;
}

export async function finishSafariRun(locale: string): Promise<SafariActionResult> {
  const userId = await safariUserId();
  if (!userId) return { ok: false, error: "unauthorized" };
  let result: SafariActionResult = { ok: true, finished: true };
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    const run = await tx.safariRun.findFirst({ where: { userId, status: "ACTIVE" } });
    if (!run) {
      result = { ok: false, error: "no_run" };
      return;
    }
    await finishRunInTx(tx, run);
  });
  refreshSafari(locale);
  return result;
}
