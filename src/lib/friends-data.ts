import { prisma } from "@/lib/prisma";
import { regionMeta } from "@/lib/campaign/regions";
import { calculateMaxHp } from "@/lib/stats";
import { pokemonPower, teamPower } from "@/lib/ranking";
import { speciesRarity } from "@/lib/pokedex";
import { typeColor } from "@/lib/type-colors";
import {
  mergeTimeline,
  rankProgress,
  trainerTitle,
  type TimelineEvent,
  type TrainerStats,
} from "@/lib/trainer-profile";
import {
  derivePresence,
  isPresenceOnlineish,
  type BlockedEntry,
  type FriendListEntry,
  type FriendRequestEntry,
  type FriendsHubSnapshot,
  type PlayerSearchHit,
  type TrainerCardData,
} from "@/lib/friends";
import { friendshipPair } from "@/lib/friend-rules";

const SPECIES_SELECT = {
  id: true,
  name: true,
  spriteUrl: true,
  types: true,
  captureRate: true,
  baseHp: true,
  baseAttack: true,
  baseDefense: true,
  baseSpAtk: true,
  baseSpDef: true,
  baseSpeed: true,
} as const;

function regionLabel(regionId: string | null | undefined): string {
  if (!regionId) return "—";
  const id = regionMeta(regionId).id;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

async function presenceFlags(userIds: string[]) {
  if (userIds.length === 0) {
    return { fighting: new Set<string>(), gym: new Set<string>() };
  }
  const [battles, gyms] = await Promise.all([
    prisma.battleSession.findMany({
      where: { userId: { in: userIds }, status: "ACTIVE" },
      select: { userId: true },
    }),
    prisma.gymRun.findMany({
      where: { userId: { in: userIds }, status: "ACTIVE" },
      select: { userId: true },
    }),
  ]);
  return {
    fighting: new Set(battles.map((b) => b.userId)),
    gym: new Set(gyms.map((g) => g.userId)),
  };
}

type UserRow = {
  id: string;
  username: string;
  country: string;
  avatarId: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  pvpWins: number;
  pvpLosses: number;
  pvpRating: number;
  campaignProgress: { currentRegionId: string; updatedAt: Date } | null;
  clanMembership: { clan: { tag: string } } | null;
};

async function loadUserRows(ids: string[]): Promise<Map<string, UserRow>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      username: true,
      country: true,
      avatarId: true,
      lastSeenAt: true,
      createdAt: true,
      pvpWins: true,
      pvpLosses: true,
      pvpRating: true,
      campaignProgress: { select: { currentRegionId: true, updatedAt: true } },
      clanMembership: { select: { clan: { select: { tag: true } } } },
    },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

async function loadListMetrics(userIds: string[]) {
  if (userIds.length === 0) {
    return {
      badgeCounts: new Map<string, number>(),
      topLevels: new Map<string, number>(),
      dexCounts: new Map<string, number>(),
      favorites: new Map<
        string,
        { name: string; spriteUrl: string; level: number; types: string[]; isShiny: boolean }
      >(),
    };
  }

  const [badges, levels, dex, favorites, leads] = await Promise.all([
    prisma.badge.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.pokemonInstance.groupBy({
      by: ["ownerId"],
      where: { ownerId: { in: userIds } },
      _max: { level: true },
    }),
    prisma.pokedexEntry.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.pokemonInstance.findMany({
      where: { ownerId: { in: userIds }, isFavorite: true },
      select: {
        ownerId: true,
        nickname: true,
        level: true,
        isShiny: true,
        species: { select: { name: true, spriteUrl: true, types: true } },
      },
    }),
    prisma.pokemonInstance.findMany({
      where: { ownerId: { in: userIds }, teamSlot: 1 },
      select: {
        ownerId: true,
        nickname: true,
        level: true,
        isShiny: true,
        species: { select: { name: true, spriteUrl: true, types: true } },
      },
    }),
  ]);

  const badgeCounts = new Map(badges.map((b) => [b.userId, b._count._all]));
  const topLevels = new Map(
    levels.map((l) => [l.ownerId, l._max.level ?? 1]),
  );
  const dexCounts = new Map(dex.map((d) => [d.userId, d._count._all]));

  const favMap = new Map<
    string,
    { name: string; spriteUrl: string; level: number; types: string[]; isShiny: boolean }
  >();
  for (const row of favorites) {
    if (favMap.has(row.ownerId)) continue;
    favMap.set(row.ownerId, {
      name: row.nickname ?? row.species.name,
      spriteUrl: row.species.spriteUrl,
      level: row.level,
      types: row.species.types,
      isShiny: row.isShiny,
    });
  }
  for (const row of leads) {
    if (favMap.has(row.ownerId)) continue;
    favMap.set(row.ownerId, {
      name: row.nickname ?? row.species.name,
      spriteUrl: row.species.spriteUrl,
      level: row.level,
      types: row.species.types,
      isShiny: row.isShiny,
    });
  }

  return { badgeCounts, topLevels, dexCounts, favorites: favMap };
}

function lightTitle(input: {
  badges: number;
  totalGyms: number;
  dex: number;
  pvpWins: number;
  topLevel: number;
}): string {
  const stats: TrainerStats = {
    caught: input.dex,
    shinies: 0,
    species: input.dex,
    dexSeen: input.dex,
    dexTotal: 151,
    badges: input.badges,
    totalGyms: input.totalGyms,
    pvpWins: input.pvpWins,
    pvpLosses: 0,
    pvpRating: 1000,
    trainersDefeated: 0,
    legendaries: 0,
    mythicals: 0,
    topLevel: input.topLevel,
    power: 0,
  };
  return trainerTitle(stats);
}

export async function touchPresence(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt: new Date() },
  });
}

export async function loadFriendsHub(userId: string): Promise<FriendsHubSnapshot> {
  await touchPresence(userId);

  const [friendships, incoming, outgoing, blocks, totalGyms] = await Promise.all([
    prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: { toUserId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: { fromUserId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.gym.count(),
  ]);

  const friendIds = friendships.map((f) =>
    f.userAId === userId ? f.userBId : f.userAId,
  );
  const requestUserIds = [
    ...incoming.map((r) => r.fromUserId),
    ...outgoing.map((r) => r.toUserId),
  ];
  const blockedIds = blocks.map((b) => b.blockedId);
  const allIds = [...new Set([...friendIds, ...requestUserIds, ...blockedIds])];

  const [users, metrics, flags] = await Promise.all([
    loadUserRows(allIds),
    loadListMetrics([...new Set([...friendIds, ...requestUserIds])]),
    presenceFlags(friendIds),
  ]);

  const now = Date.now();
  const friends: FriendListEntry[] = [];
  for (const f of friendships) {
    const otherId = f.userAId === userId ? f.userBId : f.userAId;
    const u = users.get(otherId);
    if (!u) continue;
    const isFavorite = f.userAId === userId ? f.favoriteForA : f.favoriteForB;
    const badges = metrics.badgeCounts.get(otherId) ?? 0;
    const level = metrics.topLevels.get(otherId) ?? 1;
    const regionId = u.campaignProgress?.currentRegionId ?? null;
    const campaignFresh = Boolean(
      u.campaignProgress &&
        now - u.campaignProgress.updatedAt.getTime() < 10 * 60 * 1000,
    );
    const presence = derivePresence({
      lastSeenAt: u.lastSeenAt,
      inBattle: flags.fighting.has(otherId),
      inGym: flags.gym.has(otherId),
      campaignFresh,
      now,
    });
    friends.push({
      userId: otherId,
      username: u.username,
      country: u.country,
      avatarId: u.avatarId,
      level,
      titleId: lightTitle({
        badges,
        totalGyms,
        dex: metrics.dexCounts.get(otherId) ?? 0,
        pvpWins: u.pvpWins,
        topLevel: level,
      }),
      rankTierId: rankProgress(badges, totalGyms).tier.id,
      pvpRating: u.pvpRating,
      badgeCount: badges,
      regionId,
      regionLabel: regionLabel(regionId),
      presence,
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      favorite: metrics.favorites.get(otherId) ?? null,
      isFavorite,
      friendsSince: f.createdAt.toISOString(),
    });
  }

  const toRequest = (
    r: { id: string; createdAt: Date; fromUserId: string; toUserId: string },
    direction: "incoming" | "outgoing",
  ): FriendRequestEntry | null => {
    const otherId = direction === "incoming" ? r.fromUserId : r.toUserId;
    const u = users.get(otherId);
    if (!u) return null;
    return {
      id: r.id,
      direction,
      userId: otherId,
      username: u.username,
      country: u.country,
      avatarId: u.avatarId,
      level: metrics.topLevels.get(otherId) ?? 1,
      createdAt: r.createdAt.toISOString(),
    };
  };

  const requests = [
    ...incoming.map((r) => toRequest(r, "incoming")),
    ...outgoing.map((r) => toRequest(r, "outgoing")),
  ].filter((r): r is FriendRequestEntry => r !== null);

  const blocked: BlockedEntry[] = blocks
    .map((b) => {
      const u = users.get(b.blockedId);
      if (!u) return null;
      return {
        userId: b.blockedId,
        username: u.username,
        country: u.country,
        avatarId: u.avatarId,
        blockedAt: b.createdAt.toISOString(),
      };
    })
    .filter((b): b is BlockedEntry => b !== null);

  return {
    friends,
    requests,
    blocked,
    counts: {
      friends: friends.length,
      online: friends.filter((f) => isPresenceOnlineish(f.presence)).length,
      pendingIncoming: requests.filter((r) => r.direction === "incoming").length,
    },
  };
}

export async function searchPlayers(
  viewerId: string,
  query: string,
): Promise<PlayerSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [blockedOut, blockedIn, friendships, pendingFrom, pendingTo] =
    await Promise.all([
      prisma.userBlock.findMany({
        where: { blockerId: viewerId },
        select: { blockedId: true },
      }),
      prisma.userBlock.findMany({
        where: { blockedId: viewerId },
        select: { blockerId: true },
      }),
      prisma.friendship.findMany({
        where: { OR: [{ userAId: viewerId }, { userBId: viewerId }] },
        select: { userAId: true, userBId: true },
      }),
      prisma.friendRequest.findMany({
        where: { fromUserId: viewerId, status: "PENDING" },
        select: { toUserId: true },
      }),
      prisma.friendRequest.findMany({
        where: { toUserId: viewerId, status: "PENDING" },
        select: { fromUserId: true },
      }),
    ]);

  const blocked = new Set([
    ...blockedOut.map((b) => b.blockedId),
    ...blockedIn.map((b) => b.blockerId),
  ]);
  const friendSet = new Set(
    friendships.map((f) => (f.userAId === viewerId ? f.userBId : f.userAId)),
  );
  const outgoing = new Set(pendingFrom.map((r) => r.toUserId));
  const incoming = new Set(pendingTo.map((r) => r.fromUserId));

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: viewerId } },
        {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            ...(q.length >= 8 ? [{ id: q }] : []),
          ],
        },
      ],
    },
    take: 12,
    select: {
      id: true,
      username: true,
      country: true,
      avatarId: true,
    },
    orderBy: { username: "asc" },
  });

  const ids = users.map((u) => u.id);
  const levels = await prisma.pokemonInstance.groupBy({
    by: ["ownerId"],
    where: { ownerId: { in: ids } },
    _max: { level: true },
  });
  const levelMap = new Map(levels.map((l) => [l.ownerId, l._max.level ?? 1]));

  return users
    .filter((u) => !blocked.has(u.id))
    .map((u) => {
      let relation: PlayerSearchHit["relation"] = "none";
      if (friendSet.has(u.id)) relation = "friend";
      else if (incoming.has(u.id)) relation = "incoming";
      else if (outgoing.has(u.id)) relation = "outgoing";
      return {
        userId: u.id,
        username: u.username,
        country: u.country,
        avatarId: u.avatarId,
        level: levelMap.get(u.id) ?? 1,
        relation,
      };
    });
}

export async function loadTrainerCard(
  viewerId: string,
  targetId: string,
): Promise<TrainerCardData | null> {
  if (viewerId === targetId) return null;

  const blocked = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: targetId },
        { blockerId: targetId, blockedId: viewerId },
      ],
    },
    select: { id: true },
  });
  if (blocked) return null;

  const [user, team, badges, badgeCount, totalGyms, friendship, counts, recentCatches, recentDefeats, flags] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          username: true,
          country: true,
          avatarId: true,
          createdAt: true,
          lastSeenAt: true,
          pvpWins: true,
          pvpLosses: true,
          pvpRating: true,
          campaignProgress: { select: { currentRegionId: true, updatedAt: true } },
          clanMembership: { select: { clan: { select: { tag: true } } } },
        },
      }),
      prisma.pokemonInstance.findMany({
        where: { ownerId: targetId, teamSlot: { not: null } },
        select: {
          id: true,
          nickname: true,
          level: true,
          currentHp: true,
          isShiny: true,
          isFavorite: true,
          teamSlot: true,
          ptStrength: true,
          ptSpeed: true,
          ptDexterity: true,
          ptIntelligence: true,
          ptConstitution: true,
          species: { select: SPECIES_SELECT },
        },
        orderBy: { teamSlot: "asc" },
      }),
      prisma.badge.findMany({
        where: { userId: targetId },
        select: {
          id: true,
          earnedAt: true,
          gym: { select: { name: true, badgeName: true, type: true, leaderName: true } },
        },
        orderBy: { earnedAt: "desc" },
        take: 12,
      }),
      prisma.badge.count({ where: { userId: targetId } }),
      prisma.gym.count(),
      prisma.friendship.findUnique({
        where: {
          userAId_userBId: (() => {
            const [a, b] = friendshipPair(viewerId, targetId);
            return { userAId: a, userBId: b };
          })(),
        },
      }),
      Promise.all([
        prisma.pokemonInstance.count({ where: { ownerId: targetId } }),
        prisma.pokemonInstance.count({ where: { ownerId: targetId, isShiny: true } }),
        prisma.pokedexEntry.count({ where: { userId: targetId } }),
        prisma.species.count(),
        prisma.trainerDefeat.count({ where: { userId: targetId } }),
        prisma.pokemonInstance.aggregate({
          where: { ownerId: targetId },
          _max: { level: true },
        }),
      ]),
      prisma.pokemonInstance.findMany({
        where: { ownerId: targetId },
        select: {
          id: true,
          nickname: true,
          level: true,
          isShiny: true,
          caughtAt: true,
          species: {
            select: { name: true, spriteUrl: true, types: true, captureRate: true, id: true },
          },
        },
        orderBy: { caughtAt: "desc" },
        take: 4,
      }),
      prisma.trainerDefeat.findMany({
        where: { userId: targetId },
        select: { trainerId: true, defeatedAt: true, locationId: true },
        orderBy: { defeatedAt: "desc" },
        take: 4,
      }),
      presenceFlags([targetId]),
    ]);

  if (!user) return null;

  const [caught, shinies, dexCaught, dexTotal, trainersDefeated, levelAgg] = counts;
  const topLevel = levelAgg._max.level ?? 1;
  const power = teamPower(team);
  const stats: TrainerStats = {
    caught,
    shinies,
    species: dexCaught,
    dexSeen: dexCaught,
    dexTotal,
    badges: badgeCount,
    totalGyms,
    pvpWins: user.pvpWins,
    pvpLosses: user.pvpLosses,
    pvpRating: user.pvpRating,
    trainersDefeated,
    legendaries: 0,
    mythicals: 0,
    topLevel,
    power,
  };

  const favoriteRow =
    team.find((p) => p.isFavorite) ?? team.find((p) => p.teamSlot === 1) ?? null;
  const favorite = favoriteRow
    ? {
        name: favoriteRow.nickname ?? favoriteRow.species.name,
        spriteUrl: favoriteRow.species.spriteUrl,
        level: favoriteRow.level,
        cp: pokemonPower(favoriteRow),
        types: favoriteRow.species.types,
        rarity: speciesRarity(favoriteRow.species),
        isShiny: favoriteRow.isShiny,
        accent: typeColor(favoriteRow.species.types[0] ?? "normal"),
      }
    : null;

  const squad = team.map((p) => {
    const maxHp = calculateMaxHp(
      p.species.baseHp,
      p.level,
      p.ptConstitution,
    );
    return {
      slot: p.teamSlot ?? 0,
      name: p.nickname ?? p.species.name,
      spriteUrl: p.species.spriteUrl,
      level: p.level,
      currentHp: p.currentHp,
      maxHp,
      types: p.species.types,
      isShiny: p.isShiny,
    };
  });

  const timelineSeed: TimelineEvent[] = [
    ...badges.slice(0, 4).map((b) => ({
      id: `badge-${b.id}`,
      kind: "badge" as const,
      at: b.earnedAt,
      label: b.gym.badgeName,
      accent: b.gym.type,
    })),
    ...recentCatches.map((c) => ({
      id: `catch-${c.id}`,
      kind: "catch" as const,
      at: c.caughtAt,
      label: c.nickname ?? c.species.name,
      spriteUrl: c.species.spriteUrl,
    })),
    ...recentDefeats.map((d) => ({
      id: `trainer-${d.trainerId}-${d.defeatedAt.toISOString()}`,
      kind: "trainer" as const,
      at: d.defeatedAt,
      label: d.trainerId,
    })),
  ];
  const activity = mergeTimeline(timelineSeed, 5)
    .filter((e): e is TimelineEvent & { kind: "catch" | "badge" | "trainer" } =>
      e.kind === "catch" || e.kind === "badge" || e.kind === "trainer",
    )
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      label: e.label,
      detail: e.accent ?? "",
      at: e.at.toISOString(),
    }));

  const regionId = user.campaignProgress?.currentRegionId ?? null;
  const now = Date.now();
  const campaignFresh = Boolean(
    user.campaignProgress &&
      now - user.campaignProgress.updatedAt.getTime() < 10 * 60 * 1000,
  );
  const presence = derivePresence({
    lastSeenAt: user.lastSeenAt,
    inBattle: flags.fighting.has(targetId),
    inGym: flags.gym.has(targetId),
    campaignFresh,
    now,
  });

  const isFriend = Boolean(friendship);
  const isFavorite = friendship
    ? friendship.userAId === viewerId
      ? friendship.favoriteForA
      : friendship.favoriteForB
    : false;

  return {
    userId: user.id,
    username: user.username,
    country: user.country,
    avatarId: user.avatarId,
    level: topLevel,
    titleId: trainerTitle(stats),
    rankTierId: rankProgress(badgeCount, totalGyms).tier.id,
    regionId,
    regionLabel: regionLabel(regionId),
    badgeCount,
    dexCaught,
    dexTotal,
    pvpWins: user.pvpWins,
    pvpLosses: user.pvpLosses,
    pvpRating: user.pvpRating,
    power,
    memberSince: user.createdAt.toISOString(),
    presence,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    hoursPlayed: null,
    favorite,
    squad,
    badges: badges.map((b) => ({
      id: b.id,
      name: b.gym.badgeName,
      type: b.gym.type,
    })),
    activity,
    isFriend,
    isFavorite,
    extensions: {
      clanTag: user.clanMembership?.clan.tag ?? null,
    },
  };
}
