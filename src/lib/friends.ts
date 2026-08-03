/**
 * Tipos y helpers del hub Friends — sin Prisma (seguro para el client bundle).
 */

import {
  PRESENCE_AWAY_MS,
  PRESENCE_EXPLORING_MS,
  PRESENCE_ONLINE_MS,
} from "@/lib/friend-rules";
import type { DexRarity } from "@/lib/pokedex";
import type { RankTierId } from "@/lib/trainer-profile";

export type PresenceStatus =
  | "online"
  | "away"
  | "fighting"
  | "gym"
  | "exploring"
  | "offline";

export type FriendFilter =
  | "all"
  | "online"
  | "favorites"
  | "recent"
  | "requests"
  | "blocked";

export type FriendFavoriteSnippet = {
  name: string;
  spriteUrl: string;
  level: number;
  types: string[];
  isShiny: boolean;
};

export type FriendListEntry = {
  userId: string;
  username: string;
  country: string;
  avatarId: string | null;
  /** Nivel de entrenador proxy = máximo nivel de Pokémon. */
  level: number;
  titleId: string;
  /** Rango por medallas — sólo acento de rail / legacy. */
  rankTierId: RankTierId;
  /** Elo clasificatoria — insignia visible. */
  pvpRating: number;
  badgeCount: number;
  regionId: string | null;
  regionLabel: string;
  presence: PresenceStatus;
  lastSeenAt: string | null;
  favorite: FriendFavoriteSnippet | null;
  isFavorite: boolean;
  friendsSince: string;
};

export type FriendRequestEntry = {
  id: string;
  direction: "incoming" | "outgoing";
  userId: string;
  username: string;
  country: string;
  avatarId: string | null;
  level: number;
  createdAt: string;
};

export type BlockedEntry = {
  userId: string;
  username: string;
  country: string;
  avatarId: string | null;
  blockedAt: string;
};

export type PlayerSearchHit = {
  userId: string;
  username: string;
  country: string;
  avatarId: string | null;
  level: number;
  relation: "none" | "friend" | "incoming" | "outgoing" | "blocked";
};

export type TrainerCardSquadSlot = {
  slot: number;
  name: string;
  spriteUrl: string;
  level: number;
  currentHp: number;
  maxHp: number;
  types: string[];
  isShiny: boolean;
};

export type TrainerCardActivity = {
  id: string;
  kind: "catch" | "badge" | "trainer";
  label: string;
  detail: string;
  at: string;
};

export type TrainerCardData = {
  userId: string;
  username: string;
  country: string;
  avatarId: string | null;
  level: number;
  titleId: string;
  rankTierId: RankTierId;
  regionId: string | null;
  regionLabel: string;
  badgeCount: number;
  dexCaught: number;
  dexTotal: number;
  pvpWins: number;
  pvpLosses: number;
  pvpRating: number;
  power: number;
  memberSince: string;
  presence: PresenceStatus;
  lastSeenAt: string | null;
  /** Horas jugadas — null hasta que exista el dato real. */
  hoursPlayed: number | null;
  favorite: {
    name: string;
    spriteUrl: string;
    level: number;
    cp: number;
    types: string[];
    rarity: DexRarity;
    isShiny: boolean;
    accent: string;
  } | null;
  squad: TrainerCardSquadSlot[];
  badges: Array<{ id: string; name: string; type: string }>;
  activity: TrainerCardActivity[];
  isFriend: boolean;
  isFavorite: boolean;
  /** Slots futuros (clan, party, raids…) — la UI los ignora si están vacíos. */
  extensions: {
    clanTag: string | null;
  };
};

export type FriendsHubSnapshot = {
  friends: FriendListEntry[];
  requests: FriendRequestEntry[];
  blocked: BlockedEntry[];
  counts: {
    friends: number;
    online: number;
    pendingIncoming: number;
  };
};

export function derivePresence(input: {
  lastSeenAt: Date | string | null;
  inBattle: boolean;
  inGym: boolean;
  campaignFresh?: boolean;
  now?: number;
}): PresenceStatus {
  if (input.inBattle) return "fighting";
  if (input.inGym) return "gym";
  if (!input.lastSeenAt) return "offline";

  const seen =
    typeof input.lastSeenAt === "string"
      ? new Date(input.lastSeenAt).getTime()
      : input.lastSeenAt.getTime();
  const age = (input.now ?? Date.now()) - seen;

  if (age <= PRESENCE_ONLINE_MS) {
    return input.campaignFresh ? "exploring" : "online";
  }
  if (age <= PRESENCE_EXPLORING_MS) return "exploring";
  if (age <= PRESENCE_AWAY_MS) return "away";
  return "offline";
}

export function isPresenceOnlineish(status: PresenceStatus): boolean {
  return (
    status === "online" ||
    status === "exploring" ||
    status === "fighting" ||
    status === "gym"
  );
}

export const PRESENCE_META: Record<
  PresenceStatus,
  { icon: string; dot: string; tone: string }
> = {
  online: { icon: "circle", dot: "bg-emerald-400", tone: "text-emerald-400" },
  exploring: { icon: "explore", dot: "bg-sky-400", tone: "text-sky-400" },
  away: { icon: "schedule", dot: "bg-amber-400", tone: "text-amber-400" },
  fighting: { icon: "swords", dot: "bg-pokeball-red", tone: "text-pokeball-red" },
  gym: { icon: "military_tech", dot: "bg-tertiary", tone: "text-tertiary" },
  offline: { icon: "circle", dot: "bg-white/25", tone: "text-on-surface-variant" },
};
