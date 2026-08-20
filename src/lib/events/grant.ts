import type { Prisma } from "@/generated/prisma/client";
import type { RewardBundle, RewardDef } from "./rewards";

/**
 * Resultado de aplicar un paquete de recompensas.
 * `skipped` lista las que no se pudieron entregar (ítem ausente del catálogo),
 * para que queden registradas en la auditoría en vez de desaparecer.
 */
export type GrantResult = {
  coinsDelta: number;
  energyDelta: number;
  gemsDelta: number;
  granted: RewardDef[];
  skipped: RewardDef[];
};

/**
 * Aplica un paquete de recompensas **dentro de una transacción existente**.
 *
 * Recibe el `tx` en vez de abrir el suyo a propósito: quien llama ya tomó el
 * lock del jugador y escribió la fila que impide el doble reclamo, y la entrega
 * tiene que compartir esa atomicidad. Si esto abriera su propia transacción,
 * podría entregar monedas después de que el reclamo falló.
 *
 * La energía se acota a `energyMax` — regalar energía nunca deja al jugador por
 * encima de su tope, igual que la regeneración.
 */
export async function grantRewards(
  tx: Prisma.TransactionClient,
  userId: string,
  bundle: RewardBundle,
): Promise<GrantResult> {
  const result: GrantResult = {
    coinsDelta: 0,
    energyDelta: 0,
    gemsDelta: 0,
    granted: [],
    skipped: [],
  };

  const coins = bundle
    .filter((r): r is Extract<RewardDef, { kind: "coins" }> => r.kind === "coins")
    .reduce((sum, r) => sum + r.amount, 0);
  const gems = bundle
    .filter((r): r is Extract<RewardDef, { kind: "gems" }> => r.kind === "gems")
    .reduce((sum, r) => sum + r.amount, 0);
  const energy = bundle
    .filter((r): r is Extract<RewardDef, { kind: "energy" }> => r.kind === "energy")
    .reduce((sum, r) => sum + r.amount, 0);

  if (coins > 0 || energy > 0 || gems > 0) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { energy: true, energyMax: true },
    });
    // La energía se guarda junto a `energyUpdatedAt`, que es de donde sale la
    // regeneración: si se sumara sin tocar la marca, el próximo cálculo la
    // volvería a derivar desde el valor viejo y el regalo se perdería.
    const nextEnergy = Math.min(user.energyMax, user.energy + energy);
    const applied = nextEnergy - user.energy;

    await tx.user.update({
      where: { id: userId },
      data: {
        ...(coins > 0 ? { coins: { increment: coins } } : {}),
        ...(gems > 0 ? { gems: { increment: gems } } : {}),
        ...(applied > 0 ? { energy: nextEnergy, energyUpdatedAt: new Date() } : {}),
      },
    });

    result.coinsDelta = coins;
    result.energyDelta = applied;
    result.gemsDelta = gems;
  }

  for (const reward of bundle) {
    if (reward.kind !== "item") {
      result.granted.push(reward);
      continue;
    }
    const item = await tx.item.findFirst({
      where: { name: reward.itemName },
      select: { id: true },
    });
    if (!item) {
      // El catálogo lo define por nombre; si el seed cambió, no se rompe la
      // transacción entera —el resto de la recompensa igual se entrega.
      result.skipped.push(reward);
      continue;
    }
    await tx.inventoryItem.upsert({
      where: { userId_itemId: { userId, itemId: item.id } },
      create: { userId, itemId: item.id, quantity: reward.quantity },
      update: { quantity: { increment: reward.quantity } },
    });
    result.granted.push(reward);
  }

  return result;
}

/** Registro de auditoría de una entrega. Se escribe en la misma transacción. */
export async function writeLedger(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    source: "daily" | "weekly" | "event_mission" | "pvp" | "achievement" | "tower" | "raid" | "season";
    sourceRef: string;
    result: GrantResult;
  },
): Promise<void> {
  await tx.rewardLedger.create({
    data: {
      userId: input.userId,
      source: input.source,
      sourceRef: input.sourceRef,
      payload: {
        coins: input.result.coinsDelta,
        energy: input.result.energyDelta,
        gems: input.result.gemsDelta,
        granted: input.result.granted,
        skipped: input.result.skipped,
      } as Prisma.InputJsonValue,
    },
  });
}
