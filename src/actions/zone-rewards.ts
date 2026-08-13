"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { loadMapLocations } from "@/lib/campaign/map-data";
import {
  ZONE_OBJECTIVE_IDS,
  evaluateObjective,
  type ZoneObjectiveId,
} from "@/lib/campaign/objectives";

export type ClaimResult =
  | {
      ok: true;
      coins: number;
      items: Array<{ itemName: string; quantity: number }>;
    }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "invalid"
        | "not_done"
        | "already_claimed"
        | "missing_item";
    };

/**
 * Cobra la recompensa de un objetivo de zona.
 *
 * El estado se recalcula en el servidor a partir de la DB: el cliente manda qué
 * quiere cobrar, no cuánto le corresponde. Con el lock, dos clicks simultáneos
 * no pueden cobrar dos veces (y el PK de la tabla es la segunda barrera).
 * Si falta el ítem en el catálogo, falla sin marcar el claim (se puede reintentar).
 */
export async function claimZoneObjective(
  locale: string,
  locationId: string,
  objective: string,
): Promise<ClaimResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  if (!ZONE_OBJECTIVE_IDS.includes(objective as ZoneObjectiveId)) {
    return { ok: false, error: "invalid" };
  }

  const progress = await ensureCampaignProgress(userId);
  const zones = await loadMapLocations(userId, progress);
  const zone = zones.find((z) => z.id === locationId);
  if (!zone || !zone.unlocked) return { ok: false, error: "invalid" };

  const state = evaluateObjective(zone, objective as ZoneObjectiveId, new Set());
  if (!state) return { ok: false, error: "invalid" };
  if (!state.done) return { ok: false, error: "not_done" };

  let failure: ClaimResult | null = null;

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);

    const existing = await tx.zoneObjectiveClaim.findUnique({
      where: {
        userId_locationId_objective: { userId, locationId, objective },
      },
      select: { objective: true },
    });
    if (existing) {
      failure = { ok: false, error: "already_claimed" };
      return;
    }

    const itemNames = state.reward.items.map((reward) => reward.itemName);
    const items = await tx.item.findMany({
      where: { name: { in: itemNames } },
      select: { id: true, name: true },
    });
    if (items.length !== itemNames.length) {
      failure = { ok: false, error: "missing_item" };
      return;
    }

    await tx.zoneObjectiveClaim.create({ data: { userId, locationId, objective } });
    await tx.user.update({
      where: { id: userId },
      data: { coins: { increment: state.reward.coins } },
    });
    for (const reward of state.reward.items) {
      const item = items.find((candidate) => candidate.name === reward.itemName)!;
      await tx.inventoryItem.upsert({
        where: { userId_itemId: { userId, itemId: item.id } },
        create: { userId, itemId: item.id, quantity: reward.quantity },
        update: { quantity: { increment: reward.quantity } },
      });
    }
  });

  if (failure) return failure;

  revalidatePath(`/${locale}/campaign`);
  revalidatePath(`/${locale}`);
  return {
    ok: true,
    coins: state.reward.coins,
    items: state.reward.items,
  };
}
