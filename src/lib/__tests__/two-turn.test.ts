import { describe, expect, it, vi } from "vitest";
import {
  canHitSemiInvuln,
  invulnPowerMultiplier,
  twoTurnSpec,
} from "@/lib/two-turn";
import { resolveSingleAction, emptyStages, type SideBattleState } from "@/lib/resolve-action";
import type { CombatantStats, MoveSnapshot } from "@/lib/battle";

const baseStats = (overrides: Partial<CombatantStats> = {}): CombatantStats => ({
  level: 40,
  types: ["normal"],
  atk: 100,
  def: 80,
  spAtk: 90,
  spDef: 80,
  speed: 70,
  ...overrides,
});

function side(
  name: string,
  stats: CombatantStats,
  extra: Partial<SideBattleState> = {},
): SideBattleState {
  return {
    hp: 120,
    maxHp: 120,
    status: null,
    sleepTurns: 0,
    stages: emptyStages(),
    name,
    baseStats: stats,
    chargeMoveId: null,
    semiInvuln: null,
    ...extra,
  };
}

const fly: MoveSnapshot = {
  id: 19,
  name: "fly",
  type: "flying",
  category: "PHYSICAL",
  power: 90,
  accuracy: 95,
  priority: 0,
};

const tackle: MoveSnapshot = {
  id: 33,
  name: "tackle",
  type: "normal",
  category: "PHYSICAL",
  power: 40,
  accuracy: 100,
  priority: 0,
};

const earthquake: MoveSnapshot = {
  id: 89,
  name: "earthquake",
  type: "ground",
  category: "PHYSICAL",
  power: 100,
  accuracy: 100,
  priority: 0,
};

const solarBeam: MoveSnapshot = {
  id: 76,
  name: "solar-beam",
  type: "grass",
  category: "SPECIAL",
  power: 120,
  accuracy: 100,
  priority: 0,
};

const skullBash: MoveSnapshot = {
  id: 130,
  name: "skull-bash",
  type: "normal",
  category: "PHYSICAL",
  power: 130,
  accuracy: 100,
  priority: 0,
};

describe("twoTurnSpec", () => {
  it("classifies vanish and charge moves", () => {
    expect(twoTurnSpec("fly")?.kind).toBe("vanish");
    expect(twoTurnSpec("fly")?.invuln).toBe("air");
    expect(twoTurnSpec("dig")?.invuln).toBe("underground");
    expect(twoTurnSpec("solar-beam")?.kind).toBe("charge");
    expect(twoTurnSpec("solar-beam")?.invuln).toBeUndefined();
    expect(twoTurnSpec("skull-bash")?.chargeStat).toEqual({ stat: "def", stages: 1 });
    expect(twoTurnSpec("tackle")).toBeNull();
  });

  it("knows which moves hit through semi-invulnerability", () => {
    expect(canHitSemiInvuln("tackle", "air")).toBe(false);
    expect(canHitSemiInvuln("gust", "air")).toBe(true);
    expect(canHitSemiInvuln("earthquake", "underground")).toBe(true);
    expect(canHitSemiInvuln("tackle", "underground")).toBe(false);
    expect(invulnPowerMultiplier("earthquake", "underground")).toBe(2);
    expect(invulnPowerMultiplier("gust", "air")).toBe(2);
    expect(invulnPowerMultiplier("thunder", "air")).toBe(1);
  });
});

describe("resolveSingleAction two-turn", () => {
  it("starts Fly without damage and sets semi-invuln", () => {
    const player = side("Charizard", baseStats({ types: ["fire", "flying"] }));
    const wild = side("Magmar", baseStats({ types: ["fire"] }));
    const out = resolveSingleAction("player", fly, player, wild);
    expect(out.events[0]?.chargePhase).toBe("start");
    expect(out.events[0]?.damage).toBe(0);
    expect(out.events[0]?.semiInvuln).toBe("air");
    expect(out.player.chargeMoveId).toBe(19);
    expect(out.player.semiInvuln).toBe("air");
    expect(out.wild.hp).toBe(120);
  });

  it("finishes Fly with damage and clears charge", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // hit + no crit
    const player = side("Charizard", baseStats({ types: ["fire", "flying"] }), {
      chargeMoveId: 19,
      semiInvuln: "air",
    });
    const wild = side("Magmar", baseStats({ types: ["fire"] }));
    const out = resolveSingleAction("player", fly, player, wild);
    expect(out.events[0]?.chargePhase).toBe("finish");
    expect(out.events[0]?.damage).toBeGreaterThan(0);
    expect(out.player.chargeMoveId).toBeNull();
    expect(out.player.semiInvuln).toBeNull();
    expect(out.wild.hp).toBeLessThan(120);
    vi.restoreAllMocks();
  });

  it("makes most moves miss a Digging foe, but Earthquake hits for 2x", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const player = side("Sandshrew", baseStats({ types: ["ground"], atk: 60 }));
    const dug = side("Onix", baseStats({ types: ["rock", "ground"], def: 120 }), {
      hp: 400,
      maxHp: 400,
      chargeMoveId: 91,
      semiInvuln: "underground",
    });

    const miss = resolveSingleAction("player", tackle, player, dug);
    expect(miss.events[0]?.hit).toBe(false);
    expect(miss.wild.hp).toBe(400);

    const hit = resolveSingleAction("player", earthquake, player, dug);
    expect(hit.events[0]?.hit).toBe(true);
    expect(hit.events[0]?.damage).toBeGreaterThan(0);

    const exposed = side("Onix", baseStats({ types: ["rock", "ground"], def: 120 }), {
      hp: 400,
      maxHp: 400,
    });
    const normal = resolveSingleAction("player", earthquake, player, exposed);
    expect(hit.events[0]!.damage).toBeGreaterThan(normal.events[0]!.damage);
    vi.restoreAllMocks();
  });

  it("charges Solar Beam without vanishing", () => {
    const player = side("Venusaur", baseStats({ types: ["grass", "poison"] }));
    const wild = side("Magmar", baseStats({ types: ["fire"] }));
    const out = resolveSingleAction("player", solarBeam, player, wild);
    expect(out.events[0]?.chargePhase).toBe("start");
    expect(out.events[0]?.semiInvuln).toBeNull();
    expect(out.player.semiInvuln).toBeNull();
    expect(out.player.chargeMoveId).toBe(76);
  });

  it("raises Defense on Skull Bash charge turn", () => {
    const player = side("Blastoise", baseStats({ types: ["water"] }));
    const wild = side("Magmar", baseStats({ types: ["fire"] }));
    const out = resolveSingleAction("player", skullBash, player, wild);
    expect(out.events[0]?.chargePhase).toBe("start");
    expect(out.events[0]?.selfStatChange).toEqual({ stat: "def", stages: 1 });
    expect(out.player.stages.def).toBe(1);
  });

  it("clears charge when status prevents acting", () => {
    const player = side("Charizard", baseStats({ types: ["fire", "flying"] }), {
      status: "SLEEP",
      sleepTurns: 2,
      chargeMoveId: 19,
      semiInvuln: "air",
    });
    const wild = side("Magmar", baseStats({ types: ["fire"] }));
    const out = resolveSingleAction("player", fly, player, wild);
    expect(out.events[0]?.skipped).toBe("asleep");
    expect(out.player.chargeMoveId).toBeNull();
    expect(out.player.semiInvuln).toBeNull();
  });
});
