import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mergeBattleParticipantIds,
  playerActsFirst,
  resolveMoveUse,
  STRUGGLE_MOVE,
  type CombatantStats,
  type MoveSnapshot,
} from "@/lib/battle";
import { emptyStages, resolveSingleAction, type SideBattleState } from "@/lib/resolve-action";
import {
  applyStagesToStats,
  canActThisTurn,
  residualDamage,
  stageMultiplier,
  statusInflictedByMove,
  tryApplyStatus,
} from "@/lib/status";

afterEach(() => {
  vi.restoreAllMocks();
});

const mon = (partial: Partial<CombatantStats> = {}): CombatantStats => ({
  level: 50,
  types: ["normal"],
  atk: 100,
  def: 100,
  spAtk: 100,
  spDef: 100,
  speed: 100,
  ...partial,
});

const move = (partial: Partial<MoveSnapshot> & Pick<MoveSnapshot, "name">): MoveSnapshot => ({
  id: 1,
  type: "normal",
  category: "PHYSICAL",
  power: 40,
  accuracy: 100,
  priority: 0,
  ...partial,
});

const side = (partial: Partial<SideBattleState> = {}): SideBattleState => ({
  hp: 100,
  maxHp: 100,
  status: null,
  sleepTurns: 0,
  stages: emptyStages(),
  name: "Mon",
  baseStats: mon(),
  ...partial,
});

/** Secuencia fija de Math.random(): accuracy (hit), crit (no), variance mid. */
function stubRandom(values: number[]) {
  let i = 0;
  vi.spyOn(Math, "random").mockImplementation(() => {
    const v = values[Math.min(i, values.length - 1)]!;
    i += 1;
    return v;
  });
}

describe("resolveMoveUse", () => {
  it("misses when accuracy roll fails", () => {
    stubRandom([0.99]); // 99 >= 50 → miss
    const r = resolveMoveUse(mon(), mon(), move({ name: "tackle", accuracy: 50 }));
    expect(r.hit).toBe(false);
    expect(r.damage).toBe(0);
  });

  it("always hits with forceHit even if accuracy would miss", () => {
    stubRandom([0.99, 0.5, 0.5]); // would miss without forceHit
    const r = resolveMoveUse(mon(), mon(), move({ name: "tackle", accuracy: 50 }), {
      forceHit: true,
    });
    expect(r.hit).toBe(true);
    expect(r.damage).toBeGreaterThan(0);
  });

  it("never misses when accuracy is null", () => {
    stubRandom([0.99, 0.5, 0.5]);
    const r = resolveMoveUse(mon(), mon(), move({ name: "swift", accuracy: null }));
    expect(r.hit).toBe(true);
  });

  it("returns zero damage for STATUS moves even on hit", () => {
    stubRandom([0]);
    const r = resolveMoveUse(
      mon(),
      mon(),
      move({ name: "growl", category: "STATUS", power: null, accuracy: 100 }),
    );
    expect(r.hit).toBe(true);
    expect(r.damage).toBe(0);
  });

  it("applies STAB when attacker shares the move type", () => {
    // hit, no crit, mid variance (0.5 → 0.925 factor)
    stubRandom([0, 0.5, 0.5]);
    const withStab = resolveMoveUse(
      mon({ types: ["water"] }),
      mon({ types: ["normal"] }),
      move({ name: "water-gun", type: "water", category: "SPECIAL", power: 40 }),
    );
    stubRandom([0, 0.5, 0.5]);
    const noStab = resolveMoveUse(
      mon({ types: ["normal"] }),
      mon({ types: ["normal"] }),
      move({ name: "water-gun", type: "water", category: "SPECIAL", power: 40 }),
    );
    expect(withStab.damage).toBeGreaterThan(noStab.damage);
    expect(withStab.damage / noStab.damage).toBeCloseTo(1.5, 1);
  });

  it("deals zero damage on type immunity", () => {
    stubRandom([0, 0.5, 0.5]);
    const r = resolveMoveUse(
      mon(),
      mon({ types: ["ground"] }),
      move({ name: "thunderbolt", type: "electric", category: "SPECIAL", power: 90 }),
    );
    expect(r.hit).toBe(true);
    expect(r.effectiveness).toBe(0);
    expect(r.damage).toBe(0);
  });

  it("halves physical damage when attacker is burned", () => {
    stubRandom([0, 0.5, 0.5]);
    const healthy = resolveMoveUse(mon(), mon(), move({ name: "tackle", power: 80 }));
    stubRandom([0, 0.5, 0.5]);
    const burned = resolveMoveUse(mon(), mon(), move({ name: "tackle", power: 80 }), {
      attackerBurned: true,
    });
    expect(burned.damage).toBeLessThan(healthy.damage);
    // Burn halves atk before the formula; floor math keeps it near half.
    expect(Math.abs(burned.damage * 2 - healthy.damage)).toBeLessThanOrEqual(2);
  });

  it("does not halve special damage when burned", () => {
    stubRandom([0, 0.5, 0.5]);
    const healthy = resolveMoveUse(
      mon(),
      mon(),
      move({ name: "psybeam", type: "psychic", category: "SPECIAL", power: 65 }),
    );
    stubRandom([0, 0.5, 0.5]);
    const burned = resolveMoveUse(
      mon(),
      mon(),
      move({ name: "psybeam", type: "psychic", category: "SPECIAL", power: 65 }),
      { attackerBurned: true },
    );
    expect(burned.damage).toBe(healthy.damage);
  });

  it("applies critical multiplier when crit rolls", () => {
    // hit, crit (<1/16), variance mid
    stubRandom([0, 0.01, 0.5]);
    const crit = resolveMoveUse(mon(), mon(), move({ name: "tackle", power: 60 }));
    stubRandom([0, 0.5, 0.5]);
    const normal = resolveMoveUse(mon(), mon(), move({ name: "tackle", power: 60 }));
    expect(crit.critical).toBe(true);
    expect(normal.critical).toBe(false);
    expect(crit.damage).toBeGreaterThan(normal.damage);
  });

  it("scales with powerMultiplier (held item)", () => {
    stubRandom([0, 0.5, 0.5]);
    const base = resolveMoveUse(mon(), mon(), move({ name: "tackle", power: 60 }));
    stubRandom([0, 0.5, 0.5]);
    const orb = resolveMoveUse(mon(), mon(), move({ name: "tackle", power: 60 }), {
      powerMultiplier: 1.3,
    });
    expect(orb.damage).toBeGreaterThan(base.damage);
  });
});

describe("playerActsFirst", () => {
  const tackle = move({ name: "tackle", priority: 0 });
  const quickAttack = move({ name: "quick-attack", priority: 1 });

  it("higher priority goes first", () => {
    expect(playerActsFirst(quickAttack, tackle, 50, 200)).toBe(true);
    expect(playerActsFirst(tackle, quickAttack, 200, 50)).toBe(false);
  });

  it("ties on priority go to higher speed", () => {
    expect(playerActsFirst(tackle, tackle, 120, 80)).toBe(true);
    expect(playerActsFirst(tackle, tackle, 80, 120)).toBe(false);
  });

  it("Quick Claw wins speed ties / losses when triggered", () => {
    expect(playerActsFirst(tackle, tackle, 50, 200, true)).toBe(true);
  });
});

describe("mergeBattleParticipantIds", () => {
  it("dedupes and preserves first-seen order", () => {
    expect(mergeBattleParticipantIds(["a", "b"], "b", ["c", "a"], null, undefined)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("status helpers", () => {
  it("stageMultiplier matches Gen III+ table", () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(1)).toBe(1.5);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(-1)).toBe(2 / 3);
    expect(stageMultiplier(-2)).toBe(0.5);
  });

  it("paralysis halves speed after stages", () => {
    const stats = applyStagesToStats(
      { atk: 100, def: 100, spAtk: 100, spDef: 100, speed: 100 },
      emptyStages(),
      "PARALYSIS",
    );
    expect(stats.speed).toBe(50);
  });

  it("residual burn is 1/16 and poison 1/8", () => {
    expect(residualDamage("BURN", 160)).toBe(10);
    expect(residualDamage("POISON", 160)).toBe(20);
    expect(residualDamage(null, 160)).toBe(0);
    expect(residualDamage("BURN", 1)).toBe(1);
  });

  it("sleep blocks until turns expire", () => {
    expect(canActThisTurn("SLEEP", 2)).toEqual({
      canAct: false,
      reason: "asleep",
      newSleepTurns: 1,
    });
    expect(canActThisTurn("SLEEP", 0)).toEqual({
      canAct: true,
      reason: null,
      newSleepTurns: 0,
    });
  });

  it("paralysis full-paralyzes ~25% of the time", () => {
    stubRandom([0.1]);
    expect(canActThisTurn("PARALYSIS", 0).reason).toBe("paralyzed");
    stubRandom([0.5]);
    expect(canActThisTurn("PARALYSIS", 0).canAct).toBe(true);
  });

  it("freeze thaws on 20% roll", () => {
    stubRandom([0.1]);
    expect(canActThisTurn("FREEZE", 0)).toEqual({
      canAct: true,
      reason: null,
      newSleepTurns: 0,
    });
    stubRandom([0.5]);
    expect(canActThisTurn("FREEZE", 0).reason).toBe("frozen");
  });

  it("maps status moves and respects immunities", () => {
    expect(statusInflictedByMove("Thunder Wave")).toBe("PARALYSIS");
    expect(tryApplyStatus(null, "PARALYSIS", ["electric"])).toBeNull();
    expect(tryApplyStatus(null, "BURN", ["water"])).toBe("BURN");
    expect(tryApplyStatus(null, "BURN", ["fire"])).toBeNull();
    expect(tryApplyStatus("POISON", "BURN", ["normal"])).toBeNull(); // already has status
  });
});

describe("resolveSingleAction", () => {
  it("skips the turn while asleep and does not damage the foe", () => {
    const player = side({ status: "SLEEP", sleepTurns: 2, name: "Snorlax" });
    const wild = side({ hp: 80, name: "Rattata" });
    const out = resolveSingleAction(
      "player",
      move({ name: "tackle", power: 40 }),
      player,
      wild,
    );
    expect(out.events[0]?.skipped).toBe("asleep");
    expect(out.events[0]?.hit).toBe(false);
    expect(out.wild.hp).toBe(80);
    expect(out.player.sleepTurns).toBe(1);
  });

  it("clears sleep after the last blocked turn (sleepTurns → 0)", () => {
    const out = resolveSingleAction(
      "player",
      move({ name: "tackle" }),
      side({ status: "SLEEP", sleepTurns: 1 }),
      side({ hp: 50 }),
    );
    expect(out.events[0]?.skipped).toBe("asleep");
    expect(out.player.sleepTurns).toBe(0);
    expect(out.player.status).toBeNull();
    expect(out.wild.hp).toBe(50);
  });

  it("applies Thunder Wave paralysis to the foe", () => {
    stubRandom([0]); // accuracy hit
    const out = resolveSingleAction(
      "player",
      move({
        name: "thunder-wave",
        type: "electric",
        category: "STATUS",
        power: null,
        accuracy: 90,
      }),
      side(),
      side({ baseStats: mon({ types: ["normal"] }) }),
    );
    expect(out.events[0]?.isStatus).toBe(true);
    expect(out.events[0]?.statusApplied).toBe("PARALYSIS");
    expect(out.wild.status).toBe("PARALYSIS");
  });

  it("applies Growl attack drop", () => {
    stubRandom([0]);
    const out = resolveSingleAction(
      "player",
      move({ name: "growl", category: "STATUS", power: null, accuracy: 100 }),
      side(),
      side(),
    );
    expect(out.events[0]?.statChange).toEqual({ stat: "atk", stages: -1 });
    expect(out.wild.stages.atk).toBe(-1);
  });

  it("applies burn residual to the attacker after acting", () => {
    stubRandom([0, 0.5, 0.5]);
    const out = resolveSingleAction(
      "player",
      move({ name: "tackle", power: 40 }),
      side({ status: "BURN", hp: 100, maxHp: 160 }),
      side({ hp: 200, maxHp: 200 }),
    );
    expect(out.events[0]?.hit).toBe(true);
    expect(out.events[0]?.residualDamage).toBe(10);
    expect(out.player.hp).toBeLessThan(100);
  });

  it("stops multi-hit when the foe faints mid-combo", () => {
    // double-kick = 2 hits fixed. First hit must KO.
    // randoms: accuracy, crit, variance for hit1; hit2 shouldn't matter if KO
    stubRandom([0, 0.5, 0.5, 0, 0.5, 0.5]);
    const out = resolveSingleAction(
      "player",
      move({ name: "double-kick", type: "fighting", power: 30, accuracy: 100 }),
      side({
        baseStats: mon({ level: 50, atk: 200, types: ["fighting"] }),
      }),
      side({
        hp: 5,
        maxHp: 100,
        baseStats: mon({ def: 50, types: ["normal"] }),
      }),
    );
    const ev = out.events[0]!;
    expect(ev.hit).toBe(true);
    expect(ev.hitCount).toBe(1);
    expect(ev.hitDamages).toHaveLength(1);
    expect(out.wild.hp).toBe(0);
    expect(ev.damage).toBe(ev.hitDamages![0]);
  });

  it("lands both hits of Double Kick when the foe survives", () => {
    stubRandom([0, 0.5, 0.5, 0.5, 0.5]); // hit1: acc/crit/var; hit2 forceHit: crit/var
    const out = resolveSingleAction(
      "player",
      move({ name: "double-kick", type: "fighting", power: 30 }),
      side({ baseStats: mon({ level: 30, atk: 80, types: ["fighting"] }) }),
      side({
        hp: 200,
        maxHp: 200,
        baseStats: mon({ def: 80, types: ["normal"] }),
      }),
    );
    const ev = out.events[0]!;
    expect(ev.hitCount).toBe(2);
    expect(ev.hitDamages).toHaveLength(2);
    expect(ev.damage).toBe(ev.hitDamages![0]! + ev.hitDamages![1]!);
    expect(out.wild.hp).toBe(200 - ev.damage);
  });

  it("applies Struggle recoil (1/4 max HP)", () => {
    stubRandom([0, 0.5, 0.5]);
    const out = resolveSingleAction(
      "player",
      STRUGGLE_MOVE,
      side({ hp: 100, maxHp: 100 }),
      side({ hp: 200, maxHp: 200 }),
    );
    expect(out.events[0]?.recoilDamage).toBe(25);
    expect(out.player.hp).toBeLessThanOrEqual(100 - 25);
  });

  it("thaw a frozen foe with a Fire move", () => {
    stubRandom([0, 0.5, 0.5, 0.99]); // last: secondary burn chance fail
    const out = resolveSingleAction(
      "player",
      move({
        name: "ember",
        type: "fire",
        category: "SPECIAL",
        power: 40,
        accuracy: 100,
      }),
      side({ baseStats: mon({ types: ["fire"], spAtk: 100 }) }),
      side({
        status: "FREEZE",
        hp: 80,
        baseStats: mon({ types: ["normal"], spDef: 80 }),
      }),
    );
    expect(out.wild.status).toBeNull();
    expect(out.events[0]?.hit).toBe(true);
  });
});
