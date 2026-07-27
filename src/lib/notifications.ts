import type { NotificationType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { proceedsFor } from "@/lib/market-rules";

export type NotificationPayload = {
  buyerName?: string;
  sellerName?: string;
  itemName?: string;
  coins?: number;
  gymName?: string;
  leaderName?: string;
  rematch?: boolean;
  opponentName?: string;
};

export type NotificationDTO = {
  id: string;
  type: NotificationType;
  payload: NotificationPayload;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const HISTORY_LIMIT = 30;

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  payload?: NotificationPayload;
  href?: string | null;
  /** Si se pasa, escribe dentro de la transacción abierta. */
  tx?: Prisma.TransactionClient;
}) {
  const db = input.tx ?? prisma;
  return db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      href: input.href ?? null,
    },
  });
}

export async function listNotifications(userId: string, limit = HISTORY_LIMIT): Promise<{
  items: NotificationDTO[];
  unreadCount: number;
}> {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    unreadCount,
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      payload: (row.payload ?? {}) as NotificationPayload,
      href: row.href,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}

/** Aviso al vendedor: alguien compró su publicación. */
export async function notifyMarketSold(listingId: string) {
  const listing = await prisma.marketListing.findUnique({
    where: { id: listingId },
    include: {
      buyer: { select: { username: true } },
      pokemon: { select: { nickname: true, species: { select: { name: true } } } },
    },
  });
  if (!listing || listing.status !== "SOLD" || !listing.buyer) return;

  let itemName = "—";
  if (listing.kind === "POKEMON" && listing.pokemon) {
    itemName = listing.pokemon.nickname ?? listing.pokemon.species.name;
  } else if (listing.itemId) {
    const item = await prisma.item.findUnique({
      where: { id: listing.itemId },
      select: { name: true },
    });
    itemName = item?.name ?? "—";
    if (listing.quantity && listing.quantity > 1) {
      itemName = `${itemName} ×${listing.quantity}`;
    }
  }

  await createNotification({
    userId: listing.sellerId,
    type: "MARKET_SOLD",
    payload: {
      buyerName: listing.buyer.username,
      itemName,
      coins: proceedsFor(listing.price),
    },
    href: "/market?tab=mine",
  });
}

/** Aviso al vendedor: la publicación venció y volvió el escrow. */
export async function notifyMarketExpired(listingId: string) {
  const listing = await prisma.marketListing.findUnique({
    where: { id: listingId },
    include: {
      pokemon: { select: { nickname: true, species: { select: { name: true } } } },
    },
  });
  if (!listing || listing.status !== "EXPIRED") return;

  let itemName = "—";
  if (listing.kind === "POKEMON" && listing.pokemon) {
    itemName = listing.pokemon.nickname ?? listing.pokemon.species.name;
  } else if (listing.itemId) {
    const item = await prisma.item.findUnique({
      where: { id: listing.itemId },
      select: { name: true },
    });
    itemName = item?.name ?? "—";
  }

  await createNotification({
    userId: listing.sellerId,
    type: "MARKET_EXPIRED",
    payload: { itemName },
    href: "/market?tab=mine",
  });
}

export async function notifyGymResult(
  userId: string,
  gymId: string,
  won: boolean,
  opts?: { rematch?: boolean },
) {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { name: true, leaderName: true },
  });
  if (!gym) return;

  await createNotification({
    userId,
    type: won ? "GYM_WON" : "GYM_LOST",
    payload: {
      gymName: gym.name,
      leaderName: gym.leaderName,
      rematch: opts?.rematch ?? false,
    },
    href: `/gyms/${gymId}`,
  });
}

/** Aviso al recibir una MT/MO del líder (solo la primera medalla). */
export async function notifyGymTmReward(userId: string, gymId: string, itemName: string) {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { name: true, leaderName: true },
  });
  if (!gym) return;

  await createNotification({
    userId,
    type: "GYM_TM_REWARD",
    payload: {
      itemName,
      gymName: gym.name,
      leaderName: gym.leaderName,
    },
    href: "/inventory",
  });
}

export async function notifyPvpResult(input: {
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  matchId: string;
}) {
  await Promise.all([
    createNotification({
      userId: input.winnerId,
      type: "PVP_WON",
      payload: { opponentName: input.loserName },
      href: `/pvp/${input.matchId}`,
    }),
    createNotification({
      userId: input.loserId,
      type: "PVP_LOST",
      payload: { opponentName: input.winnerName },
      href: `/pvp/${input.matchId}`,
    }),
  ]);
}
