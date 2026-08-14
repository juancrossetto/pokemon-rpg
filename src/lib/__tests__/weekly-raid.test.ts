import { describe, expect, it } from "vitest";
import {
  RAID_BOSSES,
  RAID_BOSS_HP_AT_FIRST_STEP,
  raidBossBattleHp,
  raidBossForWeek,
  raidWeekIndex,
} from "@/lib/raids/config";
import { raidDamageDealt } from "@/lib/raids/settle";

describe("escalera de jefes", () => {
  it("es determinística por semana", () => {
    const first = raidBossForWeek("2026-W33");
    expect(RAID_BOSSES).toContain(first);
    expect(raidBossForWeek("2026-W33")).toBe(first);
  });

  it("rota en orden, no al azar: la semana siguiente es el siguiente escalón", () => {
    for (const week of ["2026-W01", "2026-W07", "2026-W33", "2026-W52"]) {
      const index = raidWeekIndex(week);
      const current = raidBossForWeek(week);
      const expected = RAID_BOSSES[(index + 1) % RAID_BOSSES.length];
      expect(expected).not.toBe(current);
      expect(RAID_BOSSES[index % RAID_BOSSES.length]).toBe(current);
    }
  });

  it("el nivel sube monótonamente a lo largo de la escalera", () => {
    for (let i = 1; i < RAID_BOSSES.length; i += 1) {
      expect(RAID_BOSSES[i]!.level).toBeGreaterThan(RAID_BOSSES[i - 1]!.level);
    }
  });

  it("arranca en Kanto y termina en Johto", () => {
    expect(RAID_BOSSES[0]!.speciesId).toBeLessThanOrEqual(151);
    expect(RAID_BOSSES.at(-1)!.speciesId).toBeGreaterThan(151);
    // Sólo gen 1-2: la gen 3 no está sembrada en todas las bases.
    for (const boss of RAID_BOSSES) expect(boss.speciesId).toBeLessThanOrEqual(251);
  });

  it("una clave de semana rota no rompe la rotación", () => {
    expect(RAID_BOSSES).toContain(raidBossForWeek("basura"));
  });
});

describe("raidBossBattleHp", () => {
  it("el primer escalón conserva la bolsa base", () => {
    expect(raidBossBattleHp(RAID_BOSSES[0]!.level)).toBe(RAID_BOSS_HP_AT_FIRST_STEP);
  });

  it("aguanta más a medida que sube la escalera", () => {
    for (let i = 1; i < RAID_BOSSES.length; i += 1) {
      expect(raidBossBattleHp(RAID_BOSSES[i]!.level)).toBeGreaterThan(
        raidBossBattleHp(RAID_BOSSES[i - 1]!.level),
      );
    }
  });

  it("un nivel por debajo del primer escalón no baja de la base", () => {
    expect(raidBossBattleHp(1)).toBe(RAID_BOSS_HP_AT_FIRST_STEP);
  });
});

describe("raidDamageDealt", () => {
  it("es lo que se le sacó al jefe, nunca negativo", () => {
    expect(raidDamageDealt(12_000, 9_500)).toBe(2_500);
    expect(raidDamageDealt(12_000, 0)).toBe(12_000);
    expect(raidDamageDealt(12_000, 12_000)).toBe(0);
    // Curación del jefe por encima del máximo no genera daño negativo.
    expect(raidDamageDealt(12_000, 13_000)).toBe(0);
  });
});
