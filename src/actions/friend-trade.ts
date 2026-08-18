"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { allowAction } from "@/lib/rate-limit";
import { friendshipPair } from "@/lib/friend-rules";
import { busyPokemonIds } from "@/lib/pokemon-busy";
import { compactTeamSlots } from "@/lib/team";
import { markSpeciesSeen } from "@/lib/pokedex-seen";
import { spriteFor } from "@/lib/shiny";
import { notifyFriendTrade } from "@/lib/notifications";
import type { FriendTradePokemon } from "@/lib/friends";

type Fail = { ok: false; error: string };
type Ok = { ok: true; notice?: "offered" | "traded" | "cancelled" };
type Result = Ok | Fail;

function revalidateFriends(locale: string) {
  revalidatePath(`/${locale}/friends`);
  revalidatePath(`/${locale}`, "layout");
}

async function requireUser(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

async function areFriends(tx: Prisma.TransactionClient, aId: string, bId: string) {
  const [a, b] = friendshipPair(aId, bId);
  const row = await tx.friendship.findUnique({
    where: { userAId_userBId: { userAId: a, userBId: b } },
    select: { userAId: true },
  });
  return Boolean(row);
}

async function assertTradable(
  tx: Prisma.TransactionClient,
  userId: string,
  instanceId: string,
): Promise<string | null> {
  const mon = await tx.pokemonInstance.findFirst({
    where: { id: instanceId, ownerId: userId },
    include: { listings: { where: { status: "ACTIVE" }, select: { id: true } } },
  });
  if (!mon) return "not_found";
  if (mon.teamSlot !== null) return "in_team";
  if (mon.isTradeLocked) return "trade_locked";
  if (mon.listings.length > 0) return "listed";
  const busy = await busyPokemonIds(tx, userId);
  if (busy.has(instanceId)) return "occupied";
  return null;
}

function toSnippet(row: {
  id: string;
  nickname: string | null;
  level: number;
  isShiny: boolean;
  species: { name: string; spriteUrl: string };
}): FriendTradePokemon {
  return {
    instanceId: row.id,
    name: row.nickname ?? row.species.name,
    speciesName: row.species.name,
    spriteUrl: spriteFor(row.species.spriteUrl, row.isShiny),
    level: row.level,
    isShiny: row.isShiny,
  };
}

export async function listTradablePokemon(): Promise<
  { ok: true; pokemon: FriendTradePokemon[] } | Fail
> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!allowAction(`friends:trade-list:${userId}`, 30, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }

  const [rows, busy] = await Promise.all([
    prisma.pokemonInstance.findMany({
      where: {
        ownerId: userId,
        teamSlot: null,
        isTradeLocked: false,
        listings: { none: { status: "ACTIVE" } },
      },
      include: { species: { select: { name: true, spriteUrl: true } } },
      orderBy: { caughtAt: "asc" },
      take: 48,
    }),
    busyPokemonIds(prisma, userId),
  ]);

  return {
    ok: true,
    pokemon: rows.filter((row) => !busy.has(row.id)).map(toSnippet),
  };
}

export async function offerFriendTrade(
  locale: string,
  friendUserId: string,
  instanceId: string,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!friendUserId || friendUserId === userId) return { ok: false, error: "invalid" };
  if (!allowAction(`friends:trade:${userId}`, 12, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }

  let failure: string | null = null;
  let pokemonName = "";
  let fromName = "";

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId, friendUserId);
    if (!(await areFriends(tx, userId, friendUserId))) {
      failure = "not_friends";
      return;
    }
    const blocked = await assertTradable(tx, userId, instanceId);
    if (blocked) {
      failure = blocked;
      return;
    }
    const existing = await tx.friendTradeOffer.findFirst({
      where: {
        OR: [
          { fromUserId: userId },
          { fromUserId: friendUserId, toUserId: userId },
        ],
      },
      select: { id: true, fromUserId: true },
    });
    if (existing) {
      failure = existing.fromUserId === friendUserId ? "incoming_pending" : "already_offered";
      return;
    }
    const mon = await tx.pokemonInstance.findUniqueOrThrow({
      where: { id: instanceId },
      include: { species: { select: { name: true } } },
    });
    const me = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true },
    });
    pokemonName = mon.nickname ?? mon.species.name;
    fromName = me.username;
    await tx.pokemonInstance.update({
      where: { id: instanceId },
      data: { teamSlot: null, pvpSlot: null },
    });
    await tx.friendTradeOffer.create({
      data: {
        fromUserId: userId,
        toUserId: friendUserId,
        pokemonInstanceId: instanceId,
      },
    });
  });

  if (failure) return { ok: false, error: failure };

  await notifyFriendTrade({
    toUserId: friendUserId,
    trainerName: fromName,
    pokemonName,
    href: `/friends?trainer=${userId}`,
  });
  revalidateFriends(locale);
  return { ok: true, notice: "offered" };
}

export async function acceptFriendTrade(
  locale: string,
  offerId: string,
  instanceId: string,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!allowAction(`friends:trade:${userId}`, 12, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }

  let failure: string | null = null;
  let fromUserId = "";
  let toName = "";
  let offeredName = "";
  let receivedSpeciesId = 0;
  let offeredSpeciesId = 0;

  await prisma.$transaction(async (tx) => {
    const offer = await tx.friendTradeOffer.findUnique({
      where: { id: offerId },
      include: {
        pokemon: { include: { species: { select: { id: true, name: true } } } },
        from: { select: { username: true } },
      },
    });
    if (!offer || offer.toUserId !== userId) {
      failure = "not_found";
      return;
    }
    await lockUsers(tx, userId, offer.fromUserId);
    if (!(await areFriends(tx, userId, offer.fromUserId))) {
      failure = "not_friends";
      return;
    }
    const stillOpen = await tx.friendTradeOffer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });
    if (!stillOpen) {
      failure = "not_found";
      return;
    }
    const blocked = await assertTradable(tx, userId, instanceId);
    if (blocked) {
      failure = blocked;
      return;
    }
    const mine = await tx.pokemonInstance.findUniqueOrThrow({
      where: { id: instanceId },
      include: { species: { select: { id: true, name: true } } },
    });
    const me = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true },
    });

    fromUserId = offer.fromUserId;
    toName = me.username;
    offeredName = offer.pokemon.nickname ?? offer.pokemon.species.name;
    offeredSpeciesId = offer.pokemon.species.id;
    receivedSpeciesId = mine.species.id;

    await tx.pokemonInstance.update({
      where: { id: offer.pokemonInstanceId },
      data: { ownerId: userId, teamSlot: null, pvpSlot: null, isFavorite: false },
    });
    await tx.pokemonInstance.update({
      where: { id: instanceId },
      data: {
        ownerId: offer.fromUserId,
        teamSlot: null,
        pvpSlot: null,
        isFavorite: false,
      },
    });
    await tx.friendTradeOffer.delete({ where: { id: offer.id } });
    await compactTeamSlots(tx, userId);
    await compactTeamSlots(tx, offer.fromUserId);
  });

  if (failure) return { ok: false, error: failure };

  await Promise.all([
    markSpeciesSeen(userId, offeredSpeciesId),
    markSpeciesSeen(fromUserId, receivedSpeciesId),
    notifyFriendTrade({
      toUserId: fromUserId,
      trainerName: toName,
      pokemonName: offeredName,
      href: `/friends?trainer=${userId}`,
      done: true,
    }),
  ]);
  revalidateFriends(locale);
  return { ok: true, notice: "traded" };
}

export async function cancelFriendTrade(
  locale: string,
  offerId: string,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!allowAction(`friends:trade:${userId}`, 20, 60_000)) {
    return { ok: false, error: "rate_limited" };
  }

  let failure: string | null = null;
  await prisma.$transaction(async (tx) => {
    const offer = await tx.friendTradeOffer.findUnique({
      where: { id: offerId },
      select: { id: true, fromUserId: true, toUserId: true },
    });
    if (!offer || (offer.fromUserId !== userId && offer.toUserId !== userId)) {
      failure = "not_found";
      return;
    }
    await lockUsers(tx, offer.fromUserId, offer.toUserId);
    const still = await tx.friendTradeOffer.findUnique({ where: { id: offerId } });
    if (!still) {
      failure = "not_found";
      return;
    }
    await tx.friendTradeOffer.delete({ where: { id: offerId } });
  });
  if (failure) return { ok: false, error: failure };
  revalidateFriends(locale);
  return { ok: true, notice: "cancelled" };
}
