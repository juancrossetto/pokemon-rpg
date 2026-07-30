import type { TowerBlessing, TowerConfig, TowerModifier } from "./types";

export const DEFAULT_TOWER_ID = "combat-tower";
export const DEFAULT_DIFFICULTY_ID = "normal";

export const TOWER_MODIFIERS: Record<string, TowerModifier> = {
  sun_field: {
    id: "sun_field",
    nameKey: "modifiers.sun_field.name",
    descriptionKey: "modifiers.sun_field.desc",
    category: "environment",
  },
  rain_field: {
    id: "rain_field",
    nameKey: "modifiers.rain_field.name",
    descriptionKey: "modifiers.rain_field.desc",
    category: "environment",
  },
  fire_boost: {
    id: "fire_boost",
    nameKey: "modifiers.fire_boost.name",
    descriptionKey: "modifiers.fire_boost.desc",
    category: "buff",
    value: 15,
  },
  heal_cut: {
    id: "heal_cut",
    nameKey: "modifiers.heal_cut.name",
    descriptionKey: "modifiers.heal_cut.desc",
    category: "debuff",
    value: 50,
  },
  speed_surge: {
    id: "speed_surge",
    nameKey: "modifiers.speed_surge.name",
    descriptionKey: "modifiers.speed_surge.desc",
    category: "buff",
    value: 10,
  },
  no_items: {
    id: "no_items",
    nameKey: "modifiers.no_items.name",
    descriptionKey: "modifiers.no_items.desc",
    category: "restriction",
  },
};

/** 10 bendiciones bien diferenciadas para el MVP. */
export const TOWER_BLESSINGS: TowerBlessing[] = [
  {
    id: "vitality",
    nameKey: "blessings.vitality.name",
    descriptionKey: "blessings.vitality.desc",
    rarity: "common",
    maxStacks: 2,
    effects: [{ kind: "max_hp_pct", value: 10 }],
  },
  {
    id: "swift",
    nameKey: "blessings.swift.name",
    descriptionKey: "blessings.swift.desc",
    rarity: "common",
    maxStacks: 2,
    effects: [{ kind: "speed_pct", value: 8 }],
  },
  {
    id: "mend",
    nameKey: "blessings.mend.name",
    descriptionKey: "blessings.mend.desc",
    rarity: "common",
    maxStacks: 3,
    effects: [{ kind: "heal_team_pct", value: 20 }],
  },
  {
    id: "second_wind",
    nameKey: "blessings.second_wind.name",
    descriptionKey: "blessings.second_wind.desc",
    rarity: "rare",
    maxStacks: 1,
    effects: [{ kind: "revive_one_pct", value: 30 }],
  },
  {
    id: "tide",
    nameKey: "blessings.tide.name",
    descriptionKey: "blessings.tide.desc",
    rarity: "rare",
    maxStacks: 2,
    effects: [{ kind: "type_damage_pct", value: 15, type: "water" }],
  },
  {
    id: "blaze",
    nameKey: "blessings.blaze.name",
    descriptionKey: "blessings.blaze.desc",
    rarity: "rare",
    maxStacks: 2,
    effects: [{ kind: "type_damage_pct", value: 15, type: "fire" }],
  },
  {
    id: "grove",
    nameKey: "blessings.grove.name",
    descriptionKey: "blessings.grove.desc",
    rarity: "rare",
    maxStacks: 2,
    effects: [{ kind: "type_damage_pct", value: 15, type: "grass" }],
  },
  {
    id: "fortune",
    nameKey: "blessings.fortune.name",
    descriptionKey: "blessings.fortune.desc",
    rarity: "common",
    maxStacks: 2,
    effects: [{ kind: "coins_pct", value: 20 }],
  },
  {
    id: "aegis",
    nameKey: "blessings.aegis.name",
    descriptionKey: "blessings.aegis.desc",
    rarity: "epic",
    maxStacks: 1,
    effects: [{ kind: "shield_first_hit", value: 1 }],
  },
  {
    id: "rally",
    nameKey: "blessings.rally.name",
    descriptionKey: "blessings.rally.desc",
    rarity: "epic",
    maxStacks: 1,
    effects: [{ kind: "heal_team_pct", value: 35 }],
  },
];

export const COMBAT_TOWER_CONFIG: TowerConfig = {
  id: DEFAULT_TOWER_ID,
  nameKey: "displayName",
  totalFloors: 30,
  infinite: false,
  resetType: "weekly",
  unlock: { minBadges: 2 },
  rules: {
    persistHp: true,
    persistDefeatedUnits: true,
    clearTemporaryStatuses: true,
    teamChangesAllowed: 1,
    recoveryEveryFloors: 5,
    recoveryPercentage: 25,
    bossRecoveryPercentage: 50,
    /** Un ascenso por período semanal (domingo 21hs ART). */
    dailyAttempts: 1,
  },
  difficulties: [
    {
      id: "normal",
      nameKey: "difficulties.normal",
      unlockedByDefault: true,
      playable: true,
    },
    {
      id: "expert",
      nameKey: "difficulties.expert",
      unlockedByDefault: false,
      playable: false,
    },
  ],
  blessingOfferFloors: [5, 10, 15, 20, 25],
};

export function getTowerConfig(towerId = DEFAULT_TOWER_ID): TowerConfig {
  if (towerId === COMBAT_TOWER_CONFIG.id) return COMBAT_TOWER_CONFIG;
  return COMBAT_TOWER_CONFIG;
}

export function getBlessing(id: string): TowerBlessing | undefined {
  return TOWER_BLESSINGS.find((b) => b.id === id);
}

export function getModifier(id: string): TowerModifier | undefined {
  return TOWER_MODIFIERS[id];
}
