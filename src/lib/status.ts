/** Condiciones de estado no volátiles + cambios de stats en batalla. */

export type StatusCondition = "BURN" | "PARALYSIS" | "POISON" | "SLEEP";
export type BattleStat = "atk" | "def" | "spe";

export interface StatStages {
  atk: number;
  def: number;
  spe: number;
}

export function clampStage(stage: number): number {
  return Math.max(-6, Math.min(6, stage));
}

/** Multiplicador Gen III+ por stage (−6…+6). */
export function stageMultiplier(stage: number): number {
  const s = clampStage(stage);
  if (s >= 0) return (2 + s) / 2;
  return 2 / (2 - s);
}

export function applyStagesToStats(
  base: { atk: number; def: number; spAtk: number; spDef: number; speed: number },
  stages: StatStages,
  status: StatusCondition | null,
): { atk: number; def: number; spAtk: number; spDef: number; speed: number } {
  let speed = Math.max(1, Math.floor(base.speed * stageMultiplier(stages.spe)));
  if (status === "PARALYSIS") speed = Math.max(1, Math.floor(speed * 0.5));
  return {
    atk: Math.max(1, Math.floor(base.atk * stageMultiplier(stages.atk))),
    def: Math.max(1, Math.floor(base.def * stageMultiplier(stages.def))),
    spAtk: base.spAtk,
    spDef: base.spDef,
    speed,
  };
}

/** Slug de nombre PokeAPI → efecto de estado o cambio de stat. */
const INFLICT: Record<string, StatusCondition> = {
  "poison-powder": "POISON",
  poisonpowder: "POISON",
  toxic: "POISON",
  "poison-gas": "POISON",
  poisongas: "POISON",
  "will-o-wisp": "BURN",
  willowisp: "BURN",
  "thunder-wave": "PARALYSIS",
  thunderwave: "PARALYSIS",
  "stun-spore": "PARALYSIS",
  stunspore: "PARALYSIS",
  glare: "PARALYSIS",
  "sleep-powder": "SLEEP",
  sleeppowder: "SLEEP",
  hypnosis: "SLEEP",
  sing: "SLEEP",
  spore: "SLEEP",
  "lovely-kiss": "SLEEP",
  lovelykiss: "SLEEP",
  "yawn": "SLEEP",
};

const STAT_MOVES: Record<string, { stat: BattleStat; stages: number }> = {
  growl: { stat: "atk", stages: -1 },
  "tail-whip": { stat: "def", stages: -1 },
  tailwhip: { stat: "def", stages: -1 },
  leer: { stat: "def", stages: -1 },
  "string-shot": { stat: "spe", stages: -1 },
  stringshot: { stat: "spe", stages: -1 },
  screech: { stat: "def", stages: -2 },
  "baby-doll-eyes": { stat: "atk", stages: -1 },
  babydolleyes: { stat: "atk", stages: -1 },
  charm: { stat: "atk", stages: -2 },
};

export function normalizeMoveKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export function statusInflictedByMove(moveName: string): StatusCondition | null {
  return INFLICT[normalizeMoveKey(moveName)] ?? null;
}

export function statChangeByMove(moveName: string): { stat: BattleStat; stages: number } | null {
  return STAT_MOVES[normalizeMoveKey(moveName)] ?? null;
}

/** ¿Puede actuar este turno? (sueño / full para). */
export function canActThisTurn(
  status: StatusCondition | null,
  sleepTurnsLeft: number,
): { canAct: boolean; reason: "asleep" | "paralyzed" | null; newSleepTurns: number } {
  if (status === "SLEEP") {
    if (sleepTurnsLeft <= 0) {
      return { canAct: true, reason: null, newSleepTurns: 0 };
    }
    return { canAct: false, reason: "asleep", newSleepTurns: sleepTurnsLeft - 1 };
  }
  if (status === "PARALYSIS" && Math.random() < 0.25) {
    return { canAct: false, reason: "paralyzed", newSleepTurns: sleepTurnsLeft };
  }
  return { canAct: true, reason: null, newSleepTurns: sleepTurnsLeft };
}

export function rollSleepTurns(): number {
  return 1 + Math.floor(Math.random() * 3); // 1–3
}

/** Daño residual de fin de turno (1/16 burn, 1/8 poison). */
export function residualDamage(
  status: StatusCondition | null,
  maxHp: number,
): number {
  if (status === "BURN") return Math.max(1, Math.floor(maxHp / 16));
  if (status === "POISON") return Math.max(1, Math.floor(maxHp / 8));
  return 0;
}

/** Bonus de captura Gen III por estado. */
export function captureStatusBonus(status: StatusCondition | null): number {
  if (status === "SLEEP") return 2;
  if (status === "PARALYSIS" || status === "POISON" || status === "BURN") return 1.5;
  return 1;
}

export function statusLabelKey(status: StatusCondition): string {
  switch (status) {
    case "BURN":
      return "statusBurn";
    case "PARALYSIS":
      return "statusParalysis";
    case "POISON":
      return "statusPoison";
    case "SLEEP":
      return "statusSleep";
  }
}
