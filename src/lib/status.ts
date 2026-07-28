/** Condiciones de estado no volátiles + cambios de stats en batalla. */

export type StatusCondition = "BURN" | "PARALYSIS" | "POISON" | "SLEEP" | "FREEZE";
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

/** Slug de nombre PokeAPI → efecto de estado o cambio de stat (movimientos STATUS). */
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
  yawn: "SLEEP",
};

/** Efecto secundario de movimientos de daño (chance Gen III+ típica). */
const SECONDARY_STATUS: Record<string, { status: StatusCondition; chance: number }> = {
  // Freeze
  "ice-beam": { status: "FREEZE", chance: 0.1 },
  icebeam: { status: "FREEZE", chance: 0.1 },
  blizzard: { status: "FREEZE", chance: 0.1 },
  "ice-punch": { status: "FREEZE", chance: 0.1 },
  icepunch: { status: "FREEZE", chance: 0.1 },
  "powder-snow": { status: "FREEZE", chance: 0.1 },
  powdersnow: { status: "FREEZE", chance: 0.1 },
  "freeze-dry": { status: "FREEZE", chance: 0.1 },
  freezedry: { status: "FREEZE", chance: 0.1 },
  // Paralysis
  thunderbolt: { status: "PARALYSIS", chance: 0.1 },
  thunder: { status: "PARALYSIS", chance: 0.3 },
  discharge: { status: "PARALYSIS", chance: 0.3 },
  "body-slam": { status: "PARALYSIS", chance: 0.3 },
  bodyslam: { status: "PARALYSIS", chance: 0.3 },
  "thunder-punch": { status: "PARALYSIS", chance: 0.1 },
  thunderpunch: { status: "PARALYSIS", chance: 0.1 },
  "force-palm": { status: "PARALYSIS", chance: 0.3 },
  forcepalm: { status: "PARALYSIS", chance: 0.3 },
  nuzzle: { status: "PARALYSIS", chance: 1 },
  lick: { status: "PARALYSIS", chance: 0.3 },
  // Burn
  ember: { status: "BURN", chance: 0.1 },
  flamethrower: { status: "BURN", chance: 0.1 },
  "fire-blast": { status: "BURN", chance: 0.1 },
  fireblast: { status: "BURN", chance: 0.1 },
  "fire-punch": { status: "BURN", chance: 0.1 },
  firepunch: { status: "BURN", chance: 0.1 },
  "heat-wave": { status: "BURN", chance: 0.1 },
  heatwave: { status: "BURN", chance: 0.1 },
  lavaplume: { status: "BURN", chance: 0.3 },
  "lava-plume": { status: "BURN", chance: 0.3 },
  williwisp: { status: "BURN", chance: 1 },
  // Poison
  sludge: { status: "POISON", chance: 0.3 },
  "sludge-bomb": { status: "POISON", chance: 0.3 },
  sludgebomb: { status: "POISON", chance: 0.3 },
  "poison-sting": { status: "POISON", chance: 0.3 },
  poisonsting: { status: "POISON", chance: 0.3 },
  "poison-jab": { status: "POISON", chance: 0.3 },
  poisonjab: { status: "POISON", chance: 0.3 },
  "smog": { status: "POISON", chance: 0.4 },
  "gunk-shot": { status: "POISON", chance: 0.3 },
  gunkshot: { status: "POISON", chance: 0.3 },
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

export function secondaryStatusByMove(
  moveName: string,
): { status: StatusCondition; chance: number } | null {
  const entry = SECONDARY_STATUS[normalizeMoveKey(moveName)];
  if (!entry || entry.chance <= 0) return null;
  return entry;
}

export function statChangeByMove(moveName: string): { stat: BattleStat; stages: number } | null {
  return STAT_MOVES[normalizeMoveKey(moveName)] ?? null;
}

/** Tipos inmunes a cierto estado (p. ej. Hielo no se congela). */
export function isImmuneToStatus(status: StatusCondition, defenderTypes: string[]): boolean {
  const types = defenderTypes.map((t) => t.toLowerCase());
  if (status === "FREEZE" && types.includes("ice")) return true;
  if (status === "BURN" && types.includes("fire")) return true;
  if (status === "POISON" && (types.includes("poison") || types.includes("steel"))) return true;
  if (status === "PARALYSIS" && types.includes("electric")) return true; // Gen VI+
  return false;
}

/**
 * ¿Puede actuar este turno? (sueño / para / congelado).
 * Congelado: 20% de descongelarse al intentar actuar (Gen III+).
 */
export function canActThisTurn(
  status: StatusCondition | null,
  sleepTurnsLeft: number,
): { canAct: boolean; reason: "asleep" | "paralyzed" | "frozen" | null; newSleepTurns: number } {
  if (status === "SLEEP") {
    if (sleepTurnsLeft <= 0) {
      return { canAct: true, reason: null, newSleepTurns: 0 };
    }
    return { canAct: false, reason: "asleep", newSleepTurns: sleepTurnsLeft - 1 };
  }
  if (status === "FREEZE") {
    if (Math.random() < 0.2) {
      return { canAct: true, reason: null, newSleepTurns: sleepTurnsLeft };
    }
    return { canAct: false, reason: "frozen", newSleepTurns: sleepTurnsLeft };
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
export function residualDamage(status: StatusCondition | null, maxHp: number): number {
  if (status === "BURN") return Math.max(1, Math.floor(maxHp / 16));
  if (status === "POISON") return Math.max(1, Math.floor(maxHp / 8));
  return 0;
}

/** Bonus de captura Gen III por estado. */
export function captureStatusBonus(status: StatusCondition | null): number {
  if (status === "SLEEP" || status === "FREEZE") return 2;
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
    case "FREEZE":
      return "statusFreeze";
  }
}

/** Clave i18n de la abreviatura tipo juegos (ENV / PSN / CON / …). */
export function statusAbbrKey(status: StatusCondition): string {
  switch (status) {
    case "BURN":
      return "statusAbbrBurn";
    case "PARALYSIS":
      return "statusAbbrParalysis";
    case "POISON":
      return "statusAbbrPoison";
    case "SLEEP":
      return "statusAbbrSleep";
    case "FREEZE":
      return "statusAbbrFreeze";
  }
}

export function isStatusCondition(value: string | null | undefined): value is StatusCondition {
  return (
    value === "BURN" ||
    value === "PARALYSIS" ||
    value === "POISON" ||
    value === "SLEEP" ||
    value === "FREEZE"
  );
}

/** Intenta aplicar un estado; respeta inmunidades y “ya tiene estado”. */
export function tryApplyStatus(
  current: StatusCondition | null,
  next: StatusCondition,
  defenderTypes: string[],
): StatusCondition | null {
  if (current != null) return null;
  if (isImmuneToStatus(next, defenderTypes)) return null;
  return next;
}
