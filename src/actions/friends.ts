"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allowAction } from "@/lib/rate-limit";
import { lockUsers } from "@/lib/db-locks";
import {
  FRIEND_MAX,
  FRIEND_REQUEST_OUT_MAX,
  friendshipPair,
} from "@/lib/friend-rules";
import {
  loadTrainerCard,
  searchPlayers,
  touchPresence,
} from "@/lib/friends-data";
import type { PlayerSearchHit, TrainerCardData } from "@/lib/friends";

type Ok = { ok: true; notice?: "sent" | "accepted" };
type Fail = { ok: false; error: string };
type Result = Ok | Fail;

function revalidateFriends(locale: string) {
  revalidatePath(`/${locale}/friends`);
  // La campana vive en el layout: sin esto el destinatario no ve el aviso
  // hasta navegar a otra página.
  revalidatePath(`/${locale}`, "layout");
}

async function requireUser(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function heartbeatPresence(): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  await touchPresence(userId);
  return { ok: true };
}

export async function searchTrainers(
  query: string,
): Promise<{ ok: true; hits: PlayerSearchHit[] } | Fail> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!allowAction(`friends:search:${userId}`, 30, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }
  const hits = await searchPlayers(userId, query);
  return { ok: true, hits };
}

export async function fetchTrainerCard(
  targetUserId: string,
): Promise<{ ok: true; card: TrainerCardData } | Fail> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!allowAction(`friends:card:${userId}`, 40, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }
  const card = await loadTrainerCard(userId, targetUserId);
  if (!card) return { ok: false, error: "not_found" };
  return { ok: true, card };
}

export async function sendFriendRequest(
  locale: string,
  targetUserId: string,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (userId === targetUserId) return { ok: false, error: "invalid" };
  if (!allowAction(`friends:req:${userId}`, 20, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }

  type FriendNotify =
    | { kind: "request"; toUserId: string; fromUserName: string }
    | { kind: "accepted"; toUserId: string; friendName: string };

  let notice: "sent" | "accepted" = "sent";
  // El resultado sale de la TX (no mutar let desde el callback): si no, tsc
  // estrecha `notify` a `never` y el build de Vercel falla.
  let notify: FriendNotify | null = null;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId, targetUserId);

      const [me, target] = await Promise.all([
        tx.user.findUnique({
          where: { id: userId },
          select: { username: true },
        }),
        tx.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, username: true },
        }),
      ]);
      if (!me || !target) throw new Error("not_found");

      const blocked = await tx.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: targetUserId },
            { blockerId: targetUserId, blockedId: userId },
          ],
        },
      });
      if (blocked) throw new Error("blocked");

      const [a, b] = friendshipPair(userId, targetUserId);
      const existing = await tx.friendship.findUnique({
        where: { userAId_userBId: { userAId: a, userBId: b } },
      });
      if (existing) throw new Error("already_friends");

      const friendCount = await tx.friendship.count({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      });
      if (friendCount >= FRIEND_MAX) throw new Error("friends_full");

      const outgoing = await tx.friendRequest.count({
        where: { fromUserId: userId, status: "PENDING" },
      });
      if (outgoing >= FRIEND_REQUEST_OUT_MAX) throw new Error("requests_full");

      const reverse = await tx.friendRequest.findFirst({
        where: {
          fromUserId: targetUserId,
          toUserId: userId,
          status: "PENDING",
        },
      });
      if (reverse) {
        await tx.friendRequest.update({
          where: { id: reverse.id },
          data: { status: "ACCEPTED", respondedAt: new Date() },
        });
        await tx.friendship.create({ data: { userAId: a, userBId: b } });
        return {
          notice: "accepted" as const,
          notify: {
            kind: "accepted" as const,
            toUserId: targetUserId,
            friendName: me.username,
          },
        };
      }

      const pending = await tx.friendRequest.findFirst({
        where: {
          fromUserId: userId,
          toUserId: targetUserId,
          status: "PENDING",
        },
      });
      if (pending) throw new Error("already_sent");

      await tx.friendRequest.deleteMany({
        where: {
          fromUserId: userId,
          toUserId: targetUserId,
          status: { not: "PENDING" },
        },
      });
      await tx.friendRequest.create({
        data: { fromUserId: userId, toUserId: targetUserId },
      });
      return {
        notice: "sent" as const,
        notify: {
          kind: "request" as const,
          toUserId: targetUserId,
          fromUserName: me.username,
        },
      };
    });
    notice = outcome.notice;
    notify = outcome.notify;
  } catch (e) {
    console.error("[friends] sendFriendRequest failed", e);
    const code = e instanceof Error ? e.message : "invalid";
    const known = [
      "unauthorized",
      "invalid",
      "rate_limited",
      "not_found",
      "blocked",
      "already_friends",
      "already_sent",
      "friends_full",
      "requests_full",
    ];
    return { ok: false, error: known.includes(code) ? code : "invalid" };
  }

  // Aviso fuera de la TX: la solicitud ya quedó guardada aunque falle el mail.
  if (notify) {
    try {
      const { notifyFriendAccepted, notifyFriendRequest } = await import(
        "@/lib/notifications"
      );
      if (notify.kind === "request") {
        await notifyFriendRequest({
          toUserId: notify.toUserId,
          fromUserName: notify.fromUserName,
        });
      } else {
        await notifyFriendAccepted({
          toUserId: notify.toUserId,
          friendName: notify.friendName,
        });
      }
    } catch (e) {
      console.error("[friends] notify after request failed", e);
    }
  }

  revalidateFriends(locale);
  return { ok: true, notice };
}

export async function acceptFriendRequest(
  locale: string,
  requestId: string,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!allowAction(`friends:accept:${userId}`, 30, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }

  let acceptedFromUserId: string | null = null;
  let accepterName: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const req = await tx.friendRequest.findUnique({ where: { id: requestId } });
      if (!req || req.toUserId !== userId || req.status !== "PENDING") {
        throw new Error("not_found");
      }

      await lockUsers(tx, userId, req.fromUserId);

      const friendCount = await tx.friendship.count({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      });
      if (friendCount >= FRIEND_MAX) throw new Error("friends_full");

      const me = await tx.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      if (!me) throw new Error("not_found");

      const [a, b] = friendshipPair(userId, req.fromUserId);
      await tx.friendRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      await tx.friendship.upsert({
        where: { userAId_userBId: { userAId: a, userBId: b } },
        create: { userAId: a, userBId: b },
        update: {},
      });

      acceptedFromUserId = req.fromUserId;
      accepterName = me.username;
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "invalid";
    const known = ["not_found", "friends_full", "unauthorized", "rate_limited"];
    return { ok: false, error: known.includes(code) ? code : "invalid" };
  }

  if (acceptedFromUserId && accepterName) {
    try {
      const { notifyFriendAccepted } = await import("@/lib/notifications");
      await notifyFriendAccepted({
        toUserId: acceptedFromUserId,
        friendName: accepterName,
      });
    } catch (e) {
      console.error("[friends] notify after accept failed", e);
    }
  }

  revalidateFriends(locale);
  return { ok: true, notice: "accepted" };
}

export async function declineFriendRequest(
  locale: string,
  requestId: string,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };

  const req = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!req || req.toUserId !== userId || req.status !== "PENDING") {
    return { ok: false, error: "not_found" };
  }

  await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
  revalidateFriends(locale);
  return { ok: true };
}

export async function cancelFriendRequest(
  locale: string,
  requestId: string,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };

  const req = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!req || req.fromUserId !== userId || req.status !== "PENDING") {
    return { ok: false, error: "not_found" };
  }

  await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED", respondedAt: new Date() },
  });
  revalidateFriends(locale);
  return { ok: true };
}

export async function removeFriend(
  locale: string,
  friendUserId: string,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!allowAction(`friends:remove:${userId}`, 20, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }
  if (userId === friendUserId) return { ok: false, error: "invalid" };

  const [a, b] = friendshipPair(userId, friendUserId);

  await prisma.$transaction(async (tx) => {
    await tx.friendship.deleteMany({
      where: { userAId: a, userBId: b },
    });

    // La amistad aceptada deja FriendRequest en ACCEPTED; hay que cerrarla
    // para poder volver a enviar solicitud después.
    await tx.friendRequest.updateMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: friendUserId },
          { fromUserId: friendUserId, toUserId: userId },
        ],
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });

    // Liberar el @@unique(from,to) por completo.
    await tx.friendRequest.deleteMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: friendUserId },
          { fromUserId: friendUserId, toUserId: userId },
        ],
      },
    });
  });

  revalidateFriends(locale);
  return { ok: true };
}

export async function toggleFriendFavorite(
  locale: string,
  friendUserId: string,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };

  const [a, b] = friendshipPair(userId, friendUserId);
  const row = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId: a, userBId: b } },
  });
  if (!row) return { ok: false, error: "not_found" };

  const iAmA = row.userAId === userId;
  await prisma.friendship.update({
    where: { id: row.id },
    data: iAmA
      ? { favoriteForA: !row.favoriteForA }
      : { favoriteForB: !row.favoriteForB },
  });
  revalidateFriends(locale);
  return { ok: true };
}

export async function blockTrainer(
  locale: string,
  targetUserId: string,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (userId === targetUserId) return { ok: false, error: "invalid" };
  if (!allowAction(`friends:block:${userId}`, 15, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }

  await prisma.$transaction(async (tx) => {
    const [a, b] = friendshipPair(userId, targetUserId);
    await tx.friendship.deleteMany({ where: { userAId: a, userBId: b } });
    await tx.friendRequest.updateMany({
      where: {
        status: { in: ["PENDING", "ACCEPTED"] },
        OR: [
          { fromUserId: userId, toUserId: targetUserId },
          { fromUserId: targetUserId, toUserId: userId },
        ],
      },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
    await tx.friendRequest.deleteMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: targetUserId },
          { fromUserId: targetUserId, toUserId: userId },
        ],
      },
    });
    await tx.userBlock.upsert({
      where: {
        blockerId_blockedId: { blockerId: userId, blockedId: targetUserId },
      },
      create: { blockerId: userId, blockedId: targetUserId },
      update: {},
    });
  });

  revalidateFriends(locale);
  return { ok: true };
}

export async function unblockTrainer(
  locale: string,
  targetUserId: string,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };

  await prisma.userBlock.deleteMany({
    where: { blockerId: userId, blockedId: targetUserId },
  });
  revalidateFriends(locale);
  return { ok: true };
}
