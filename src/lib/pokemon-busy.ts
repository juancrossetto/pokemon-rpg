import type { Prisma } from "@/generated/prisma/client";

/**
 * Pokémon fuera de circulación: padres incubando, pensión, trueque pendiente
 * o oferta de intercambio con un amigo.
 */
export async function busyPokemonIds(
  tx: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  userId: string,
): Promise<Set<string>> {
  const [eggs, daycare, wonder, friendTrades] = await Promise.all([
    tx.egg.findMany({
      where: { ownerId: userId, hatchedAt: null },
      select: { parentAId: true, parentBId: true },
    }),
    tx.daycareDeposit.findMany({
      where: { userId },
      select: { pokemonInstanceId: true },
    }),
    tx.wonderTradeOffer.findMany({
      where: { userId, matchedAt: null },
      select: { pokemonInstanceId: true },
    }),
    tx.friendTradeOffer.findMany({
      where: { fromUserId: userId },
      select: { pokemonInstanceId: true },
    }),
  ]);
  return new Set([
    ...eggs.flatMap((egg) => [egg.parentAId, egg.parentBId]),
    ...daycare.map((row) => row.pokemonInstanceId),
    ...wonder.map((row) => row.pokemonInstanceId),
    ...friendTrades.map((row) => row.pokemonInstanceId),
  ]);
}

export async function isPokemonBusy(
  tx: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  userId: string,
  instanceId: string,
): Promise<boolean> {
  const busy = await busyPokemonIds(tx, userId);
  return busy.has(instanceId);
}
