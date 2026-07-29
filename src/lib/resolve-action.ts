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
  secondaryStatusByMove,
  statChangeByMove,
  statusInflictedByMove,
  tryApplyStatus,
  type StatStages,
  type StatusCondition,
} from "@/lib/status";
import {
  applyHeldItemToStats,
  heldItemPowerMultiplier,
  resolvePlayerHeldItemTrigger,
  type HeldItemSnapshot,
} from "@/lib/held-items";
import { multiHitSpec, rollMultiHitCount } from "@/lib/multi-hit";

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
 * El residual burn/poison se aplica al atacante al final de su acción
 * (también si no pudo moverse por para/sueño/congelación).
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

  // Sueño sin contador (dato viejo / inconsistente): re-tira turnos para no
  // despertar al instante y parecer que el estado no hace nada.
  if (self.status === "SLEEP" && self.sleepTurns <= 0) {
    self.sleepTurns = rollSleepTurns();
  }

  const act = canActThisTurn(self.status, self.sleepTurns);
  self.sleepTurns = act.newSleepTurns;

  if (!act.canAct && act.reason) {
    if (act.reason === "asleep" && act.newSleepTurns <= 0) {
      self.status = null;
    }
    const skipEvent: TurnEvent = {
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
    };
    applyResidualToEvent(self, skipEvent);
    events.push(skipEvent);

    const itemResult = resolvePlayerHeldItemTrigger({
      heldItem: p.heldItem,
      hpBefore: p.hp,
      hp: p.hp,
      maxHp: p.maxHp,
      statusBefore: p.status,
      status: p.status,
      alreadyConsumed: playerItemConsumed,
      // Leftovers cura al final de la acción del jugador aunque esté paralizado.
      isActingThisCall: isPlayer,
    });
    p.hp = itemResult.hp;
    p.status = itemResult.status;
    if (itemResult.trigger) {
      skipEvent.itemName = itemResult.trigger.itemName;
      skipEvent.itemEffect = itemResult.trigger.kind;
      skipEvent.itemAmount = itemResult.trigger.amount;
      skipEvent.itemCuredStatus = itemResult.trigger.curedStatus;
      skipEvent.itemHpAfter = p.hp;
    }

    return {
      events,
      player: isPlayer ? self : p,
      wild: isPlayer ? w : self,
      itemConsumed: itemResult.consumed,
    };
  }

  // Despertó / se descongeló al intentar actuar.
  let statusNote: TurnEvent["statusNote"] = null;
  if (self.status === "SLEEP") {
    statusNote = "woke";
    self.status = null;
    self.sleepTurns = 0;
  } else if (self.status === "FREEZE") {
    statusNote = "thawed";
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
      statusNote,
    });
  } else if (move.category === "STATUS") {
    let statusApplied: StatusCondition | null = null;
    let statChange: TurnEvent["statChange"] = null;
    const inflict = statusInflictedByMove(move.name);
    const statMv = statChangeByMove(move.name);

    if (inflict) {
      const applied = tryApplyStatus(foe.status, inflict, foe.baseStats.types);
      if (applied) {
        foe.status = applied;
        statusApplied = applied;
        if (applied === "SLEEP") foe.sleepTurns = rollSleepTurns();
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
      statusNote,
    });
  } else {
    // `result` ya confirmó el acierto y el daño del primer golpe.
    const multi = multiHitSpec(move.name);
    const plannedHits = multi ? rollMultiHitCount(multi) : 1;
    const hitDamages: number[] = [];
    let anyCritical = result.critical;
    let lastEffectiveness = result.effectiveness;

    const dealtFirst = Math.min(result.damage, foe.hp);
    foe.hp = Math.max(0, foe.hp - result.damage);
    hitDamages.push(dealtFirst);

    for (let i = 1; i < plannedHits; i++) {
      if (foe.hp <= 0) break;
      const next = resolveMoveUse(atkStats, defStats, move, {
        attackerBurned: self.status === "BURN",
        powerMultiplier: heldItemPowerMultiplier(self.heldItem, move.type),
        forceHit: true,
      });
      const dealt = Math.min(next.damage, foe.hp);
      foe.hp = Math.max(0, foe.hp - next.damage);
      hitDamages.push(dealt);
      if (next.critical) anyCritical = true;
      lastEffectiveness = next.effectiveness;
    }

    const totalDamage = hitDamages.reduce((a, b) => a + b, 0);
    let recoilDamage = 0;
    if (move.id === STRUGGLE_MOVE.id || move.name === "struggle") {
      recoilDamage += Math.max(1, Math.floor(self.maxHp / 4));
    }
    if (self.heldItem?.effect === "LIFE_ORB" && totalDamage > 0) {
      recoilDamage += Math.max(1, Math.floor(self.maxHp * 0.1));
    }
    if (recoilDamage > 0) {
      self.hp = Math.max(0, self.hp - recoilDamage);
    }

    // Fuego descongela al rival si lo golpea (Gen II+).
    if (foe.status === "FREEZE" && move.type.toLowerCase() === "fire") {
      foe.status = null;
    }

    let statusApplied: StatusCondition | null = null;
    const secondary = secondaryStatusByMove(move.name);
    if (secondary && foe.hp > 0 && Math.random() < secondary.chance) {
      const applied = tryApplyStatus(foe.status, secondary.status, foe.baseStats.types);
      if (applied) {
        foe.status = applied;
        statusApplied = applied;
        if (applied === "SLEEP") foe.sleepTurns = rollSleepTurns();
      }
    }

    events.push({
      side: attackerSide,
      moveName: move.name,
      moveType: move.type,
      category: move.category,
      hit: true,
      isStatus: false,
      damage: totalDamage,
      effectiveness: lastEffectiveness,
      hpAfter: foe.hp,
      critical: anyCritical,
      hitCount: hitDamages.length,
      hitDamages,
      recoilDamage: recoilDamage || undefined,
      statusApplied,
      statusNote,
    });
  }

  const last = events[events.length - 1];
  if (last) applyResidualToEvent(self, last);

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
  if (itemResult.trigger && last) {
    last.itemName = itemResult.trigger.itemName;
    last.itemEffect = itemResult.trigger.kind;
    last.itemAmount = itemResult.trigger.amount;
    last.itemCuredStatus = itemResult.trigger.curedStatus;
    last.itemHpAfter = p.hp;
  }

  return {
    events,
    player: isPlayer ? self : foe,
    wild: isPlayer ? foe : self,
    itemConsumed: itemResult.consumed,
  };
}

function applyResidualToEvent(self: SideBattleState, event: TurnEvent) {
  const resid = residualDamage(self.status, self.maxHp);
  if (resid > 0 && self.hp > 0) {
    const statusBefore = self.status;
    self.hp = Math.max(0, self.hp - resid);
    event.residualDamage = resid;
    event.residualHpAfter = self.hp;
    event.residualStatus = statusBefore;
  }
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
