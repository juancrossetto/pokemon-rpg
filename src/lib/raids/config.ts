import type { RewardBundle } from "@/lib/events/rewards";

export const RAID_ATTEMPTS_PER_WEEK = 3;
export const RAID_COMMUNITY_HP = 2_000_000;
export const RAID_BOSSES = [
  { speciesId: 150, level: 70, accent: "#a78bfa" },
  { speciesId: 249, level: 70, accent: "#67e8f9" },
  { speciesId: 384, level: 75, accent: "#34d399" },
] as const;

export const RAID_REWARD: RewardBundle = [
  { kind: "coins", amount: 750 },
  { kind: "gems", amount: 2 },
  { kind: "item", itemName: "Super Potion", quantity: 3 },
];

export function raidBossForWeek(key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return RAID_BOSSES[hash % RAID_BOSSES.length]!;
}

export type RaidTeamMember = {
  level: number;
  currentHp: number;
  ptStrength: number;
  ptIntelligence: number;
  ptSpeed: number;
  species: { baseAttack: number; baseSpAtk: number; baseSpeed: number };
};

/** Daño reproducible: depende del equipo, semana e intento; nunca del navegador. */
export function calculateRaidDamage(team: readonly RaidTeamMember[], key: string, attempt: number): number {
  const healthy = team.filter((member) => member.currentHp > 0);
  if (healthy.length === 0) return 0;
  const power = healthy.reduce((sum, member) => sum +
    member.level * 14 +
    member.species.baseAttack * 2 +
    member.species.baseSpAtk * 2 +
    member.species.baseSpeed +
    member.ptStrength * 3 +
    member.ptIntelligence * 3 +
    member.ptSpeed,
  0);
  let hash = attempt * 97;
  for (const char of key) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  const variance = 0.92 + (hash % 17) / 100;
  return Math.max(1, Math.round(power * variance));
}
