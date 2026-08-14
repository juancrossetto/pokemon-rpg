import { describe, expect, it } from "vitest";
import { calculateRaidDamage, raidBossForWeek, RAID_BOSSES } from "@/lib/raids/config";

const team = [{
  level: 25,
  currentHp: 60,
  ptStrength: 12,
  ptIntelligence: 8,
  ptSpeed: 5,
  species: { baseAttack: 90, baseSpAtk: 70, baseSpeed: 80 },
}];

describe("weekly raid", () => {
  it("rotates to a configured boss deterministically", () => {
    const first = raidBossForWeek("2026-W33");
    expect(RAID_BOSSES).toContain(first);
    expect(raidBossForWeek("2026-W33")).toBe(first);
  });

  it("calculates stable positive damage and ignores fainted members", () => {
    const damage = calculateRaidDamage(team, "2026-W33", 1);
    expect(damage).toBeGreaterThan(0);
    expect(calculateRaidDamage(team, "2026-W33", 1)).toBe(damage);
    expect(calculateRaidDamage([{ ...team[0]!, currentHp: 0 }], "2026-W33", 1)).toBe(0);
  });
});
