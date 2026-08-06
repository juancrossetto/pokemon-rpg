import type { RewardBundle } from "@/lib/events/rewards";
import { COMBAT_TOWER_CONFIG, TOWER_MODIFIERS } from "./config";
import type { TowerEnemyDef, TowerFloor, TowerFloorType, TowerModifier } from "./types";

/** Pools de especies Kanto (National Dex) para composición por bloque. */
const BLOCK_SPECIES: number[][] = [
  // 1–10: simples
  [16, 19, 21, 23, 27, 29, 32, 37, 41, 43],
  // 11–20: sinergias de tipo
  [58, 63, 66, 74, 77, 81, 86, 88, 92, 96],
  // 21–30: más avanzados / pseudo-guardianes
  [103, 110, 112, 113, 123, 130, 131, 142, 143, 149],
];

const GUARDIAN_SPECIES = [59, 130, 149]; // Arcanine, Gyarados, Dragonite

function floorType(n: number): TowerFloorType {
  if (n % 10 === 0) return "boss";
  if (n % 5 === 0) return "elite";
  if (n % 10 === 4) return "rest";
  return "normal";
}
function blockIndex(floor: number): number {
  return Math.min(BLOCK_SPECIES.length - 1, Math.floor((floor - 1) / 10));
}

/** PC recomendado: curva por bloques con salto suave en jefes. */
export function recommendedPcForFloor(floor: number): number {
  const block = blockIndex(floor);
  const within = ((floor - 1) % 10) + 1;
  const base = 900 + block * 550 + within * 35;
  if (floor % 10 === 0) return Math.round(base * 1.18);
  if (floor % 5 === 0) return Math.round(base * 1.08);
  return base;
}

function enemyLevel(floor: number, type: TowerFloorType): number {
  const base = 12 + Math.floor(floor * 1.15);
  if (type === "boss") return base + 4;
  if (type === "elite") return base + 2;
  return base;
}

function pickEnemy(floor: number, type: TowerFloorType, slot: number): TowerEnemyDef {
  if (type === "boss") {
    const g = GUARDIAN_SPECIES[(Math.floor(floor / 10) - 1) % GUARDIAN_SPECIES.length]!;
    return { speciesId: g, level: enemyLevel(floor, type), hpMult: 1.25 };
  }
  const pool = BLOCK_SPECIES[blockIndex(floor)]!;
  const speciesId = pool[(floor + slot * 3) % pool.length]!;
  return {
    speciesId,
    level: enemyLevel(floor, type) - (slot > 0 ? 1 : 0),
    hpMult: type === "elite" ? 1.1 : 1,
  };
}

function modifiersForFloor(floor: number, type: TowerFloorType): TowerModifier[] {
  if (type === "rest") return [];
  if (type === "boss") {
    const ids =
      floor === 10
        ? ["sun_field", "fire_boost"]
        : floor === 20
          ? ["rain_field", "heal_cut"]
          : ["speed_surge", "no_items"];
    return ids.map((id) => TOWER_MODIFIERS[id]!).filter(Boolean);
  }
  if (type === "elite") {
    const id = floor % 3 === 0 ? "heal_cut" : floor % 3 === 1 ? "speed_surge" : "fire_boost";
    return [TOWER_MODIFIERS[id]!];
  }
  if (floor >= 21 && floor % 7 === 0) return [TOWER_MODIFIERS.speed_surge!];
  return [];
}

function repeatableBundle(floor: number, type: TowerFloorType): RewardBundle {
  const coins =
    type === "boss"
      ? 180 + floor * 8
      : type === "elite"
        ? 90 + floor * 5
        : 35 + floor * 3;
  return [{ kind: "coins", amount: coins }];
}

function firstClearBundle(floor: number, type: TowerFloorType): RewardBundle {
  const coins = type === "boss" ? 400 + floor * 12 : type === "elite" ? 200 + floor * 6 : 60 + floor * 4;
  const bundle: RewardBundle = [{ kind: "coins", amount: coins }];
  // Hitos cada 5: élite deja Revivir; jefe deja Max Revivir (+ gemas).
  if (type === "elite") {
    bundle.push({ kind: "item", itemName: "Potion", quantity: 1 });
    bundle.push({ kind: "item", itemName: "Revive", quantity: 1 });
  }
  if (type === "boss") {
    bundle.push({
      kind: "item",
      itemName: "Max Revive",
      quantity: floor >= 20 ? 2 : 1,
    });
    bundle.push({ kind: "gems", amount: floor >= 30 ? 5 : 2 });
  }
  return bundle;
}

export function buildTowerFloors(towerId = COMBAT_TOWER_CONFIG.id): TowerFloor[] {
  const total = COMBAT_TOWER_CONFIG.totalFloors;
  const floors: TowerFloor[] = [];
  for (let n = 1; n <= total; n++) {
    const type = floorType(n);
    const enemies =
      type === "rest"
        ? []
        : type === "boss"
          ? [pickEnemy(n, type, 0)]
          : type === "elite"
            ? [pickEnemy(n, type, 0), pickEnemy(n, type, 1)]
            : [pickEnemy(n, type, 0)];

    floors.push({
      id: `${towerId}-f${n}`,
      towerId,
      floorNumber: n,
      type,
      recommendedCombatPower: recommendedPcForFloor(n),
      enemies,
      modifiers: modifiersForFloor(n, type),
      rewards: [
        {
          id: `${towerId}-f${n}-rep`,
          rewardMode: "repeatable",
          bundle: type === "rest" ? [] : repeatableBundle(n, type),
        },
      ],
      firstClearRewards: [
        {
          id: `${towerId}-f${n}-fc`,
          rewardMode: "first_clear",
          bundle: type === "rest" ? [{ kind: "coins", amount: 20 }] : firstClearBundle(n, type),
        },
      ],
      waves: Math.max(1, enemies.length),
      guardianId: type === "boss" ? `guardian-${n}` : undefined,
    });
  }
  return floors;
}

const FLOOR_CACHE = new Map<string, TowerFloor[]>();

export function getTowerFloors(towerId = COMBAT_TOWER_CONFIG.id): TowerFloor[] {
  let cached = FLOOR_CACHE.get(towerId);
  if (!cached) {
    cached = buildTowerFloors(towerId);
    FLOOR_CACHE.set(towerId, cached);
  }
  return cached;
}

export function getTowerFloor(floorNumber: number, towerId = COMBAT_TOWER_CONFIG.id): TowerFloor | undefined {
  return getTowerFloors(towerId).find((f) => f.floorNumber === floorNumber);
}

export function getNextGuardianFloor(fromFloor: number, towerId = COMBAT_TOWER_CONFIG.id): number | null {
  const floors = getTowerFloors(towerId);
  const next = floors.find((f) => f.type === "boss" && f.floorNumber >= fromFloor);
  return next?.floorNumber ?? null;
}

export function getNextMilestoneFloor(fromFloor: number, _towerId = COMBAT_TOWER_CONFIG.id): number | null {
  void _towerId;
  for (let n = fromFloor; n <= COMBAT_TOWER_CONFIG.totalFloors; n++) {
    if (n % 5 === 0) return n;
  }
  return null;
}
