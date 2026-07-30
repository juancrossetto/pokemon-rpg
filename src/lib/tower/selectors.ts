import { COMBAT_TOWER_CONFIG, DEFAULT_DIFFICULTY_ID, DEFAULT_TOWER_ID } from "./config";
import { getNextGuardianFloor, getNextMilestoneFloor, getTowerFloor, getTowerFloors } from "./floors";
import { averageHpRatio, livingCount } from "./blessings";
import type {
  TowerFloor,
  TowerFloorStatus,
  TowerPrimaryAction,
  TowerRunCreature,
  TowerRunStatusUi,
} from "./types";

export function isTowerUnlocked(badgeCount: number, minBadges = COMBAT_TOWER_CONFIG.unlock.minBadges): boolean {
  return badgeCount >= minBadges;
}

export function canChallengeFloor(input: {
  unlocked: boolean;
  runStatus: string | null;
  currentFloor: number;
  targetFloor: number;
  hasLiving: boolean;
  inBattle: boolean;
}): boolean {
  if (!input.unlocked || input.inBattle) return false;
  if (input.runStatus !== "ACTIVE") return false;
  if (!input.hasLiving) return false;
  return input.targetFloor === input.currentFloor;
}

export function getFloorStatus(input: {
  floorNumber: number;
  currentFloor: number;
  highestCleared: number;
  runActive: boolean;
}): TowerFloorStatus {
  const { floorNumber, currentFloor, highestCleared, runActive } = input;
  if (floorNumber < currentFloor || floorNumber <= highestCleared) return "completed";
  if (runActive && floorNumber === currentFloor) return "current";
  if (runActive && floorNumber === currentFloor + 1) return "available";
  if (floorNumber > currentFloor) return "locked";
  return "locked";
}

export function getTowerRunStatusUi(input: {
  unlocked: boolean;
  attemptsRemaining: number;
  runStatus: string | null;
  inBattle: boolean;
  team: TowerRunCreature[] | null;
}): TowerRunStatusUi {
  if (!input.unlocked) return "locked";
  if (input.inBattle) return "in_battle";
  if (!input.runStatus) {
    return input.attemptsRemaining <= 0 ? "no_attempts" : "not_started";
  }
  switch (input.runStatus) {
    case "AWAITING_BLESSING":
      return "awaiting_blessing";
    case "RESTING":
      return "resting";
    case "FAILED":
      return "failed";
    case "COMPLETED":
      return "completed";
    case "ABANDONED":
      return "not_started";
    case "ACTIVE":
      if (input.team && livingCount(input.team) <= 0) return "failed";
      return "active";
    default:
      return "not_started";
  }
}

export function getNextTowerAction(input: {
  unlocked: boolean;
  attemptsRemaining: number;
  runStatus: string | null;
  inBattle: boolean;
  currentFloor: number;
  floor: TowerFloor | undefined;
  team: TowerRunCreature[] | null;
}): TowerPrimaryAction {
  if (!input.unlocked) {
    return {
      action: "locked",
      labelKey: "actions.locked",
      enabled: false,
      reasonKey: "errors.unlockBadges",
    };
  }
  if (input.inBattle) {
    return {
      action: "resume_battle",
      labelKey: "actions.resumeBattle",
      enabled: true,
      destination: "/battle",
    };
  }
  if (input.runStatus === "AWAITING_BLESSING") {
    return {
      action: "choose_blessing",
      labelKey: "actions.chooseBlessing",
      enabled: true,
    };
  }
  if (input.runStatus === "RESTING") {
    return {
      action: "rest",
      labelKey: "actions.rest",
      enabled: true,
    };
  }
  if (input.runStatus === "COMPLETED") {
    return {
      action: "completed",
      labelKey: "actions.completed",
      enabled: false,
      reasonKey: "errors.towerCleared",
    };
  }
  if (input.runStatus === "ACTIVE") {
    const hasLiving = input.team ? livingCount(input.team) > 0 : false;
    if (!hasLiving) {
      return {
        action: "restart_run",
        labelKey: "actions.startRun",
        enabled: input.attemptsRemaining > 0,
        reasonKey: input.attemptsRemaining > 0 ? undefined : "errors.noAttempts",
      };
    }
    if (input.floor?.type === "rest") {
      return {
        action: "rest",
        labelKey: "actions.rest",
        enabled: true,
      };
    }
    return {
      action: "challenge_floor",
      labelKey: "actions.challengeFloor",
      enabled: true,
    };
  }

  if (input.attemptsRemaining <= 0) {
    return {
      action: "locked",
      labelKey: "actions.startRun",
      enabled: false,
      reasonKey: "errors.noAttempts",
    };
  }

  return {
    action: "start_run",
    labelKey: "actions.startRun",
    enabled: true,
  };
}

export function visibleFloorWindow(input: {
  currentFloor: number;
  totalFloors: number;
  behind?: number;
  ahead?: number;
}): number[] {
  const behind = input.behind ?? 2;
  const ahead = input.ahead ?? 3;
  const start = Math.max(1, input.currentFloor - behind);
  const end = Math.min(input.totalFloors, input.currentFloor + ahead);
  const out: number[] = [];
  for (let n = end; n >= start; n--) out.push(n);
  return out;
}

export function getTowerSummary(input: {
  currentFloor: number;
  highestAllTime: number;
  highestSeason: number;
  attemptsUsed: number;
  attemptsMax: number;
  towerId?: string;
}) {
  const towerId = input.towerId ?? DEFAULT_TOWER_ID;
  const floor = getTowerFloor(input.currentFloor, towerId);
  return {
    currentFloor: input.currentFloor,
    highestAllTime: input.highestAllTime,
    highestSeason: input.highestSeason,
    attemptsRemaining: Math.max(0, input.attemptsMax - input.attemptsUsed),
    attemptsMax: input.attemptsMax,
    nextGuardian: getNextGuardianFloor(input.currentFloor, towerId),
    nextMilestone: getNextMilestoneFloor(input.currentFloor, towerId),
    floorType: floor?.type ?? null,
    recommendedPc: floor?.recommendedCombatPower ?? null,
  };
}

export function autoAscentShouldStop(input: {
  floorType: TowerFloorTypeLike;
  team: TowerRunCreature[];
  awaitingBlessing: boolean;
  hpThreshold?: number;
}): boolean {
  if (input.awaitingBlessing) return true;
  if (input.floorType === "boss" || input.floorType === "rest" || input.floorType === "elite") {
    return true;
  }
  if (livingCount(input.team) < input.team.length) return true;
  const threshold = input.hpThreshold ?? 0.4;
  return averageHpRatio(input.team) < threshold;
}

type TowerFloorTypeLike = "normal" | "elite" | "boss" | "rest";

export function listFloorsForPath(towerId = DEFAULT_TOWER_ID): TowerFloor[] {
  return getTowerFloors(towerId);
}

export { DEFAULT_DIFFICULTY_ID, DEFAULT_TOWER_ID, COMBAT_TOWER_CONFIG };
