import type { Prisma } from "@/generated/prisma/client";

/** Compras SOLD que el comprador aún no retiró de la mochila. */
export function unclaimedPurchasesWhere(
  userId: string,
): Prisma.MarketListingWhereInput {
  return {
    buyerId: userId,
    status: "SOLD",
    buyerClaimedAt: null,
  };
}

/**
 * Pokémon del comprador que todavía viven en la mochila del mercado:
 * no deben aparecer en PC / venta / cría hasta `claimPurchase`.
 */
export function excludeUnclaimedMarketPokemon(
  userId: string,
): Prisma.PokemonInstanceWhereInput {
  return {
    listings: {
      none: {
        status: "SOLD",
        buyerId: userId,
        buyerClaimedAt: null,
      },
    },
  };
}
