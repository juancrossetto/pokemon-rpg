import type { RewardBundle } from "@/lib/events/rewards";

export type TowerFloorType = "normal" | "elite" | "boss" | "rest";

export type TowerRunStatusUi =
  | "not_started"
  | "locked"
  | "active"
  | "awaiting_battle"
  | "in_battle"
  | "awaiting_blessing"
  | "resting"
  | "failed"
  | "completed"
  | "no_attempts";

export type TowerFloorStatus =
  | "locked"
  | "available"
  | "current"
  | "completed"
  | "failed"
  | "reward_pending";

export type TowerPrimaryActionKind =
  | "start_run"
  | "continue_run"
  | "challenge_floor"
  | "choose_blessing"
  | "rest"
  | "restart_run"
  | "resume_battle"
  | "locked"
  | "completed";

export type TowerModifierCategory = "buff" | "debuff" | "restriction" | "environment";

export type TowerBlessingRarity = "common" | "rare" | "epic";

export type TowerRewardMode = "first_clear" | "repeatable" | "seasonal" | "milestone";

export interface TowerRunRules {
  persistHp: boolean;
  persistDefeatedUnits: boolean;
  clearTemporaryStatuses: boolean;
  teamChangesAllowed: number;
  recoveryEveryFloors: number;
  recoveryPercentage: number;
  bossRecoveryPercentage: number;
  dailyAttempts: number;
}

export interface TowerUnlock {
  minBadges: number;
}

export interface TowerDifficulty {
  id: string;
  nameKey: string;
  unlockedByDefault: boolean;
  /** Stub MVP: Experto no jugable. */
  playable: boolean;
}

export interface TowerModifier {
  id: string;
  nameKey: string;
  descriptionKey: string;
  category: TowerModifierCategory;
  value?: number;
}

export interface TowerEnemyDef {
  speciesId: number;
  level: number;
  /** Multiplicador suave de HP (1 = base). */
  hpMult?: number;
}

export interface TowerFloorReward {
  id: string;
  rewardMode: TowerRewardMode;
  bundle: RewardBundle;
}

export interface TowerFloor {
  id: string;
  towerId: string;
  floorNumber: number;
  type: TowerFloorType;
  recommendedCombatPower: number;
  enemies: TowerEnemyDef[];
  modifiers: TowerModifier[];
  rewards: TowerFloorReward[];
  firstClearRewards: TowerFloorReward[];
  waves: number;
  guardianId?: string;
}

export interface TowerBlessingEffect {
  kind:
    | "max_hp_pct"
    | "speed_pct"
    | "heal_team_pct"
    | "revive_one_pct"
    | "type_damage_pct"
    | "coins_pct"
    | "shield_first_hit";
  value: number;
  type?: string;
}

export interface TowerBlessing {
  id: string;
  nameKey: string;
  descriptionKey: string;
  rarity: TowerBlessingRarity;
  maxStacks: number;
  effects: TowerBlessingEffect[];
}

export interface TowerConfig {
  id: string;
  nameKey: string;
  totalFloors: number;
  infinite: boolean;
  resetType: "none" | "weekly" | "monthly" | "seasonal";
  unlock: TowerUnlock;
  rules: TowerRunRules;
  difficulties: TowerDifficulty[];
  blessingOfferFloors: number[];
}

/** Miembro del snapshot del intento (JSON en TowerRun.teamSnapshot). */
export interface TowerRunCreature {
  instanceId: string;
  slot: number;
  speciesId: number;
  speciesName: string;
  nickname: string | null;
  spriteUrl: string;
  level: number;
  types: string[];
  currentHp: number;
  maxHp: number;
  defeated: boolean;
  /** HP de Aventura a restaurar al cerrar el intento. */
  adventureHp: number;
  /** PP de Aventura + max PP por slot (1–4). */
  adventurePp: { slot: number; pp: number; maxPp: number }[];
}

export interface TowerPrimaryAction {
  action: TowerPrimaryActionKind;
  labelKey: string;
  enabled: boolean;
  reasonKey?: string;
  destination?: string;
}
