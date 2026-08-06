/**
 * Tipos y helpers puros de level-up, **sin Prisma**.
 *
 * `level-up.ts` consulta la DB; si un Client Component importa de ahí (aunque
 * sea sólo un tipo o `knownFromLevelUp`), Next empaqueta `pg` en el browser y
 * el build muere con `Can't resolve 'dns'`.
 */

export type MoveCategoryKind = "PHYSICAL" | "SPECIAL" | "STATUS";

export type LevelUpMoveInfo = {
  moveId: number;
  name: string;
  type: string;
  category: MoveCategoryKind;
  power: number | null;
  accuracy: number | null;
  learnLevel: number;
  pp: number;
  /** Texto de efecto (PokeAPI), ya limpio para UI. */
  effectText: string | null;
};

/** Movimiento ya conocido (slots 1–4) con stats para comparar al reemplazar. */
export type KnownMoveInfo = {
  slot: number;
  moveId: number;
  name: string;
  type: string;
  category: MoveCategoryKind;
  power: number | null;
  accuracy: number | null;
  pp: number;
  effectText: string | null;
};

export type EvolveOffer = {
  toSpeciesId: number;
  toName: string;
  toSpriteUrl: string;
  evolveLevel: number;
};

export type LevelUpEffects = {
  autoTaught: LevelUpMoveInfo[];
  pendingMoves: LevelUpMoveInfo[];
  evolveOffer: EvolveOffer | null;
  knownMoves: KnownMoveInfo[];
};

type MoveFields = {
  id: number;
  name: string;
  type: string;
  category: MoveCategoryKind;
  power: number | null;
  accuracy: number | null;
  pp: number;
  effectText?: string | null;
};

export function toKnownMoveInfo(slot: number, move: MoveFields): KnownMoveInfo {
  return {
    slot,
    moveId: move.id,
    name: move.name,
    type: move.type,
    category: move.category,
    power: move.power,
    accuracy: move.accuracy,
    pp: move.pp,
    effectText: move.effectText ?? null,
  };
}

export function knownFromLevelUp(slot: number, move: LevelUpMoveInfo): KnownMoveInfo {
  return {
    slot,
    moveId: move.moveId,
    name: move.name,
    type: move.type,
    category: move.category,
    power: move.power,
    accuracy: move.accuracy,
    pp: move.pp,
    effectText: move.effectText,
  };
}

export function toLevelUpMoveInfo(move: MoveFields, learnLevel: number): LevelUpMoveInfo {
  return {
    moveId: move.id,
    name: move.name,
    type: move.type,
    category: move.category,
    power: move.power,
    accuracy: move.accuracy,
    learnLevel,
    pp: move.pp,
    effectText: move.effectText ?? null,
  };
}
