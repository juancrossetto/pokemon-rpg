import {
  resolveMoveUse,
  STRUGGLE_MOVE,
  type CombatantStats,
  type MoveSnapshot,
  type TurnEvent,
} from "@/lib/battle";
import {
  earlyGamePowerMultiplier,
  type EarlyGameBattleMode,
} from "@/lib/early-game-balance";
import {
  applyStagesToStats,
  canActThisTurn,
  clampStage,
  emptyStatStages,
  residualDamage,
  rollSleepTurns,
  secondaryStatusByMove,
  statChangeByMove,
  statusInflictedByMove,
  tryApplyStatus,
  type BattleStat,
  type StatStages,
  type StatusCondition,
} from "@/lib/status";
import {
  drainFraction,
  flinchChance,
  healFraction,
  highCritStage,
  isOhkoMove,
  isRestMove,
  moveKey,
  ohkoAccuracy,
  recoilFraction,
  selfStatChanges,
} from "@/lib/move-effects";
import {
  applyHeldItemToStats,
  heldItemPowerMultiplier,
  resolvePlayerHeldItemTrigger,
  type HeldItemSnapshot,
} from "@/lib/held-items";
import { multiHitSpec, rollMultiHitCount } from "@/lib/multi-hit";
import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import {
  canHitSemiInvuln,
  invulnPowerMultiplier,
  twoTurnSpec,
  type SemiInvulnKind,
} from "@/lib/two-turn";

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
  /** Id del move de 2 turnos en curso (Fly/Dig/Solar Beam…). */
  chargeMoveId?: number | null;
  /** Semi-invulnerabilidad mientras carga un vanish (Fly/Dig/Dive). */
  semiInvuln?: SemiInvulnKind | null;
  /**
   * Calle rival elegida al empezar la carga (dobles).
   * En el 2º turno se respeta; si ese slot está vacío, el golpe falla.
   */
  chargeTargetLane?: "A" | "B" | null;
}

export interface ActionOutcome {
  events: TurnEvent[];
  player: SideBattleState;
  wild: SideBattleState;
  /** true si Focus Sash/Sitrus Berry/Lum Berry se acaban de gastar en esta acción. */
  itemConsumed: boolean;
  /** El golpe hizo retroceder al objetivo: pierde el turno si aún no se movió. */
  causedFlinch?: boolean;
}

function withStages(side: SideBattleState): CombatantStats {
  const mod = applyStagesToStats(side.baseStats, side.stages, side.status);
  const staged = { ...side.baseStats, ...mod };
  return applyHeldItemToStats(staged, side.heldItem, side.isFullyEvolved ?? true);
}

/** Mismos stats pero sin stages: base del crítico (que ignora stages adversas). */
function withoutStages(side: SideBattleState): CombatantStats {
  const mod = applyStagesToStats(side.baseStats, emptyStatStages(), side.status);
  const staged = { ...side.baseStats, ...mod };
  return applyHeldItemToStats(staged, side.heldItem, side.isFullyEvolved ?? true);
}

export function emptyStages(): StatStages {
  return emptyStatStages();
}

/** Aplica un cambio de stage y devuelve el delta real (0 si ya estaba al tope). */
function bumpStage(target: StatStages, stat: BattleStat, stages: number): number {
  const next = clampStage(target[stat] + stages);
  const delta = next - target[stat];
  target[stat] = next;
  return delta;
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
  opts?: {
    powerMultiplier?: number;
    /** Dobles spread: hits 2..N no reaplican burn/poison ni re-tiran canAct. */
    skipResidual?: boolean;
    assumeCanAct?: boolean;
    /** Anula el primer movimiento dañino que conecte (Égida de Torre). */
    blockDamage?: boolean;
    earlyGame?: { playerLevel: number; mode: EarlyGameBattleMode };
  },
): ActionOutcome {
  /*
    El nivel del rival sale del propio estado y no de `opts`: así la ventaja por
    nivel se aplica sin tocar la firma de ningún llamador, y sigue al Pokémon
    que esté en cancha aunque el salvaje cambie a mitad del combate.
  */
  const earlyMult = (side: "player" | "wild") =>
    opts?.earlyGame
      ? earlyGamePowerMultiplier(
          opts.earlyGame.playerLevel,
          wild.baseStats.level,
          side,
          opts.earlyGame.mode,
        )
      : 1;
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

  const act = opts?.assumeCanAct
    ? { canAct: true as const, reason: null, newSleepTurns: self.sleepTurns }
    : canActThisTurn(self.status, self.sleepTurns);
  if (!opts?.assumeCanAct) {
    self.sleepTurns = act.newSleepTurns;
  }

  if (!act.canAct && act.reason) {
    if (act.reason === "asleep" && act.newSleepTurns <= 0) {
      self.status = null;
    }
    // Status le corta la carga: cae / cancela Solar Beam / etc.
    self.chargeMoveId = null;
    self.semiInvuln = null;
    self.chargeTargetLane = null;
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

  const twoTurn = twoTurnSpec(move.name);
  const isFinishingCharge =
    self.chargeMoveId != null && self.chargeMoveId === move.id && twoTurn != null;
  const isStartingCharge = !isFinishingCharge && twoTurn != null;

  // Turno 1 de un 2-turn: no pega todavía. Vanish → se va; charge → se prepara.
  if (isStartingCharge && twoTurn) {
    let selfStatChange: TurnEvent["selfStatChange"] = null;
    if (twoTurn.chargeStat) {
      const { stat, stages } = twoTurn.chargeStat;
      const next = Math.max(-6, Math.min(6, self.stages[stat] + stages));
      if (next !== self.stages[stat]) {
        self.stages[stat] = next;
        selfStatChange = { stat, stages };
      }
    }
    self.chargeMoveId = move.id;
    self.semiInvuln = twoTurn.invuln ?? null;

    const chargeEvent: TurnEvent = {
      side: attackerSide,
      moveName: move.name,
      moveType: move.type,
      category: move.category,
      hit: true,
      isStatus: false,
      damage: 0,
      effectiveness: 1,
      hpAfter: foe.hp,
      statusNote,
      chargePhase: "start",
      semiInvuln: self.semiInvuln,
      selfStatChange,
    };
    applyResidualToEvent(self, chargeEvent);
    events.push(chargeEvent);

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
      chargeEvent.itemName = itemResult.trigger.itemName;
      chargeEvent.itemEffect = itemResult.trigger.kind;
      chargeEvent.itemAmount = itemResult.trigger.amount;
      chargeEvent.itemCuredStatus = itemResult.trigger.curedStatus;
      chargeEvent.itemHpAfter = p.hp;
    }

    return {
      events,
      player: isPlayer ? self : p,
      wild: isPlayer ? w : self,
      itemConsumed: itemResult.consumed,
    };
  }

  // Turno 2: deja de estar invulnerable justo antes de pegar.
  if (isFinishingCharge) {
    self.semiInvuln = null;
    self.chargeMoveId = null;
    self.chargeTargetLane = null;
  }

  const atkStats = withStages(self);
  const defStats = withStages(foe);
  const critBaselineStats = {
    atk: withoutStages(self).atk,
    spAtk: withoutStages(self).spAtk,
    def: withoutStages(foe).def,
    spDef: withoutStages(foe).spDef,
  };
  const accuracyStageDelta = self.stages.acc - foe.stages.eva;

  // Si el rival está en el aire / bajo tierra, la mayoría de los golpes fallan.
  const foeInvuln = foe.semiInvuln ?? null;
  const blockedByInvuln = !canHitSemiInvuln(move.name, foeInvuln);
  const invulnMult = invulnPowerMultiplier(move.name, foeInvuln);

  /** Residual del atacante + objeto del jugador + estado final. */
  function finishAction(): ActionOutcome {
    const last = events[events.length - 1];
    if (last && !opts?.skipResidual) applyResidualToEvent(self, last);

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
      causedFlinch: events.some((e) => e.causedFlinch === true),
    };
  }

  // OHKO: no usa la fórmula de daño. Precisión por diferencia de nivel y
  // fallo garantizado contra un rival de nivel superior (Gen III+).
  if (isOhkoMove(move.name) && move.category !== "STATUS") {
    const immune = getTypeEffectiveness(move.type, foe.baseStats.types) === 0;
    const landed =
      !blockedByInvuln &&
      !immune &&
      Math.random() * 100 < ohkoAccuracy(self.baseStats.level, foe.baseStats.level);
    // El daño reportado es el HP que se llevó: así el cliente anima la barra
    // completa en vez de un "-0".
    const shielded = landed && opts?.blockDamage === true;
    const dealt = landed && !shielded ? foe.hp : 0;
    if (landed && !shielded) foe.hp = 0;

    events.push({
      side: attackerSide,
      moveName: move.name,
      moveType: move.type,
      category: move.category,
      hit: landed,
      isStatus: false,
      damage: dealt,
      effectiveness: immune ? 0 : 1,
      hpAfter: foe.hp,
      hitDamages: landed ? [dealt] : undefined,
      hitCount: landed ? 1 : undefined,
      statusNote,
      ohko: landed && !shielded,
      shielded,
      noEffect: immune,
      chargePhase: isFinishingCharge ? "finish" : null,
    });
    return finishAction();
  }

  // Dream Eater sólo funciona contra un rival dormido.
  if (moveKey(move.name) === "dream-eater" && foe.status !== "SLEEP") {
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
      noEffect: true,
      chargePhase: isFinishingCharge ? "finish" : null,
    });
    return finishAction();
  }

  const result = blockedByInvuln
    ? { hit: false, damage: 0, effectiveness: 1, critical: false }
    : resolveMoveUse(atkStats, defStats, move, {
        attackerBurned: self.status === "BURN",
        critBaselineStats,
        critStage: highCritStage(move.name),
        accuracyStageDelta,
        powerMultiplier:
          heldItemPowerMultiplier(self.heldItem, move.type) *
          invulnMult *
          (opts?.powerMultiplier ?? 1) *
          earlyMult(attackerSide),
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
      chargePhase: isFinishingCharge ? "finish" : null,
    });
  } else if (move.category === "STATUS") {
    let statusApplied: StatusCondition | null = null;
    let statChange: TurnEvent["statChange"] = null;
    let healAmount = 0;
    let noEffect = false;
    const appliedSelfStats: { stat: BattleStat; stages: number }[] = [];

    const healPct = healFraction(move.name);
    const selfBoosts = selfStatChanges(move.name);
    const inflict = statusInflictedByMove(move.name);
    const statMv = statChangeByMove(move.name);

    if (isRestMove(move.name)) {
      // Rest cura todo y duerme al usuario 2 turnos, aunque ya tuviera estado.
      if (self.hp >= self.maxHp && self.status == null) {
        noEffect = true;
      } else {
        healAmount = self.maxHp - self.hp;
        self.hp = self.maxHp;
        self.status = "SLEEP";
        self.sleepTurns = 2;
      }
    } else if (healPct != null) {
      if (self.hp >= self.maxHp) {
        noEffect = true;
      } else {
        healAmount = Math.min(
          self.maxHp - self.hp,
          Math.max(1, Math.floor(self.maxHp * healPct)),
        );
        self.hp += healAmount;
      }
    } else if (selfBoosts) {
      for (const boost of selfBoosts) {
        const delta = bumpStage(self.stages, boost.stat, boost.stages);
        if (delta !== 0) appliedSelfStats.push({ stat: boost.stat, stages: delta });
      }
      if (appliedSelfStats.length === 0) noEffect = true;
    } else if (inflict) {
      const applied = tryApplyStatus(foe.status, inflict, foe.baseStats.types);
      if (applied) {
        foe.status = applied;
        statusApplied = applied;
        if (applied === "SLEEP") foe.sleepTurns = rollSleepTurns();
      } else {
        noEffect = true;
      }
    } else if (statMv) {
      const delta = bumpStage(foe.stages, statMv.stat, statMv.stages);
      if (delta !== 0) statChange = { stat: statMv.stat, stages: delta };
      else noEffect = true;
    } else {
      // Clima, pantallas, trampas… todavía sin mecánica en el motor: se avisa
      // en vez de fingir que el turno hizo algo.
      noEffect = true;
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
      selfStatChange: appliedSelfStats[0] ?? null,
      selfStatChanges: appliedSelfStats.length > 0 ? appliedSelfStats : undefined,
      healAmount: healAmount || undefined,
      healHpAfter: healAmount > 0 ? self.hp : undefined,
      noEffect: noEffect || undefined,
      statusNote,
      chargePhase: isFinishingCharge ? "finish" : null,
    });
  } else {
    if (opts?.blockDamage) {
      events.push({
        side: attackerSide,
        moveName: move.name,
        moveType: move.type,
        category: move.category,
        hit: true,
        isStatus: false,
        damage: 0,
        effectiveness: result.effectiveness,
        hpAfter: foe.hp,
        statusNote,
        shielded: true,
        chargePhase: isFinishingCharge ? "finish" : null,
      });
      return finishAction();
    }

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
        critBaselineStats,
        critStage: highCritStage(move.name),
        powerMultiplier:
          heldItemPowerMultiplier(self.heldItem, move.type) *
          invulnMult *
          (opts?.powerMultiplier ?? 1) *
          earlyMult(attackerSide),
        forceHit: true,
      });
      const dealt = Math.min(next.damage, foe.hp);
      foe.hp = Math.max(0, foe.hp - next.damage);
      hitDamages.push(dealt);
      if (next.critical) anyCritical = true;
      lastEffectiveness = next.effectiveness;
    }

    const totalDamage = hitDamages.reduce((a, b) => a + b, 0);

    // Drenaje: se cura antes del retroceso, igual que en los juegos.
    let healAmount = 0;
    const drain = drainFraction(move.name);
    if (drain != null && totalDamage > 0 && self.hp > 0 && self.hp < self.maxHp) {
      healAmount = Math.min(
        self.maxHp - self.hp,
        Math.max(1, Math.floor(totalDamage * drain)),
      );
      self.hp += healAmount;
    }

    let recoilDamage = 0;
    if (!opts?.skipResidual) {
      if (move.id === STRUGGLE_MOVE.id || move.name === "struggle") {
        recoilDamage += Math.max(1, Math.floor(self.maxHp / 4));
      }
      const recoil = recoilFraction(move.name);
      if (recoil != null && totalDamage > 0) {
        recoilDamage += Math.max(1, Math.floor(totalDamage * recoil));
      }
      if (self.heldItem?.effect === "LIFE_ORB" && totalDamage > 0) {
        recoilDamage += Math.max(1, Math.floor(self.maxHp * 0.1));
      }
      if (recoilDamage > 0) {
        self.hp = Math.max(0, self.hp - recoilDamage);
      }
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

    // El flinch lo consume quien resuelve el turno: sólo sirve si el objetivo
    // todavía no se movió.
    const flinchP = flinchChance(move.name);
    const causedFlinch = flinchP > 0 && foe.hp > 0 && Math.random() < flinchP;

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
      recoilHpAfter: recoilDamage > 0 ? self.hp : undefined,
      healAmount: healAmount || undefined,
      healHpAfter: healAmount > 0 ? self.hp : undefined,
      healFromDrain: healAmount > 0 ? true : undefined,
      causedFlinch: causedFlinch || undefined,
      statusApplied,
      statusNote,
      chargePhase: isFinishingCharge ? "finish" : null,
    });
  }

  return finishAction();
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
  opts?: {
    earlyGame?: { playerLevel: number; mode: EarlyGameBattleMode };
  },
): ActionOutcome {
  return resolveSingleAction("wild", wildMove, player, wild, playerItemConsumed, opts);
}
