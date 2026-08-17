export const MINE_GRID_SIZE = 25;
export const MINE_DIGS_PER_DAY = 8;

export type MineLoot = "empty" | "coins" | "potion" | "helix" | "dome" | "amber" | "stone";

export type MineCell = {
  loot: MineLoot;
  dug: boolean;
};

export type MineBag = {
  helix: number;
  dome: number;
  amber: number;
};

export const MINE_COIN_DROP = 80;
export const MINE_REVIVE_COST = 500;

export const FOSSIL_SPECIES: Record<"helix" | "dome" | "amber", number> = {
  helix: 138, // Omanyte
  dome: 140, // Kabuto
  amber: 142, // Aerodactyl
};

const LOOT_TABLE: Array<{ loot: MineLoot; weight: number }> = [
  { loot: "empty", weight: 42 },
  { loot: "coins", weight: 26 },
  { loot: "potion", weight: 14 },
  { loot: "helix", weight: 6 },
  { loot: "dome", weight: 6 },
  { loot: "amber", weight: 4 },
  { loot: "stone", weight: 2 },
];

function seedHash(seed: string): number {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function pickLoot(roll: number): MineLoot {
  const total = LOOT_TABLE.reduce((sum, row) => sum + row.weight, 0);
  let cursor = roll * total;
  for (const row of LOOT_TABLE) {
    cursor -= row.weight;
    if (cursor < 0) return row.loot;
  }
  return "empty";
}

export function generateMineGrid(userId: string, dayKey: string): MineCell[] {
  const random = mulberry32(seedHash(`mine:${userId}:${dayKey}`));
  return Array.from({ length: MINE_GRID_SIZE }, () => ({
    loot: pickLoot(random()),
    dug: false,
  }));
}

export function parseMineGrid(value: unknown): MineCell[] | null {
  if (!Array.isArray(value) || value.length !== MINE_GRID_SIZE) return null;
  return value.map((cell) => {
    const row = cell as MineCell;
    return {
      loot: row.loot ?? "empty",
      dug: Boolean(row.dug),
    };
  });
}

export function parseMineBag(value: unknown): MineBag {
  const row = (value ?? {}) as Partial<MineBag>;
  return {
    helix: Math.max(0, Math.floor(row.helix ?? 0)),
    dome: Math.max(0, Math.floor(row.dome ?? 0)),
    amber: Math.max(0, Math.floor(row.amber ?? 0)),
  };
}

export function mineDigsLeft(grid: readonly MineCell[]): number {
  const used = grid.filter((cell) => cell.dug).length;
  return Math.max(0, MINE_DIGS_PER_DAY - used);
}
