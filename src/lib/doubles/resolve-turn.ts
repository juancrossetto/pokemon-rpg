import { type MoveSnapshot, type TurnEvent } from "@/lib/battle";
import { resolveSingleAction, type SideBattleState } from "@/lib/resolve-action";
import { applyStagesToStats } from "@/lib/status";
import { twoTurnSpec } from "@/lib/two-turn";
import {
  DOUBLES_SPREAD_DAMAGE_MULT,
  hitsAllyInDoubles,
  isSelfOrAllyOnlyMove,
  isSpreadMove,
  normalizeMoveTarget,
} from "@/lib/move-target";

export type DoubleSlot = "playerA" | "playerB" | "wildA" | "wildB";
export type FieldLane = "A" | "B";

export interface DoubleAction {
  slot: DoubleSlot;
  move: MoveSnapshot;
  /** Calle del rival elegida (solo single-target). Ignorado en spread/self. */
  targetLane?: FieldLane | null;
}

export interface DoubleField {
  playerA: SideBattleState;
  playerB: SideBattleState | null;
  wildA: SideBattleState;
  wildB: SideBattleState | null;
}

function slotSide(slot: DoubleSlot): "player" | "wild" {
  return slot.startsWith("player") ? "player" : "wild";
}

function slotLane(slot: DoubleSlot): FieldLane {
  return slot.endsWith("A") ? "A" : "B";
}

function foeSlot(side: "player" | "wild", lane: FieldLane): DoubleSlot {
  if (side === "player") return lane === "A" ? "wildA" : "wildB";
  return lane === "A" ? "playerA" : "playerB";
}

function allySlot(slot: DoubleSlot): DoubleSlot {
  return slotLane(slot) === "A"
    ? slotSide(slot) === "player"
      ? "playerB"
      : "wildB"
    : slotSide(slot) === "player"
      ? "playerA"
      : "wildA";
}

/** Rival por defecto en la misma calle (A↔A, B↔B). */
export function defaultTarget(slot: DoubleSlot): DoubleSlot {
  return foeSlot(slotSide(slot), slotLane(slot));
}

function getSlot(field: DoubleField, slot: DoubleSlot): SideBattleState | null {
  switch (slot) {
    case "playerA":
      return field.playerA;
    case "playerB":
      return field.playerB;
    case "wildA":
      return field.wildA;
    case "wildB":
      return field.wildB;
  }
}

function setSlot(field: DoubleField, slot: DoubleSlot, state: SideBattleState) {
  switch (slot) {
    case "playerA":
      field.playerA = state;
      break;
    case "playerB":
      field.playerB = state;
      break;
    case "wildA":
      field.wildA = state;
      break;
    case "wildB":
      field.wildB = state;
      break;
  }
}

function effectiveSpeed(side: SideBattleState): number {
  return applyStagesToStats(side.baseStats, side.stages, side.status).speed;
}

function tagEvents(
  events: TurnEvent[],
  attackerSlot: DoubleSlot,
  targetSlot: DoubleSlot,
): TurnEvent[] {
  const targetSide = slotSide(targetSlot);
  return events.map((e) => ({
    ...e,
    fieldSlot: slotLane(attackerSlot),
    targetFieldSlot: slotLane(targetSlot),
    // Necesario para spreads que pegan al aliado (Earthquake): el cliente
    // no puede asumir que el defensor es siempre el bando contrario.
    targetSide,
  }));
}

/** Si el slot pedido está caído, el otro de ese bando. */
function livingFoeOrRedirect(
  field: DoubleField,
  preferred: DoubleSlot,
): DoubleSlot | null {
  const preferredMon = getSlot(field, preferred);
  if (preferredMon && preferredMon.hp > 0) return preferred;
  const alt: DoubleSlot =
    preferred === "wildA"
      ? "wildB"
      : preferred === "wildB"
        ? "wildA"
        : preferred === "playerA"
          ? "playerB"
          : "playerA";
  const altMon = getSlot(field, alt);
  if (altMon && altMon.hp > 0) return alt;
  return null;
}

function livingFoeSlots(field: DoubleField, attackerSide: "player" | "wild"): DoubleSlot[] {
  const a = foeSlot(attackerSide, "A");
  const b = foeSlot(attackerSide, "B");
  const out: DoubleSlot[] = [];
  const ma = getSlot(field, a);
  const mb = getSlot(field, b);
  if (ma && ma.hp > 0) out.push(a);
  if (mb && mb.hp > 0) out.push(b);
  return out;
}

function resolveHitOnTarget(
  field: DoubleField,
  action: DoubleAction,
  targetSlot: DoubleSlot,
  itemA: boolean,
  itemB: boolean,
  powerMult: number,
  spreadFollowUp = false,
  blockDamage = false,
): {
  events: TurnEvent[];
  itemA: boolean;
  itemB: boolean;
} {
  const attacker = getSlot(field, action.slot);
  const defender = getSlot(field, targetSlot);
  if (!attacker || attacker.hp <= 0 || !defender || defender.hp <= 0) {
    return { events: [], itemA, itemB };
  }

  const atkSide = slotSide(action.slot);
  const consumed =
    action.slot === "playerA" ? itemA : action.slot === "playerB" ? itemB : false;
  const actionOpts = {
    powerMultiplier: powerMult,
    skipResidual: spreadFollowUp,
    assumeCanAct: spreadFollowUp,
    blockDamage,
  };

  let outcome;
  if (atkSide === "player") {
    outcome = resolveSingleAction(
      "player",
      action.move,
      attacker,
      defender,
      consumed,
      actionOpts,
    );
    setSlot(field, action.slot, outcome.player);
    setSlot(field, targetSlot, outcome.wild);
    if (action.slot === "playerA") itemA = outcome.itemConsumed;
    if (action.slot === "playerB") itemB = outcome.itemConsumed;
  } else {
    outcome = resolveSingleAction(
      "wild",
      action.move,
      defender,
      attacker,
      false,
      actionOpts,
    );
    setSlot(field, targetSlot, outcome.player);
    setSlot(field, action.slot, outcome.wild);
  }

  return {
    events: tagEvents(outcome.events, action.slot, targetSlot),
    itemA,
    itemB,
  };
}

/**
 * Resuelve un turno de dobles (Torre elite):
 * - Hasta 4 acciones por Speed.
 * - Single-target: targetLane del jugador (o misma calle / redirect).
 * - Spread (all-opponents / all-other-pokemon): pega a todos los vivos aplicables ×0.75.
 */
export function resolveDoubleTurn(
  fieldIn: DoubleField,
  actions: DoubleAction[],
  playerItemConsumedA: boolean,
  playerItemConsumedB: boolean,
  opts?: { blockFirstPlayerHit?: boolean },
): {
  events: TurnEvent[];
  field: DoubleField;
  playerItemConsumedA: boolean;
  playerItemConsumedB: boolean;
} {
  const field: DoubleField = {
    playerA: { ...fieldIn.playerA, stages: { ...fieldIn.playerA.stages } },
    playerB: fieldIn.playerB
      ? { ...fieldIn.playerB, stages: { ...fieldIn.playerB.stages } }
      : null,
    wildA: { ...fieldIn.wildA, stages: { ...fieldIn.wildA.stages } },
    wildB: fieldIn.wildB
      ? { ...fieldIn.wildB, stages: { ...fieldIn.wildB.stages } }
      : null,
  };

  let itemA = playerItemConsumedA;
  let itemB = playerItemConsumedB;
  let shieldAvailable = opts?.blockFirstPlayerHit === true;
  const events: TurnEvent[] = [];

  const hitTarget = (
    action: DoubleAction,
    target: DoubleSlot,
    powerMult: number,
    spreadFollowUp = false,
  ) => {
    const shouldBlock =
      shieldAvailable &&
      slotSide(action.slot) === "wild" &&
      slotSide(target) === "player";
    const hit = resolveHitOnTarget(
      field,
      action,
      target,
      itemA,
      itemB,
      powerMult,
      spreadFollowUp,
      shouldBlock,
    );
    itemA = hit.itemA;
    itemB = hit.itemB;
    if (hit.events.some((event) => event.shielded)) shieldAvailable = false;
    return hit;
  };

  const livingActions = actions.filter((a) => {
    const self = getSlot(field, a.slot);
    return self != null && self.hp > 0;
  });

  livingActions.sort((a, b) => {
    // Prioridad primero (Quick Attack, Protect…), Speed después — igual que singles.
    if (a.move.priority !== b.move.priority) return b.move.priority - a.move.priority;
    const sa = getSlot(field, a.slot)!;
    const sb = getSlot(field, b.slot)!;
    const spdA = effectiveSpeed(sa);
    const spdB = effectiveSpeed(sb);
    if (spdA !== spdB) return spdB - spdA;
    const aPlayer = slotSide(a.slot) === "player";
    const bPlayer = slotSide(b.slot) === "player";
    if (aPlayer !== bPlayer) return aPlayer ? -1 : 1;
    return 0;
  });

  // Slots que perdieron el turno por retroceso de un golpe anterior.
  const flinched = new Set<DoubleSlot>();

  for (const action of livingActions) {
    const attacker = getSlot(field, action.slot);
    if (!attacker || attacker.hp <= 0) continue;

    const atkSide = slotSide(action.slot);
    const targetKind = normalizeMoveTarget(action.move.target, action.move.name);

    if (flinched.has(action.slot)) {
      events.push(
        ...tagEvents(
          [
            {
              side: atkSide,
              moveName: action.move.name,
              moveType: action.move.type,
              category: action.move.category,
              hit: false,
              isStatus: false,
              damage: 0,
              effectiveness: 1,
              hpAfter: 0,
              skipped: "flinch",
            },
          ],
          action.slot,
          action.slot,
        ),
      );
      continue;
    }

    // Self-target (Swords Dance, Recover…): se resuelve con un rival vivo como
    // defensor ficticio — el movimiento no lo toca, pero el motor necesita dos
    // lados. Antes se salteaba y el turno se perdía sin efecto.
    if (isSelfOrAllyOnlyMove(action.move.target, action.move.name)) {
      void targetKind;
      const bystander = livingFoeOrRedirect(field, defaultTarget(action.slot));
      if (!bystander) continue;
      const hit = hitTarget(action, bystander, 1);
      // El objetivo real es uno mismo: el cliente no debe animar al rival.
      events.push(
        ...hit.events.map((e) => ({
          ...e,
          targetSide: atkSide,
          targetFieldSlot: slotLane(action.slot),
        })),
      );
      continue;
    }

    if (isSpreadMove(action.move.target, action.move.name)) {
      const foes = livingFoeSlots(field, atkSide);
      const ally =
        hitsAllyInDoubles(action.move.target, action.move.name)
          ? (() => {
              const s = allySlot(action.slot);
              const m = getSlot(field, s);
              return m && m.hp > 0 ? s : null;
            })()
          : null;
      const targets = ally ? [...foes, ally] : foes;
      if (targets.length === 0) continue;
      const mult = targets.length >= 2 ? DOUBLES_SPREAD_DAMAGE_MULT : 1;

      // Accuracy / skip del atacante se resuelve en el primer hit; residual solo una vez.
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i]!;
        // Re-check living mid-spread (KO de un hit previo).
        const mon = getSlot(field, t);
        if (!mon || mon.hp <= 0) continue;
        const hit = hitTarget(action, t, mult, i > 0);
        events.push(...hit.events);
        if (hit.events.some((e) => e.causedFlinch)) flinched.add(t);
        // Si el atacante se saltó el turno (sleep etc.), no seguir pegando.
        if (hit.events.some((e) => e.skipped)) break;
      }
      continue;
    }

    // Single-target (selected-pokemon / random / default).
    // Fly/Dig: el target se elige al empezar; el finish respeta esa calle sin redirigir
    // (Showdown: Dig/Fly keep the selected slot; empty slot → fail).
    const finishingCharge =
      attacker.chargeMoveId != null && attacker.chargeMoveId === action.move.id;
    const twoTurn = twoTurnSpec(action.move.name);
    const startingCharge =
      !finishingCharge && twoTurn != null && attacker.chargeMoveId == null;

    const preferredLane: FieldLane =
      finishingCharge &&
      (attacker.chargeTargetLane === "A" || attacker.chargeTargetLane === "B")
        ? attacker.chargeTargetLane
        : action.targetLane === "A" || action.targetLane === "B"
          ? action.targetLane
          : slotLane(action.slot);
    const preferred = foeSlot(atkSide, preferredLane);

    if (finishingCharge) {
      const mon = getSlot(field, preferred);
      if (!mon || mon.hp <= 0) {
        attacker.chargeMoveId = null;
        attacker.semiInvuln = null;
        attacker.chargeTargetLane = null;
        setSlot(field, action.slot, attacker);
        events.push(
          ...tagEvents(
            [
              {
                side: atkSide,
                moveName: action.move.name,
                moveType: action.move.type,
                category: action.move.category,
                hit: false,
                isStatus: false,
                damage: 0,
                effectiveness: 1,
                hpAfter: 0,
                chargePhase: "finish",
              },
            ],
            action.slot,
            preferred,
          ),
        );
        continue;
      }
      const hit = hitTarget(action, preferred, 1);
      events.push(...hit.events);
      if (hit.events.some((e) => e.causedFlinch)) flinched.add(preferred);
      continue;
    }

    if (startingCharge && twoTurn) {
      const mon = getSlot(field, preferred);
      if (!mon || mon.hp <= 0) {
        // Empieza la carga igual; el finish fallará si el slot sigue vacío.
        attacker.chargeMoveId = action.move.id;
        attacker.semiInvuln = twoTurn.invuln ?? null;
        attacker.chargeTargetLane = preferredLane;
        setSlot(field, action.slot, attacker);
        events.push(
          ...tagEvents(
            [
              {
                side: atkSide,
                moveName: action.move.name,
                moveType: action.move.type,
                category: action.move.category,
                hit: true,
                isStatus: false,
                damage: 0,
                effectiveness: 1,
                hpAfter: 0,
                chargePhase: "start",
                semiInvuln: attacker.semiInvuln,
              },
            ],
            action.slot,
            preferred,
          ),
        );
        continue;
      }
    }

    const targetSlot = livingFoeOrRedirect(field, preferred);
    if (!targetSlot) continue;

    const hit = hitTarget(action, targetSlot, 1);
    events.push(...hit.events);
    if (hit.events.some((e) => e.causedFlinch)) flinched.add(targetSlot);

    // Lockea la calle elegida (no la del redirect).
    if (hit.events.some((e) => e.chargePhase === "start")) {
      const atk = getSlot(field, action.slot);
      if (atk) {
        atk.chargeTargetLane = preferredLane;
        setSlot(field, action.slot, atk);
      }
    }
  }

  return {
    events,
    field,
    playerItemConsumedA: itemA,
    playerItemConsumedB: itemB,
  };
}

export function doublesWon(field: DoubleField): boolean {
  const aDown = field.wildA.hp <= 0;
  const bDown = !field.wildB || field.wildB.hp <= 0;
  return aDown && bDown;
}

export function doublesLost(field: DoubleField): boolean {
  const aDown = field.playerA.hp <= 0;
  const bDown = !field.playerB || field.playerB.hp <= 0;
  return aDown && bDown;
}
