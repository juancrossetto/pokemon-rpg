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
  | { ok: true; coins: number; itemName: string; quantity: number }
  | { ok: false; error: "unauthorized" | "invalid" | "not_done" | "already_claimed" };

/**
 * Cobra la recompensa de un objetivo de zona.
 *
 * El estado se recalcula en el servidor a partir de la DB: el cliente manda qué
 * quiere cobrar, no cuánto le corresponde. Con el lock, dos clicks simultáneos
 * no pueden cobrar dos veces (y el PK de la tabla es la segunda barrera).
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

    await tx.zoneObjectiveClaim.create({ data: { userId, locationId, objective } });
    await tx.user.update({
      where: { id: userId },
      data: { coins: { increment: state.reward.coins } },
    });

    // El objeto sale del catálogo sembrado; si faltara, la recompensa igual
    // paga las monedas en vez de tirar la transacción entera.
    const item = await tx.item.findFirst({
      where: { name: state.reward.itemName },
      select: { id: true },
    });
    if (item) {
      await tx.inventoryItem.upsert({
        where: { userId_itemId: { userId, itemId: item.id } },
        create: { userId, itemId: item.id, quantity: state.reward.quantity },
        update: { quantity: { increment: state.reward.quantity } },
      });
    }
  });

  if (failure) return failure;

  revalidatePath(`/${locale}/campaign`);
  revalidatePath(`/${locale}`);
  return {
    ok: true,
    coins: state.reward.coins,
    itemName: state.reward.itemName,
    quantity: state.reward.quantity,
  };
}
