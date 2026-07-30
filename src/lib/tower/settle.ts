import type { Prisma } from "@/generated/prisma/client";
import { grantRewards, writeLedger } from "@/lib/events/grant";
import type { RewardBundle } from "@/lib/events/rewards";
import { COMBAT_TOWER_CONFIG } from "./config";
import {
  applyRestRecovery,
  coinsBlessingMultiplier,
  pickBlessingOffers,
  shouldOfferBlessing,
} from "./blessings";
import { getTowerFloor } from "./floors";
import { mergeBundles } from "./loot";
import {
  parseTowerTeamSnapshot,
  restoreAdventureTeam,
  syncSnapshotFromInstances,
  towerTeamSnapshotJson,
} from "./team";
import type { TowerRunCreature } from "./types";
import { currentSeasonKey } from "@/lib/pvp/seasons";

function scaleBundle(bundle: RewardBundle, mult: number): RewardBundle {
  return bundle.map((r) => {
    if (r.kind === "coins") return { ...r, amount: Math.max(1, Math.round(r.amount * mult)) };
    return r;
  });
}

export function parsePendingLoot(raw: unknown): RewardBundle {
  if (!Array.isArray(raw)) return [];
  return raw as RewardBundle;
}

/** Calcula el botín del piso sin acreditarlo (va a `pendingLoot`). */
export function buildFloorRewardBundle(input: {
  towerId: string;
  floorNumber: number;
  blessingIds: string[];
  claimedFirstClears: string[];
}): { bundle: RewardBundle; claimedFirstClear: boolean; firstClearId: string | null } {
  const floor = getTowerFloor(input.floorNumber, input.towerId);
  if (!floor) return { bundle: [], claimedFirstClear: false, firstClearId: null };

  const coinMult = coinsBlessingMultiplier(input.blessingIds);
  let bundle: RewardBundle = [];
  let claimedFirstClear = false;
  let firstClearId: string | null = null;

  for (const rep of floor.rewards) {
    bundle = bundle.concat(scaleBundle(rep.bundle, coinMult));
  }

  for (const fc of floor.firstClearRewards) {
    if (!input.claimedFirstClears.includes(fc.id)) {
      bundle = bundle.concat(scaleBundle(fc.bundle, coinMult));
      claimedFirstClear = true;
      firstClearId = fc.id;
    }
  }

  return { bundle, claimedFirstClear, firstClearId };
}

/** Acredita un bundle (reclamo de botín del ascenso). */
export async function grantTowerLootBundle(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    towerId: string;
    difficultyId: string;
    runId: string;
    bundle: RewardBundle;
  },
): Promise<RewardBundle> {
  if (input.bundle.length === 0) return [];
  const result = await grantRewards(tx, input.userId, input.bundle);
  await writeLedger(tx, {
    userId: input.userId,
    source: "tower",
    sourceRef: `${input.towerId}:${input.difficultyId}:run:${input.runId}`,
    result,
  });
  return input.bundle;
}

/**
 * @deprecated Preferí `buildFloorRewardBundle` + bank en el run.
 * Se mantiene por compatibilidad con el descanso que aún lo llama vía bank helper.
 */
export async function grantFloorRewards(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    towerId: string;
    difficultyId: string;
    floorNumber: number;
    blessingIds: string[];
    claimedFirstClears: string[];
  },
): Promise<{ bundle: RewardBundle; claimedFirstClear: boolean; firstClearId: string | null }> {
  return buildFloorRewardBundle(input);
}

/**
 * Tras ganar un piso de combate: sync HP, bank de recompensas, avance.
 */
export async function settleTowerFloorWin(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    runId: string;
    instances: { id: string; currentHp: number }[];
  },
): Promise<{ nextStatus: string; nextFloor: number; newRecord: boolean; coinsBanked: number }> {
  const run = await tx.towerRun.findFirstOrThrow({
    where: { id: input.runId, userId: input.userId },
  });
  const clearedFloor = run.currentFloor;
  let team = syncSnapshotFromInstances(parseTowerTeamSnapshot(run.teamSnapshot), input.instances);

  const progress = await tx.towerProgress.findUnique({
    where: {
      userId_towerId_difficultyId: {
        userId: input.userId,
        towerId: run.towerId,
        difficultyId: run.difficultyId,
      },
    },
  });

  const claimed = progress?.claimedFirstClears ?? [];
  const { firstClearId, bundle } = buildFloorRewardBundle({
    towerId: run.towerId,
    floorNumber: clearedFloor,
    blessingIds: run.blessingIds,
    claimedFirstClears: claimed,
  });
  const coinsBanked = bundle
    .filter((r): r is { kind: "coins"; amount: number } => r.kind === "coins")
    .reduce((s, r) => s + r.amount, 0);

  const pendingLoot = mergeBundles([parsePendingLoot(run.pendingLoot), bundle]);

  const seasonKey = currentSeasonKey();
  const newHighestAll = Math.max(progress?.highestFloorAllTime ?? 0, clearedFloor);
  const newHighestSeason =
    progress?.seasonKey === seasonKey
      ? Math.max(progress.highestFloorSeason, clearedFloor)
      : clearedFloor;
  const isBoss = clearedFloor % 10 === 0;

  const nextClaimed = firstClearId ? [...claimed, firstClearId] : claimed;

  await tx.towerProgress.upsert({
    where: {
      userId_towerId_difficultyId: {
        userId: input.userId,
        towerId: run.towerId,
        difficultyId: run.difficultyId,
      },
    },
    create: {
      userId: input.userId,
      towerId: run.towerId,
      difficultyId: run.difficultyId,
      highestFloorAllTime: clearedFloor,
      highestFloorSeason: clearedFloor,
      seasonKey,
      claimedFirstClears: nextClaimed,
      guardiansDefeated: isBoss ? 1 : 0,
    },
    update: {
      highestFloorAllTime: newHighestAll,
      highestFloorSeason: newHighestSeason,
      seasonKey,
      claimedFirstClears: nextClaimed,
      ...(isBoss ? { guardiansDefeated: { increment: 1 } } : {}),
    },
  });

  const total = COMBAT_TOWER_CONFIG.totalFloors;
  const newRecord = clearedFloor > (progress?.highestFloorAllTime ?? 0);

  if (clearedFloor >= total) {
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
    return { nextStatus: "COMPLETED", nextFloor: clearedFloor, newRecord, coinsBanked };
  }

  const nextFloor = clearedFloor + 1;
  let nextStatus: "ACTIVE" | "AWAITING_BLESSING" | "RESTING" = "ACTIVE";

  if (shouldOfferBlessing(clearedFloor)) {
    const offers = pickBlessingOffers(run.blessingIds);
    await tx.towerRun.update({
      where: { id: run.id },
      data: {
        status: "AWAITING_BLESSING",
        currentFloor: nextFloor,
        teamSnapshot: towerTeamSnapshotJson(team),
        offeredBlessingIds: offers,
        pendingLoot,
      },
    });
    return { nextStatus: "AWAITING_BLESSING", nextFloor, newRecord, coinsBanked };
  }

  const nextFloorDef = getTowerFloor(nextFloor, run.towerId);
  if (nextFloorDef?.type === "rest") {
    nextStatus = "RESTING";
  }

  if (isBoss) {
    team = applyRestRecovery(team, COMBAT_TOWER_CONFIG.rules.bossRecoveryPercentage, true);
  }

  await tx.towerRun.update({
    where: { id: run.id },
    data: {
      status: nextStatus,
      currentFloor: nextFloor,
      teamSnapshot: towerTeamSnapshotJson(team),
      pendingLoot,
    },
  });

  return { nextStatus, nextFloor, newRecord, coinsBanked };
}

export async function settleTowerFloorLoss(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    runId: string;
    instances: { id: string; currentHp: number }[];
  },
): Promise<void> {
  const run = await tx.towerRun.findFirstOrThrow({
    where: { id: input.runId, userId: input.userId },
  });
  const team = syncSnapshotFromInstances(parseTowerTeamSnapshot(run.teamSnapshot), input.instances);
  await restoreAdventureTeam(tx, team);
  await tx.towerRun.update({
    where: { id: run.id },
    data: {
      status: "FAILED",
      teamSnapshot: towerTeamSnapshotJson(team),
      endedAt: new Date(),
    },
  });
}

export async function abandonTowerRunInTx(
  tx: Prisma.TransactionClient,
  runId: string,
  userId: string,
): Promise<void> {
  const run = await tx.towerRun.findFirstOrThrow({
    where: { id: runId, userId },
  });
  if (["FAILED", "COMPLETED", "ABANDONED"].includes(run.status)) return;
  const team = parseTowerTeamSnapshot(run.teamSnapshot);
  await restoreAdventureTeam(tx, team);
  await tx.towerRun.update({
    where: { id: run.id },
    data: {
      status: "ABANDONED",
      endedAt: new Date(),
      teamSnapshot: towerTeamSnapshotJson(team),
    },
  });
  await tx.battleSession.updateMany({
    where: { userId, towerRunId: runId, status: "ACTIVE" },
    data: { status: "FLED" },
  });
}

export async function claimTowerRunLootInTx(
  tx: Prisma.TransactionClient,
  input: { userId: string; runId: string },
): Promise<{ bundle: RewardBundle; alreadyClaimed: boolean }> {
  const run = await tx.towerRun.findFirstOrThrow({
    where: { id: input.runId, userId: input.userId },
  });
  if (!["FAILED", "COMPLETED", "ABANDONED"].includes(run.status)) {
    throw new Error("NOT_ENDED");
  }
  if (run.lootClaimedAt) {
    return { bundle: [], alreadyClaimed: true };
  }

  const bundle = parsePendingLoot(run.pendingLoot);
  if (bundle.length > 0) {
    await grantTowerLootBundle(tx, {
      userId: input.userId,
      towerId: run.towerId,
      difficultyId: run.difficultyId,
      runId: run.id,
      bundle,
    });
  }

  await tx.towerRun.update({
    where: { id: run.id },
    data: {
      lootClaimedAt: new Date(),
      pendingLoot: [],
    },
  });

  return { bundle, alreadyClaimed: false };
}

export type { TowerRunCreature };
