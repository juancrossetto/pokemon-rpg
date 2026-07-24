import {
  resolveMoveUse,
  STRUGGLE_MOVE,
  type CombatantStats,
  type MoveSnapshot,
  type TurnEvent,
} from "@/lib/battle";
import {
  applyStagesToStats,
  canActThisTurn,
  residualDamage,
  rollSleepTurns,
  statChangeByMove,
  statusInflictedByMove,
  type StatStages,
  type StatusCondition,
} from "@/lib/status";

export interface SideBattleState {
  hp: number;
  maxHp: number;
  status: StatusCondition | null;
  sleepTurns: number;
  stages: StatStages;
  name: string;
  baseStats: CombatantStats;
}

export interface ActionOutcome {
  events: TurnEvent[];
  player: SideBattleState;
  wild: SideBattleState;
}

function withStages(side: SideBattleState): CombatantStats {
  const mod = applyStagesToStats(side.baseStats, side.stages, side.status);
  return { ...side.baseStats, ...mod };
}

export function emptyStages(): StatStages {
  return { atk: 0, def: 0, spe: 0 };
}

/**
 * Resuelve un único uso de movimiento (o skip por status).
 * El residual burn/poison se aplica al atacante al final de su acción.
 */
export function resolveSingleAction(
  attackerSide: "player" | "wild",
  move: MoveSnapshot,
  player: SideBattleState,
  wild: SideBattleState,
): ActionOutcome {
  const events: TurnEvent[] = [];
  let p: SideBattleState = { ...player, stages: { ...player.stages } };
  let w: SideBattleState = { ...wild, stages: { ...wild.stages } };

  const isPlayer = attackerSide === "player";
  const self = isPlayer ? p : w;
  const foe = isPlayer ? w : p;

  const act = canActThisTurn(self.status, self.sleepTurns);
  self.sleepTurns = act.newSleepTurns;

  if (!act.canAct && act.reason) {
    if (act.reason === "asleep" && act.newSleepTurns <= 0) {
      self.status = null;
    }
    events.push({
      side: attackerSide,
      moveName: move.name,
      moveType: move.type,
      hit: false,
      isStatus: false,
      damage: 0,
      effectiveness: 1,
      hpAfter: foe.hp,
      skipped: act.reason,
    });
    return { events, player: isPlayer ? self : p, wild: isPlayer ? w : self };
  }

  // Despertó justo al intentar actuar (sleepTurns llegó a 0 en un turno previo)
  if (self.status === "SLEEP") {
    self.status = null;
    self.sleepTurns = 0;
  }

  const atkStats = withStages(self);
  const defStats = withStages(foe);
  const result = resolveMoveUse(atkStats, defStats, move, {
    attackerBurned: self.status === "BURN",
  });

  if (!result.hit) {
    events.push({
      side: attackerSide,
      moveName: move.name,
      moveType: move.type,
      hit: false,
      isStatus: false,
      damage: 0,
      effectiveness: 1,
      hpAfter: foe.hp,
    });
  } else if (move.category === "STATUS") {
    let statusApplied: StatusCondition | null = null;
    let statChange: TurnEvent["statChange"] = null;
    const inflict = statusInflictedByMove(move.name);
    const statMv = statChangeByMove(move.name);

    if (inflict) {
      if (foe.status == null) {
        foe.status = inflict;
        statusApplied = inflict;
        if (inflict === "SLEEP") foe.sleepTurns = rollSleepTurns();
      }
    } else if (statMv) {
      const next = Math.max(-6, Math.min(6, foe.stages[statMv.stat] + statMv.stages));
      if (next !== foe.stages[statMv.stat]) {
        foe.stages[statMv.stat] = next;
        statChange = { stat: statMv.stat, stages: statMv.stages };
      }
    }

    events.push({
      side: attackerSide,
      moveName: move.name,
      moveType: move.type,
      hit: true,
      isStatus: true,
      damage: 0,
      effectiveness: 1,
      hpAfter: foe.hp,
      statusApplied,
      statChange,
    });
  } else {
    foe.hp = Math.max(0, foe.hp - result.damage);
    let recoilDamage = 0;
    if (move.id === STRUGGLE_MOVE.id || move.name === "struggle") {
      recoilDamage = Math.max(1, Math.floor(self.maxHp / 4));
      self.hp = Math.max(0, self.hp - recoilDamage);
    }
    events.push({
      side: attackerSide,
      moveName: move.name,
      moveType: move.type,
      hit: true,
      isStatus: false,
      damage: result.damage,
      effectiveness: result.effectiveness,
      hpAfter: foe.hp,
      critical: result.critical,
      recoilDamage: recoilDamage || undefined,
    });
  }

  const resid = residualDamage(self.status, self.maxHp);
  if (resid > 0 && self.hp > 0) {
    self.hp = Math.max(0, self.hp - resid);
    const last = events[events.length - 1];
    if (last) {
      last.residualDamage = resid;
      last.residualHpAfter = self.hp;
    }
  }

  return {
    events,
    player: isPlayer ? self : foe,
    wild: isPlayer ? foe : self,
  };
}

/** Atajo: solo el golpe del salvaje (mochila / huir / cambio). */
export function resolveWildCounter(
  wildMove: MoveSnapshot,
  player: SideBattleState,
  wild: SideBattleState,
): ActionOutcome {
  return resolveSingleAction("wild", wildMove, player, wild);
}
