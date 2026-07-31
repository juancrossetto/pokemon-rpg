import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveMoveUse, type CombatantStats, type MoveSnapshot } from "@/lib/battle";
import { emptyStages, resolveSingleAction, type SideBattleState } from "@/lib/resolve-action";
import {
  drainFraction,
  flinchChance,
  healFraction,
  highCritStage,
  isOhkoMove,
  ohkoAccuracy,
  recoilFraction,
  selfStatChanges,
} from "@/lib/move-effects";
import { accuracyStageMultiplier, normalizeStages } from "@/lib/status";

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

/** Math.random() determinista: accuracy, crit, varianza, efectos secundarios. */
function stubRandom(values: number[]) {
  let i = 0;
  vi.spyOn(Math, "random").mockImplementation(() => {
    const v = values[Math.min(i, values.length - 1)]!;
    i += 1;
    return v;
  });
}

describe("tablas de move-effects", () => {
  it("normaliza nombres con espacios y guiones bajos", () => {
    expect(healFraction("Soft Boiled")).toBe(0.5);
    expect(drainFraction("giga_drain")).toBe(0.5);
    expect(selfStatChanges("Swords Dance")).toEqual([{ stat: "atk", stages: 2 }]);
  });

  it("marca los movimientos sin efecto conocido como null", () => {
    expect(healFraction("tackle")).toBeNull();
    expect(drainFraction("tackle")).toBeNull();
    expect(recoilFraction("tackle")).toBeNull();
    expect(selfStatChanges("tackle")).toBeNull();
    expect(flinchChance("tackle")).toBe(0);
    expect(highCritStage("tackle")).toBe(0);
  });

  it("da +1 nivel de crítico a los de crítico alto", () => {
    expect(highCritStage("slash")).toBe(1);
    expect(highCritStage("stone-edge")).toBe(1);
  });

  it("un OHKO falla siempre contra un nivel superior", () => {
    expect(isOhkoMove("fissure")).toBe(true);
    expect(ohkoAccuracy(40, 50)).toBe(0);
    expect(ohkoAccuracy(50, 50)).toBe(30);
    expect(ohkoAccuracy(70, 50)).toBe(50);
  });
});

describe("curación", () => {
  it("Recover restaura la mitad del HP máximo", () => {
    const self = side({ hp: 30, maxHp: 100 });
    const out = resolveSingleAction(
      "player",
      move({ name: "recover", category: "STATUS", power: null }),
      self,
      side(),
    );
    expect(out.player.hp).toBe(80);
    const event = out.events[0]!;
    expect(event.healAmount).toBe(50);
    expect(event.healHpAfter).toBe(80);
  });

  it("no desperdicia HP curando por encima del máximo", () => {
    const out = resolveSingleAction(
      "player",
      move({ name: "recover", category: "STATUS", power: null }),
      side({ hp: 90, maxHp: 100 }),
      side(),
    );
    expect(out.player.hp).toBe(100);
    expect(out.events[0]!.healAmount).toBe(10);
  });

  it("avisa que no pasó nada si ya está al máximo", () => {
    const out = resolveSingleAction(
      "player",
      move({ name: "recover", category: "STATUS", power: null }),
      side({ hp: 100, maxHp: 100 }),
      side(),
    );
    expect(out.events[0]!.noEffect).toBe(true);
    expect(out.events[0]!.healAmount).toBeUndefined();
  });

  it("Rest cura al máximo y deja dormido al usuario", () => {
    const out = resolveSingleAction(
      "player",
      move({ name: "rest", category: "STATUS", power: null }),
      side({ hp: 10, maxHp: 100, status: "BURN" }),
      side(),
    );
    expect(out.player.hp).toBe(100);
    expect(out.player.status).toBe("SLEEP");
    expect(out.player.sleepTurns).toBe(2);
  });
});

describe("drenaje", () => {
  it("Giga Drain devuelve la mitad del daño infligido", () => {
    // accuracy, crit (no), varianza, chance de estado secundario.
    stubRandom([0, 0.99, 0.5, 0.99]);
    const attacker = side({ hp: 20, maxHp: 100 });
    const out = resolveSingleAction(
      "player",
      move({ name: "giga-drain", type: "grass", category: "SPECIAL", power: 75 }),
      attacker,
      side({ hp: 200, maxHp: 200 }),
    );
    const event = out.events[0]!;
    expect(event.damage).toBeGreaterThan(0);
    expect(event.healFromDrain).toBe(true);
    expect(event.healAmount).toBe(Math.max(1, Math.floor(event.damage * 0.5)));
    expect(out.player.hp).toBe(20 + event.healAmount!);
  });

  it("Dream Eater falla si el rival no está dormido", () => {
    const out = resolveSingleAction(
      "player",
      move({ name: "dream-eater", type: "psychic", category: "SPECIAL", power: 100 }),
      side(),
      side({ status: null }),
    );
    expect(out.events[0]!.hit).toBe(false);
    expect(out.events[0]!.noEffect).toBe(true);
  });
});

describe("auto-boost", () => {
  it("Swords Dance sube dos niveles de Ataque", () => {
    const out = resolveSingleAction(
      "player",
      move({ name: "swords-dance", category: "STATUS", power: null }),
      side(),
      side(),
    );
    expect(out.player.stages.atk).toBe(2);
    expect(out.events[0]!.selfStatChanges).toEqual([{ stat: "atk", stages: 2 }]);
  });

  it("Calm Mind sube Atq.Esp y Def.Esp a la vez", () => {
    const out = resolveSingleAction(
      "player",
      move({ name: "calm-mind", category: "STATUS", power: null }),
      side(),
      side(),
    );
    expect(out.player.stages.spa).toBe(1);
    expect(out.player.stages.spd).toBe(1);
    expect(out.events[0]!.selfStatChanges).toHaveLength(2);
  });

  it("reporta el delta real cuando ya está al tope", () => {
    const capped = side({ stages: normalizeStages({ atk: 5 }) });
    const out = resolveSingleAction(
      "player",
      move({ name: "swords-dance", category: "STATUS", power: null }),
      capped,
      side(),
    );
    expect(out.player.stages.atk).toBe(6);
    expect(out.events[0]!.selfStatChanges).toEqual([{ stat: "atk", stages: 1 }]);
  });

  it("avisa sin efecto si ya está en +6", () => {
    const out = resolveSingleAction(
      "player",
      move({ name: "swords-dance", category: "STATUS", power: null }),
      side({ stages: normalizeStages({ atk: 6 }) }),
      side(),
    );
    expect(out.events[0]!.noEffect).toBe(true);
  });

  it("un movimiento de estado sin mecánica avisa en vez de fingir efecto", () => {
    const out = resolveSingleAction(
      "player",
      move({ name: "light-screen", category: "STATUS", power: null }),
      side(),
      side(),
    );
    expect(out.events[0]!.noEffect).toBe(true);
  });
});

describe("OHKO", () => {
  it("noquea de un golpe y reporta el HP que se llevó", () => {
    stubRandom([0]); // tirada de precisión mínima → conecta
    const out = resolveSingleAction(
      "player",
      move({ name: "fissure", type: "ground", power: null, accuracy: null }),
      side(),
      side({ hp: 180, maxHp: 200, baseStats: mon({ types: ["rock"] }) }),
    );
    const event = out.events[0]!;
    expect(event.ohko).toBe(true);
    expect(event.damage).toBe(180);
    expect(out.wild.hp).toBe(0);
  });

  it("no toca a un tipo inmune", () => {
    stubRandom([0]);
    const out = resolveSingleAction(
      "player",
      move({ name: "fissure", type: "ground", power: null, accuracy: null }),
      side(),
      side({ hp: 180, maxHp: 200, baseStats: mon({ types: ["flying"] }) }),
    );
    expect(out.events[0]!.hit).toBe(false);
    expect(out.events[0]!.noEffect).toBe(true);
    expect(out.wild.hp).toBe(180);
  });

  it("falla contra un rival de nivel superior", () => {
    stubRandom([0]);
    const out = resolveSingleAction(
      "player",
      move({ name: "horn-drill", power: null, accuracy: null }),
      side({ baseStats: mon({ level: 20 }) }),
      side({ hp: 180, maxHp: 200, baseStats: mon({ level: 60 }) }),
    );
    expect(out.events[0]!.hit).toBe(false);
    expect(out.wild.hp).toBe(180);
  });
});

describe("retroceso y flinch", () => {
  it("Double Edge se cobra un tercio del daño infligido", () => {
    stubRandom([0, 0.99, 0.5, 0.99]);
    const out = resolveSingleAction(
      "player",
      move({ name: "double-edge", power: 120 }),
      side({ hp: 200, maxHp: 200 }),
      side({ hp: 300, maxHp: 300 }),
    );
    const event = out.events[0]!;
    expect(event.recoilDamage).toBe(Math.max(1, Math.floor(event.damage / 3)));
    expect(event.recoilHpAfter).toBe(200 - event.recoilDamage!);
    expect(out.player.hp).toBe(event.recoilHpAfter);
  });

  it("Fake Out siempre hace retroceder", () => {
    stubRandom([0, 0.99, 0.5, 0.99, 0.99]);
    const out = resolveSingleAction(
      "player",
      move({ name: "fake-out", power: 40, priority: 3 }),
      side(),
      side({ hp: 300, maxHp: 300 }),
    );
    expect(out.events[0]!.causedFlinch).toBe(true);
    expect(out.causedFlinch).toBe(true);
  });

  it("no hace retroceder a un objetivo que ya cayó", () => {
    stubRandom([0, 0.99, 0.5, 0.99, 0]);
    const out = resolveSingleAction(
      "player",
      move({ name: "fake-out", power: 40 }),
      side(),
      side({ hp: 1, maxHp: 300 }),
    );
    expect(out.wild.hp).toBe(0);
    expect(out.causedFlinch).toBe(false);
  });
});

describe("crítico", () => {
  it("ignora el Ataque bajado del atacante", () => {
    const attacker = mon({ atk: 50 }); // −2 de stage ya aplicado
    const baseline = { atk: 100, spAtk: 100, def: 100, spDef: 100 };
    stubRandom([0, 0, 1]); // acierta, critica, varianza máxima
    const crit = resolveMoveUse(attacker, mon(), move({ name: "tackle" }), {
      critBaselineStats: baseline,
    });
    stubRandom([0, 0, 1]);
    const critSinBaseline = resolveMoveUse(attacker, mon(), move({ name: "tackle" }));
    expect(crit.critical).toBe(true);
    expect(crit.damage).toBeGreaterThan(critSinBaseline.damage);
  });

  it("ignora la Defensa subida del rival", () => {
    const defender = mon({ def: 200 }); // +2 de stage ya aplicado
    const baseline = { atk: 100, spAtk: 100, def: 100, spDef: 100 };
    stubRandom([0, 0, 1]);
    const crit = resolveMoveUse(mon(), defender, move({ name: "tackle" }), {
      critBaselineStats: baseline,
    });
    stubRandom([0, 0, 1]);
    const critSinBaseline = resolveMoveUse(mon(), defender, move({ name: "tackle" }));
    expect(crit.damage).toBeGreaterThan(critSinBaseline.damage);
  });

  it("no toca los stages que favorecen al atacante", () => {
    const attacker = mon({ atk: 200 }); // +2 de stage
    const baseline = { atk: 100, spAtk: 100, def: 100, spDef: 100 };
    stubRandom([0, 0, 1]);
    const conBaseline = resolveMoveUse(attacker, mon(), move({ name: "tackle" }), {
      critBaselineStats: baseline,
    });
    stubRandom([0, 0, 1]);
    const sinBaseline = resolveMoveUse(attacker, mon(), move({ name: "tackle" }));
    expect(conBaseline.damage).toBe(sinBaseline.damage);
  });

  it("un movimiento de crítico alto critica más seguido", () => {
    // 1/16 = 0.0625 falla; 1/8 = 0.125 acierta.
    stubRandom([0, 0.1, 0.5]);
    const alto = resolveMoveUse(mon(), mon(), move({ name: "slash" }), { critStage: 1 });
    stubRandom([0, 0.1, 0.5]);
    const normal = resolveMoveUse(mon(), mon(), move({ name: "tackle" }));
    expect(alto.critical).toBe(true);
    expect(normal.critical).toBe(false);
  });
});

describe("precisión con stages", () => {
  it("usa la tabla de base 3, no la de base 2", () => {
    expect(accuracyStageMultiplier(0)).toBe(1);
    expect(accuracyStageMultiplier(3)).toBe(2);
    expect(accuracyStageMultiplier(-3)).toBe(0.5);
  });

  it("Sand Attack hace fallar golpes que antes conectaban", () => {
    const nearMiss = 0.9; // 90 < 100 conecta, pero 90 >= 100×0.75 falla
    stubRandom([nearMiss]);
    const conPrecision = resolveMoveUse(mon(), mon(), move({ name: "tackle" }));
    stubRandom([nearMiss]);
    const conAccBajada = resolveMoveUse(mon(), mon(), move({ name: "tackle" }), {
      accuracyStageDelta: -1,
    });
    expect(conPrecision.hit).toBe(true);
    expect(conAccBajada.hit).toBe(false);
  });

  it("Sand Attack baja la precisión del rival en el motor", () => {
    const out = resolveSingleAction(
      "player",
      move({ name: "sand-attack", type: "ground", category: "STATUS", power: null }),
      side(),
      side(),
    );
    expect(out.wild.stages.acc).toBe(-1);
    expect(out.events[0]!.statChange).toEqual({ stat: "acc", stages: -1 });
  });
});

describe("varianza de daño", () => {
  it("puede llegar al roll máximo de 1.00", () => {
    // Con `0.85 + random()*0.15` el techo era inalcanzable.
    stubRandom([0, 0.99, 0.999]);
    const maxRoll = resolveMoveUse(mon(), mon(), move({ name: "tackle" }));
    stubRandom([0, 0.99, 0]);
    const minRoll = resolveMoveUse(mon(), mon(), move({ name: "tackle" }));
    expect(maxRoll.damage / minRoll.damage).toBeCloseTo(1 / 0.85, 1);
  });
});
