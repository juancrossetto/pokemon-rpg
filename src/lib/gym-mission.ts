import {
  gymBadgeImageUrl,
  gymDifficultyStars,
  gymLeaderPortraitUrl,
} from "@/lib/gym-art";
import { GYM_MAP_POINTS, KANTO_MAP_IMAGE } from "@/lib/gym-map";
import type { GymStatus } from "@/lib/gym-status";
import { getWeaknesses } from "@/lib/type-effectiveness";

export type GymMissionStatusKind =
  | "cleared"
  | "locked"
  | "cooldown"
  | "closed"
  | "available";

export type GymMissionTeamMember = {
  id: string;
  name: string;
  level: number;
  spriteUrl: string;
  types: string[];
};

export type GymMissionItem = {
  id: string;
  order: number;
  name: string;
  leaderName: string;
  badgeName: string;
  type: string;
  coinReward: number;
  badgeEarned: boolean;
  locked: boolean;
  onCooldown: boolean;
  hoursLeft: number;
  closed: boolean;
  opensHour: number;
  closesHour: number;
  minLevel: number;
  maxLevel: number;
  recommendedLevel: number;
  difficulty: number;
  portraitUrl: string | null;
  badgeUrl: string;
  mapSrc: string;
  mapFocusX: number;
  mapFocusY: number;
  team: GymMissionTeamMember[];
  weaknesses: string[];
  trainerCount: number;
  status: GymMissionStatusKind;
};

export function gymMissionStatus(status: GymStatus): GymMissionStatusKind {
  if (status.badgeEarned) return "cleared";
  if (status.locked) return "locked";
  if (status.onCooldown) return "cooldown";
  if (status.closed) return "closed";
  return "available";
}

export function toGymMissionItems(statuses: GymStatus[]): GymMissionItem[] {
  return statuses.map((status) => {
    const { gym } = status;
    const levels = gym.team.map((m) => m.level);
    const minLevel = levels.length ? Math.min(...levels) : 1;
    const maxLevel = levels.length ? Math.max(...levels) : 1;
    const mapPoint = GYM_MAP_POINTS.find((p) => p.order === gym.order);

    return {
      id: gym.id,
      order: gym.order,
      name: gym.name,
      leaderName: gym.leaderName,
      badgeName: gym.badgeName,
      type: gym.type,
      coinReward: gym.coinReward,
      badgeEarned: status.badgeEarned,
      locked: status.locked,
      onCooldown: status.onCooldown,
      hoursLeft: status.hoursLeft,
      closed: status.closed,
      opensHour: status.opensHour,
      closesHour: status.closesHour,
      minLevel,
      maxLevel,
      recommendedLevel: maxLevel,
      difficulty: gymDifficultyStars(gym.order),
      portraitUrl: gymLeaderPortraitUrl(gym.leaderName),
      badgeUrl: gymBadgeImageUrl(gym.type),
      mapSrc: KANTO_MAP_IMAGE,
      mapFocusX: mapPoint?.x ?? 50,
      mapFocusY: mapPoint?.y ?? 50,
      team: gym.team.map((member) => ({
        id: member.id,
        name: member.species.name,
        level: member.level,
        spriteUrl: member.species.spriteUrl,
        types: member.species.types,
      })),
      weaknesses: getWeaknesses(gym.type),
      trainerCount: gym.trainers.length,
      status: gymMissionStatus(status),
    };
  });
}
