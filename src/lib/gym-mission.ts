import {
  gymBadgeImageUrl,
  gymDifficultyStars,
  gymLeaderPortraitScale,
  gymLeaderPortraitUrl,
} from "@/lib/gym-art";
import { gymPoint } from "@/lib/campaign/region-map";
import { regionMapSrc, type GameRegionId } from "@/lib/regions";
import type { GymStatus } from "@/lib/gym-status";
import { getWeaknesses } from "@/lib/type-effectiveness";

export type GymMissionStatusKind =
  | "cleared"
  | "locked"
  | "stages"
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
  regionId: string;
  order: number;
  name: string;
  leaderName: string;
  badgeName: string;
  type: string;
  coinReward: number;
  badgeEarned: boolean;
  locked: boolean;
  stagesIncomplete: boolean;
  onCooldown: boolean;
  hoursLeft: number;
  remainingMs: number;
  closed: boolean;
  opensHour: number;
  closesHour: number;
  minLevel: number;
  maxLevel: number;
  recommendedLevel: number;
  difficulty: number;
  portraitUrl: string | null;
  /** Compensa líderes anchos para que no se vean más chicos que Brock/Erika. */
  portraitScale: number;
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
  if (status.stagesIncomplete) return "stages";
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
    const regionId = gym.regionId as GameRegionId;
    const mapPoint = gymPoint(gym.order, regionId);

    return {
      id: gym.id,
      regionId: gym.regionId,
      order: gym.order,
      name: gym.name,
      leaderName: gym.leaderName,
      badgeName: gym.badgeName,
      type: gym.type,
      coinReward: gym.coinReward,
      badgeEarned: status.badgeEarned,
      locked: status.locked,
      stagesIncomplete: status.stagesIncomplete,
      onCooldown: status.onCooldown,
      hoursLeft: status.hoursLeft,
      remainingMs: status.remainingMs,
      closed: status.closed,
      opensHour: status.opensHour,
      closesHour: status.closesHour,
      minLevel,
      maxLevel,
      recommendedLevel: maxLevel,
      difficulty: gymDifficultyStars(gym.order),
      portraitUrl: gymLeaderPortraitUrl(gym.leaderName),
      portraitScale: gymLeaderPortraitScale(gym.leaderName),
      badgeUrl: gymBadgeImageUrl(gym.type),
      mapSrc: regionMapSrc(gym.regionId),
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
