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
import {
  applyHeldItemToStats,
  heldItemPowerMultiplier,
  resolvePlayerHeldItemTrigger,
  type HeldItemSnapshot,
} from "@/lib/held-items";

export interface SideBattleState {
  hp: number;
  maxHp: number;
  status: StatusCondition | null;
  sleepTurns: number;
  stages: StatStages;
  name: string;
  baseStats: CombatantStats;
  /** Solo el jugador puede tener objeto equipado por ahora. */
  heldItem?: HeldItemSnapshot | null;
  isFullyEvolved?: boolean;
}

export interface ActionOutcome {
  events: TurnEvent[];
  player: SideBattleState;
  wild: SideBattleState;
  /** true si Focus Sash/Sitrus Berry/Lum Berry se acaban de gastar en esta acción. */
  itemConsumed: boolean;
}

function withStages(side: SideBattleState): CombatantStats {
  const mod = applyStagesToStats(side.baseStats, side.stages, side.status);
  const staged = { ...side.baseStats, ...mod };
  return applyHeldItemToStats(staged, side.heldItem, side.isFullyEvolved ?? true);
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
  playerItemConsumed = false,
): ActionOutcome {
  const events: TurnEvent[] = [];
  const p: SideBattleState = { ...player, stages: { ...player.stages } };
  const w: SideBattleState = { ...wild, stages: { ...wild.stages } };

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
      category: move.category,
      hit: false,
      isStatus: false,
      damage: 0,
      effectiveness: 1,
      hpAfter: foe.hp,
      skipped: act.reason,
    });
    return {
      events,
      player: isPlayer ? self : p,
      wild: isPlayer ? w : self,
      itemConsumed: playerItemConsumed,
    };
  }

  // Despertó justo al intentar actuar (sleepTurns llegó a 0 en un turno previo)
  if (self.status === "SLEEP") {
    self.status = null;
    self.sleepTurns = 0;
  }

  const playerHpBefore = p.hp;
  const playerStatusBefore = p.status;

  const atkStats = withStages(self);
  const defStats = withStages(foe);
  const result = resolveMoveUse(atkStats, defStats, move, {
    attackerBurned: self.status === "BURN",
    powerMultiplier: heldItemPowerMultiplier(self.heldItem, move.type),
  });

  if (!result.hit) {
    events.push({
      side: attackerSide,
      moveName: move.name,
      moveType: move.type,
      category: move.category,
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
      category: move.category,
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
      recoilDamage += Math.max(1, Math.floor(self.maxHp / 4));
    }
    if (self.heldItem?.effect === "LIFE_ORB" && result.damage > 0) {
      recoilDamage += Math.max(1, Math.floor(self.maxHp * 0.1));
    }
    if (recoilDamage > 0) {
      self.hp = Math.max(0, self.hp - recoilDamage);
    }
    events.push({
      side: attackerSide,
      moveName: move.name,
      moveType: move.type,
      category: move.category,
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

  const itemResult = resolvePlayerHeldItemTrigger({
    heldItem: p.heldItem,
    hpBefore: playerHpBefore,
    hp: p.hp,
    maxHp: p.maxHp,
    statusBefore: playerStatusBefore,
    status: p.status,
    alreadyConsumed: playerItemConsumed,
    isActingThisCall: isPlayer,
  });
  p.hp = itemResult.hp;
  p.status = itemResult.status;
  if (itemResult.trigger) {
    const last = events[events.length - 1];
    if (last) {
      last.itemName = itemResult.trigger.itemName;
      last.itemEffect = itemResult.trigger.kind;
      last.itemAmount = itemResult.trigger.amount;
      last.itemCuredStatus = itemResult.trigger.curedStatus;
      last.itemHpAfter = p.hp;
    }
  }

  return {
    events,
    player: isPlayer ? self : foe,
    wild: isPlayer ? foe : self,
    itemConsumed: itemResult.consumed,
  };
}

/** Atajo: solo el golpe del salvaje (mochila / huir / cambio). */
export function resolveWildCounter(
  wildMove: MoveSnapshot,
  player: SideBattleState,
  wild: SideBattleState,
  playerItemConsumed = false,
): ActionOutcome {
  return resolveSingleAction("wild", wildMove, player, wild, playerItemConsumed);
}
