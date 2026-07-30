import type { StatusCondition } from "@/lib/status";

/**
 * Estado del “slot B” en batallas dobles (Torre elite MVP).
 * Slot A sigue en las columnas clásicas de BattleSession (pokemonInstanceId / wild*).
 */
export interface DoublesWildSlot {
  speciesId: number;
  level: number;
  currentHp: number;
  maxHp: number;
  moveIds: number[];
  movePp: number[];
  isShiny: boolean;
  status: StatusCondition | null;
  sleepTurns: number;
  atkStage: number;
  defStage: number;
  speStage: number;
  heldItemId: string | null;
  itemConsumed: boolean;
  choiceLockMoveId: number | null;
  chargeMoveId: number | null;
  /** Calle rival locked al empezar Fly/Dig… (null si no hay carga). */
  chargeTargetLane: "A" | "B" | null;
}

export interface DoublesPlayerBState {
  status: StatusCondition | null;
  sleepTurns: number;
  atkStage: number;
  defStage: number;
  speStage: number;
  choiceLockMoveId: number | null;
  itemConsumed: boolean;
  chargeMoveId: number | null;
  chargeTargetLane: "A" | "B" | null;
}

export interface DoublesFieldB {
  player: DoublesPlayerBState;
  wild: DoublesWildSlot;
  /** Target locked del slot A del jugador (columnas clásicas). */
  playerAChargeTargetLane?: "A" | "B" | null;
  /** Target locked del wild A. */
  wildAChargeTargetLane?: "A" | "B" | null;
}

export function emptyPlayerBState(): DoublesPlayerBState {
  return {
    status: null,
    sleepTurns: 0,
    atkStage: 0,
    defStage: 0,
    speStage: 0,
    choiceLockMoveId: null,
    itemConsumed: false,
    chargeMoveId: null,
    chargeTargetLane: null,
  };
}

export function parseDoublesFieldB(raw: unknown): DoublesFieldB | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const wild = o.wild as DoublesWildSlot | undefined;
  const player = o.player as DoublesPlayerBState | undefined;
  if (!wild || typeof wild.speciesId !== "number" || typeof wild.currentHp !== "number") {
    return null;
  }
  const laneOrNull = (v: unknown): "A" | "B" | null =>
    v === "A" || v === "B" ? v : null;
  return {
    player: {
      ...(player ?? emptyPlayerBState()),
      chargeTargetLane: laneOrNull(player?.chargeTargetLane),
    },
    wild: {
      ...wild,
      chargeTargetLane: laneOrNull(wild.chargeTargetLane),
    },
    playerAChargeTargetLane: laneOrNull(o.playerAChargeTargetLane),
    wildAChargeTargetLane: laneOrNull(o.wildAChargeTargetLane),
  };
}

export function buildDoublesFieldB(wild: DoublesWildSlot, player = emptyPlayerBState()): DoublesFieldB {
  return { player, wild };
}
