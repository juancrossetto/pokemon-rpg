import type { NotificationType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { proceedsFor } from "@/lib/market-rules";
import { avatarById } from "@/lib/avatars";
import { gymBadgeImageUrl, gymLeaderImageUrl } from "@/lib/gym-art";
import { itemSpriteUrl } from "@/lib/item-sprites";
import { DAILY_CYCLE, nextDay, slotForDay } from "@/lib/events/daily";
import { dayKey, serverNow } from "@/lib/events/time";
import {
  ENERGY_FULL_NOTIFY_COOLDOWN_MS,
  getCurrentEnergy,
} from "@/lib/energy";

export type NotificationImageKind = "avatar" | "item" | "pokemon" | "badge" | "leader";

export type NotificationPayload = {
  buyerName?: string;
  sellerName?: string;
  itemName?: string;
  coins?: number;
  gymName?: string;
  leaderName?: string;
  rematch?: boolean;
  opponentName?: string;
  /** Username del otro entrenador (amistad). */
  trainerName?: string;
  /** Nombre del clan (notificaciones de clan). */
  clanName?: string;
  clanTag?: string;
  /** Miniatura: avatar de usuario, ítem, medalla o líder. */
  imageUrl?: string;
  imageKind?: NotificationImageKind;
};

async function avatarUrlForUserId(userId: string): Promise<string | undefined> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarId: true },
  });
  return avatarById(u?.avatarId)?.src ?? undefined;
}

async function avatarUrlForUsername(username: string): Promise<string | undefined> {
  const u = await prisma.user.findFirst({
    where: { username },
    select: { avatarId: true },
  });
  return avatarById(u?.avatarId)?.src ?? undefined;
}

function itemImageFromName(itemName: string): string {
  return itemSpriteUrl(itemName.replace(/\s*×\d+\s*$/u, "").trim());
}

export type NotificationDTO = {
  id: string;
  type: NotificationType;
  payload: NotificationPayload;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const HISTORY_LIMIT = 30;

function newNotificationId(): string {
  return `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  payload?: NotificationPayload;
  href?: string | null;
  /** Si se pasa, escribe dentro de la transacción abierta. */
  tx?: Prisma.TransactionClient;
}) {
  const db = input.tx ?? prisma;

  // Enums nuevos (FRIEND_*, CLAN_*) pueden fallar con Prisma Client cacheado
  // por Turbopack. El insert crudo usa el enum de Postgres.
  const rawEnumTypes: NotificationType[] = [
    "FRIEND_REQUEST",
    "FRIEND_ACCEPTED",
    "CLAN_INVITE",
    "CLAN_APPLICATION",
    "CLAN_ACCEPTED",
    "CLAN_KICKED",
    "CLAN_ROLE_CHANGED",
    "DAILY_REWARD_READY",
    "ENERGY_FULL",
  ];
  if (rawEnumTypes.includes(input.type)) {
    const id = newNotificationId();
    const payload = JSON.stringify(input.payload ?? {});
    await db.$executeRaw`
      INSERT INTO "Notification" ("id", "userId", "type", "payload", "href", "createdAt")
      VALUES (
        ${id},
        ${input.userId},
        CAST(${input.type} AS "NotificationType"),
        CAST(${payload} AS jsonb),
        ${input.href ?? null},
        NOW()
      )
    `;
    return { id };
  }

  return db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      href: input.href ?? null,
    },
  });
}

/** Tipos cuya miniatura es el otro entrenador (no ítem/medalla). */
const PERSON_IMAGE_TYPES = new Set<NotificationType>([
  "PVP_WON",
  "PVP_LOST",
  "FRIEND_REQUEST",
  "FRIEND_ACCEPTED",
  "CLAN_INVITE",
  "CLAN_APPLICATION",
]);

function personNameFromPayload(p: NotificationPayload): string | undefined {
  const name = p.opponentName ?? p.trainerName;
  return name?.trim() || undefined;
}

/** Completa imageUrl de avisos viejos / sin avatar guardado, por username. */
async function enrichPersonImages(items: NotificationDTO[]): Promise<NotificationDTO[]> {
  const names = new Set<string>();
  for (const item of items) {
    if (!PERSON_IMAGE_TYPES.has(item.type)) continue;
    if (item.payload.imageUrl) continue;
    const name = personNameFromPayload(item.payload);
    if (name) names.add(name);
  }
  if (names.size === 0) return items;

  const users = await prisma.user.findMany({
    where: { username: { in: [...names] } },
    select: { username: true, avatarId: true },
  });
  const avatarByUsername = new Map(
    users.map((u) => [u.username, avatarById(u.avatarId)?.src ?? undefined] as const),
  );

  return items.map((item) => {
    if (!PERSON_IMAGE_TYPES.has(item.type) || item.payload.imageUrl) return item;
    const name = personNameFromPayload(item.payload);
    if (!name) return item;
    const imageUrl = avatarByUsername.get(name);
    return {
      ...item,
      payload: {
        ...item.payload,
        ...(imageUrl ? { imageUrl } : {}),
        imageKind: "avatar",
      },
    };
  });
}

/**
 * Si hay regalo diario sin reclamar, asegura una notificación unread.
 * Si ya se reclamó hoy, marca como leídas las pendientes de ese tipo.
 */
export async function syncDailyRewardNotification(userId: string) {
  const today = dayKey(serverNow());
  const [claimedToday, claimedCount] = await Promise.all([
    prisma.dailyRewardClaim.findFirst({
      where: { userId, dayKey: today },
      select: { dayIndex: true },
    }),
    prisma.dailyRewardClaim.count({
      where: { userId, cycleId: DAILY_CYCLE.id },
    }),
  ]);
  const currentDay = nextDay(DAILY_CYCLE, claimedCount);
  const canClaim =
    !claimedToday && slotForDay(DAILY_CYCLE, currentDay) !== null;

  if (!canClaim) {
    await prisma.notification.updateMany({
      where: { userId, type: "DAILY_REWARD_READY", readAt: null },
      data: { readAt: new Date() },
    });
    return;
  }

  const existing = await prisma.notification.findFirst({
    where: { userId, type: "DAILY_REWARD_READY", readAt: null },
    select: { id: true },
  });
  if (existing) return;

  await createNotification({
    userId,
    type: "DAILY_REWARD_READY",
    href: "/?daily=1",
    payload: {
      imageUrl: "/items/hd/gift.png",
      imageKind: "item",
    },
  });
}

/**
 * Si la energía está al tope, asegura un aviso unread (con cooldown 6h).
 * Si no está llena, marca como leídas las ENERGY_FULL pendientes.
 * Usa SQL crudo: el enum nuevo puede no estar en el Prisma Client del HMR.
 */
export async function syncEnergyFullNotification(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { energy: true, energyMax: true, energyUpdatedAt: true },
  });
  if (!user) return;

  const current = getCurrentEnergy(user.energy, user.energyMax, user.energyUpdatedAt);
  if (current < user.energyMax) {
    await prisma.$executeRaw`
      UPDATE "Notification"
      SET "readAt" = NOW()
      WHERE "userId" = ${userId}
        AND "type" = CAST('ENERGY_FULL' AS "NotificationType")
        AND "readAt" IS NULL
    `;
    return;
  }

  const unread = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Notification"
    WHERE "userId" = ${userId}
      AND "type" = CAST('ENERGY_FULL' AS "NotificationType")
      AND "readAt" IS NULL
    LIMIT 1
  `;
  if (unread[0]) return;

  const recent = await prisma.$queryRaw<{ createdAt: Date }[]>`
    SELECT "createdAt" FROM "Notification"
    WHERE "userId" = ${userId}
      AND "type" = CAST('ENERGY_FULL' AS "NotificationType")
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  if (
    recent[0] &&
    Date.now() - new Date(recent[0].createdAt).getTime() < ENERGY_FULL_NOTIFY_COOLDOWN_MS
  ) {
    return;
  }

  await createNotification({
    userId,
    type: "ENERGY_FULL",
    href: "/",
    payload: {
      imageUrl: "/items/hd/energy.png",
      imageKind: "item",
    },
  });
}

export async function listNotifications(userId: string, limit = HISTORY_LIMIT): Promise<{
  items: NotificationDTO[];
  unreadCount: number;
}> {
  await Promise.all([
    syncDailyRewardNotification(userId),
    syncEnergyFullNotification(userId),
  ]);

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  const base = rows.map((row) => ({
    id: row.id,
    type: row.type,
    payload: (row.payload ?? {}) as NotificationPayload,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    unreadCount,
    items: await enrichPersonImages(base),
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

export async function deleteNotifications(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  await prisma.notification.deleteMany({
    where: { userId, id: { in: ids } },
  });
}

/**
 * Vacía la bandeja. `onlyRead` deja las pendientes: borrar todo de un panel
 * recién abierto —donde el auto-leído todavía no corrió— se llevaría avisos
 * que el jugador no alcanzó a ver.
 */
export async function deleteAllNotifications(
  userId: string,
  opts: { onlyRead?: boolean } = {},
) {
  await prisma.notification.deleteMany({
    where: { userId, ...(opts.onlyRead ? { readAt: { not: null } } : {}) },
  });
}

/** Aviso al vendedor: alguien compró su publicación. */
export async function notifyMarketSold(listingId: string) {
  const listing = await prisma.marketListing.findUnique({
    where: { id: listingId },
    include: {
      buyer: { select: { username: true } },
      pokemon: {
        select: {
          nickname: true,
          species: { select: { name: true, spriteUrl: true } },
        },
      },
    },
  });
  if (!listing || listing.status !== "SOLD" || !listing.buyer) return;

  let itemName = "—";
  let imageUrl: string | undefined;
  let imageKind: NotificationImageKind | undefined;

  if (listing.kind === "POKEMON" && listing.pokemon) {
    itemName = listing.pokemon.nickname ?? listing.pokemon.species.name;
    imageUrl = listing.pokemon.species.spriteUrl || undefined;
    imageKind = imageUrl ? "pokemon" : undefined;
  } else if (listing.itemId) {
    const item = await prisma.item.findUnique({
      where: { id: listing.itemId },
      select: { name: true },
    });
    itemName = item?.name ?? "—";
    if (item?.name) {
      imageUrl = itemImageFromName(item.name);
      imageKind = "item";
    }
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
      imageUrl,
      imageKind,
    },
    href: "/market?tab=mine",
  });
}

/** Aviso al vendedor: la publicación venció y volvió el escrow. */
export async function notifyMarketExpired(listingId: string) {
  const listing = await prisma.marketListing.findUnique({
    where: { id: listingId },
    include: {
      pokemon: {
        select: {
          nickname: true,
          species: { select: { name: true, spriteUrl: true } },
        },
      },
    },
  });
  if (!listing || listing.status !== "EXPIRED") return;

  let itemName = "—";
  let imageUrl: string | undefined;
  let imageKind: NotificationImageKind | undefined;

  if (listing.kind === "POKEMON" && listing.pokemon) {
    itemName = listing.pokemon.nickname ?? listing.pokemon.species.name;
    imageUrl = listing.pokemon.species.spriteUrl || undefined;
    imageKind = imageUrl ? "pokemon" : undefined;
  } else if (listing.itemId) {
    const item = await prisma.item.findUnique({
      where: { id: listing.itemId },
      select: { name: true },
    });
    itemName = item?.name ?? "—";
    if (item?.name) {
      imageUrl = itemImageFromName(item.name);
      imageKind = "item";
    }
  }

  await createNotification({
    userId: listing.sellerId,
    type: "MARKET_EXPIRED",
    payload: { itemName, imageUrl, imageKind },
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
    select: { name: true, leaderName: true, type: true },
  });
  if (!gym) return;

  const badgeUrl = gymBadgeImageUrl(gym.type);
  const leaderUrl = gymLeaderImageUrl(gym.leaderName) ?? undefined;
  // Victoria → medalla; derrota → líder.
  const imageUrl = won ? badgeUrl : leaderUrl ?? badgeUrl;
  const imageKind: NotificationImageKind = won ? "badge" : leaderUrl ? "leader" : "badge";

  await createNotification({
    userId,
    type: won ? "GYM_WON" : "GYM_LOST",
    payload: {
      gymName: gym.name,
      leaderName: gym.leaderName,
      rematch: opts?.rematch ?? false,
      imageUrl,
      imageKind,
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
      imageUrl: itemImageFromName(itemName),
      imageKind: "item",
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
  const [winnerAvatar, loserAvatar] = await Promise.all([
    avatarUrlForUserId(input.winnerId),
    avatarUrlForUserId(input.loserId),
  ]);

  await Promise.all([
    createNotification({
      userId: input.winnerId,
      type: "PVP_WON",
      payload: {
        opponentName: input.loserName,
        imageUrl: loserAvatar,
        imageKind: "avatar",
      },
      href: `/pvp/${input.matchId}`,
    }),
    createNotification({
      userId: input.loserId,
      type: "PVP_LOST",
      payload: {
        opponentName: input.winnerName,
        imageUrl: winnerAvatar,
        imageKind: "avatar",
      },
      href: `/pvp/${input.matchId}`,
    }),
  ]);
}

/** Solicitud de amistad recibida → campana del destinatario. */
export async function notifyFriendRequest(input: {
  toUserId: string;
  fromUserName: string;
  tx?: Prisma.TransactionClient;
}) {
  const imageUrl = await avatarUrlForUsername(input.fromUserName);
  await createNotification({
    userId: input.toUserId,
    type: "FRIEND_REQUEST",
    payload: {
      trainerName: input.fromUserName,
      imageUrl,
      imageKind: imageUrl ? "avatar" : undefined,
    },
    href: "/friends?filter=requests",
    tx: input.tx,
  });
}

/** Amistad aceptada → campana de quien envió la solicitud. */
export async function notifyFriendAccepted(input: {
  toUserId: string;
  friendName: string;
  tx?: Prisma.TransactionClient;
}) {
  const imageUrl = await avatarUrlForUsername(input.friendName);
  await createNotification({
    userId: input.toUserId,
    type: "FRIEND_ACCEPTED",
    payload: {
      trainerName: input.friendName,
      imageUrl,
      imageKind: imageUrl ? "avatar" : undefined,
    },
    href: "/friends",
    tx: input.tx,
  });
}

export async function notifyClanInvite(input: {
  toUserId: string;
  clanName: string;
  clanTag: string;
  clanId: string;
  fromUserName: string;
  tx?: Prisma.TransactionClient;
}) {
  const imageUrl = await avatarUrlForUsername(input.fromUserName);
  await createNotification({
    userId: input.toUserId,
    type: "CLAN_INVITE",
    payload: {
      clanName: input.clanName,
      clanTag: input.clanTag,
      trainerName: input.fromUserName,
      imageUrl,
      imageKind: imageUrl ? "avatar" : undefined,
    },
    href: `/clans/${input.clanId}`,
    tx: input.tx,
  });
}

export async function notifyClanApplication(input: {
  toUserId: string;
  clanId: string;
  clanName: string;
  clanTag: string;
  trainerName: string;
  tx?: Prisma.TransactionClient;
}) {
  const imageUrl = await avatarUrlForUsername(input.trainerName);
  await createNotification({
    userId: input.toUserId,
    type: "CLAN_APPLICATION",
    payload: {
      clanName: input.clanName,
      clanTag: input.clanTag,
      trainerName: input.trainerName,
      imageUrl,
      imageKind: imageUrl ? "avatar" : undefined,
    },
    href: `/clans/${input.clanId}?tab=admin`,
    tx: input.tx,
  });
}

export async function notifyClanAccepted(input: {
  toUserId: string;
  clanId: string;
  clanName: string;
  clanTag: string;
  tx?: Prisma.TransactionClient;
}) {
  await createNotification({
    userId: input.toUserId,
    type: "CLAN_ACCEPTED",
    payload: { clanName: input.clanName, clanTag: input.clanTag },
    href: `/clans/${input.clanId}`,
    tx: input.tx,
  });
}

export async function notifyClanKicked(input: {
  toUserId: string;
  clanName: string;
  clanTag: string;
  tx?: Prisma.TransactionClient;
}) {
  await createNotification({
    userId: input.toUserId,
    type: "CLAN_KICKED",
    payload: { clanName: input.clanName, clanTag: input.clanTag },
    href: "/clans",
    tx: input.tx,
  });
}

export async function notifyClanRoleChanged(input: {
  toUserId: string;
  clanId: string;
  clanName: string;
  clanTag: string;
  tx?: Prisma.TransactionClient;
}) {
  await createNotification({
    userId: input.toUserId,
    type: "CLAN_ROLE_CHANGED",
    payload: { clanName: input.clanName, clanTag: input.clanTag },
    href: `/clans/${input.clanId}`,
    tx: input.tx,
  });
}
