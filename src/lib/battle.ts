import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import { accuracyStageMultiplier, type BattleStat, type StatusCondition } from "@/lib/status";

export interface CombatantStats {
  level: number;
  types: string[];
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface MoveSnapshot {
  id: number;
  name: string;
  type: string;
  category: "PHYSICAL" | "SPECIAL" | "STATUS";
  power: number | null;
  accuracy: number | null;
  priority: number;
  pp?: number;
  /** PokeAPI `move.target.name` (selected-pokemon, all-opponents, …). */
  target?: string | null;
}

export const STRUGGLE_MOVE: MoveSnapshot = {
  id: -1,
  name: "struggle",
  // Tipeless: en los juegos modernos Struggle pega a Fantasma (Normal no).
  type: "typeless",
  category: "PHYSICAL",
  power: 50,
  accuracy: null,
  priority: 0,
  pp: 1,
};

export function playerActsFirst(
  playerMove: MoveSnapshot,
  wildMove: MoveSnapshot,
  playerSpeed: number,
  wildSpeed: number,
  quickClawTriggered = false,
): boolean {
  if (playerMove.priority !== wildMove.priority) {
    return playerMove.priority > wildMove.priority;
  }
  if (quickClawTriggered) return true;
  return playerSpeed >= wildSpeed;
}

export interface MoveResult {
  hit: boolean;
  damage: number;
  effectiveness: number;
  critical: boolean;
}

export interface ResolveOptions {
  /** Quemadura reduce daño físico a la mitad. */
  attackerBurned?: boolean;
  /** Multiplicador de poder por objeto equipado (Life Orb, potenciadores de tipo). */
  powerMultiplier?: number;
  /** Si true, no tira accuracy (golpes 2..N de un multi-hit). */
  forceHit?: boolean;
  /**
   * Stats sin stages (pero con objetos). Desde Gen II el crítico ignora los
   * stages que perjudican al atacante: Atq/AtqEsp bajado y Def/DefEsp subida.
   */
  critBaselineStats?: Pick<CombatantStats, "atk" | "spAtk"> & Pick<CombatantStats, "def" | "spDef">;
  /** Nivel de crítico extra del movimiento (Slash, Stone Edge…). */
  critStage?: number;
  /** `acc` del atacante menos `eva` del defensor, ya combinados. */
  accuracyStageDelta?: number;
  /** Multiplicador adicional sobre la precisión del movimiento. */
  accuracyMultiplier?: number;
}

/** Probabilidad de crítico por nivel (Gen VI: 1/16 → 1/8 → 1/2 → siempre). */
export function critChanceForStage(stage: number): number {
  if (stage <= 0) return 1 / 16;
  if (stage === 1) return 1 / 8;
  if (stage === 2) return 1 / 2;
  return 1;
}

/**
 * Los juegos tiran uno de 16 valores discretos entre 0.85 y 1.00 (ambos
 * incluidos). `0.85 + random()*0.15` nunca llegaba a 1.00.
 */
function rollDamageVariance(): number {
  return (85 + Math.floor(Math.random() * 16)) / 100;
}

/**
 * Fórmula Gen VI con STAB, tipo, variación, crítico (1/16 → ×1.5)
 * y burn en físicos.
 */
export function resolveMoveUse(
  attacker: CombatantStats,
  defender: CombatantStats,
  move: MoveSnapshot,
  options: ResolveOptions = {},
): MoveResult {
  const accuracyStageMult = accuracyStageMultiplier(options.accuracyStageDelta ?? 0);
  const effectiveAccuracy =
    move.accuracy === null
      ? null
      : move.accuracy * accuracyStageMult * (options.accuracyMultiplier ?? 1);
  const hit = options.forceHit
    ? true
    : effectiveAccuracy === null
      ? true
      : Math.random() * 100 < effectiveAccuracy;
  if (!hit || move.category === "STATUS" || move.power === null) {
    return { hit, damage: 0, effectiveness: 1, critical: false };
  }

  const effectiveness = getTypeEffectiveness(move.type, defender.types);
  const critical = Math.random() < critChanceForStage(options.critStage ?? 0);

  const isPhysical = move.category === "PHYSICAL";
  let atkStat = isPhysical ? attacker.atk : attacker.spAtk;
  let defStat = isPhysical ? defender.def : defender.spDef;

  // El crítico descarta el stage que juega en contra del atacante, nunca el
  // que lo favorece: por eso es max() del lado ofensivo y min() del defensivo.
  const baseline = options.critBaselineStats;
  if (critical && baseline) {
    atkStat = Math.max(atkStat, isPhysical ? baseline.atk : baseline.spAtk);
    defStat = Math.min(defStat, isPhysical ? baseline.def : baseline.spDef);
  }

  if (isPhysical && options.attackerBurned) {
    atkStat = Math.max(1, Math.floor(atkStat * 0.5));
  }
  defStat = Math.max(1, defStat);

  const base = Math.floor(
    (Math.floor((2 * attacker.level) / 5 + 2) * move.power * (atkStat / defStat)) / 50 + 2,
  );

  const moveType = move.type.toLowerCase();
  const stab = attacker.types.some((t) => t.toLowerCase() === moveType) ? 1.5 : 1;
  const critMult = critical ? 1.5 : 1;
  const randomFactor = rollDamageVariance();
  const itemMult = options.powerMultiplier ?? 1;

  const damage =
    effectiveness === 0
      ? 0
      : Math.max(
          1,
          Math.floor(base * stab * effectiveness * critMult * randomFactor * itemMult),
        );
  return { hit, damage, effectiveness, critical };
}

/** Término lineal histórico: el arranque (Lv 5 vs salvajes 2–6) necesitaba empuje. */
export const XP_PER_DEFEATED_LEVEL = 15;

/**
 * XP por victoria.
 *
 * La curva de nivel es cúbica (`xpForLevel = level³`), así que el costo del
 * próximo nivel crece ~3L² mientras que un premio lineal crece ~15L: a Lv.5
 * alcanzaba con una pelea y a Lv.18 hacían falta cinco. Ese es exactamente el
 * muro reportado antes del segundo gimnasio — equipos Nv.17-18 contra zonas
 * Nv.12-14 y una medalla que pide Nv.19+.
 *
 * El término cuadrático hace que el premio siga la misma forma que el costo:
 * ~2-3 peleas por nivel de punta a punta, en vez de 1 al principio y 5+ después.
 */
export function xpForVictory(defeatedLevel: number): number {
  const level = Math.max(1, Math.floor(defeatedLevel));
  return level * (XP_PER_DEFEATED_LEVEL + level);
}

/**
 * Mitad del pozo que va al grupo Exp. Share cuando hay holders vivos
 * (FireRed / Gen III–V). La otra mitad va a los participantes vivos.
 */
export const EXP_SHARE_POOL_FRACTION = 0.5;

/**
 * Reparto de EXP estilo FireRed (Gen III):
 * - Sin Exp. Share: el total se divide en partes iguales entre participantes
 *   vivos (los debilitados no cobran).
 * - Con Exp. Share: 50% del total se divide entre participantes vivos y 50%
 *   entre holders vivos. Quien peleó y además lo lleva cobra ambas mitades.
 * - Si un grupo queda vacío (p. ej. el único participante se debilitó con
 *   Explosión), el otro grupo se lleva el pozo completo.
 * Los restos de la división entera se pierden (como en los juegos).
 */
export function distributeVictoryXpShares(params: {
  totalXp: number;
  participantIds: readonly string[];
  expShareHolderIds: readonly string[];
}): Map<string, number> {
  const participants = uniqueIds(params.participantIds);
  const holders = uniqueIds(params.expShareHolderIds);
  const shares = new Map<string, number>();
  const totalXp = Math.max(0, Math.floor(params.totalXp));
  if (totalXp <= 0) return shares;

  const hasP = participants.length > 0;
  const hasH = holders.length > 0;
  if (!hasP && !hasH) return shares;

  let participantPool: number;
  let holderPool: number;
  if (hasP && hasH) {
    participantPool = Math.floor(totalXp * EXP_SHARE_POOL_FRACTION);
    holderPool = totalXp - participantPool;
  } else if (hasP) {
    participantPool = totalXp;
    holderPool = 0;
  } else {
    participantPool = 0;
    holderPool = totalXp;
  }

  const add = (id: string, amount: number) => {
    if (amount <= 0) return;
    shares.set(id, (shares.get(id) ?? 0) + amount);
  };

  if (hasP && participantPool > 0) {
    const each = Math.floor(participantPool / participants.length);
    for (const id of participants) add(id, each);
  }
  if (hasH && holderPool > 0) {
    const each = Math.floor(holderPool / holders.length);
    for (const id of holders) add(id, each);
  }
  return shares;
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Une IDs de participantes de batalla sin duplicados (orden de primera aparición). */
export function mergeBattleParticipantIds(
  ...idLists: (readonly (string | null | undefined)[] | string | null | undefined)[]
): string[] {
  const out: string[] = [];
  for (const list of idLists) {
    const ids = typeof list === "string" ? [list] : (list ?? []);
    for (const id of ids) {
      if (!id) continue;
      out.push(id);
    }
  }
  return uniqueIds(out);
}

export type SkipReason = "asleep" | "paralyzed" | "frozen" | "disobey" | "flinch";

export interface TurnEvent {
  side: "player" | "wild";
  /** En dobles: calle del atacante. Singles = omitido / A. */
  fieldSlot?: "A" | "B";
  /** En dobles: calle del defensor / objetivo del golpe (puede diferir si hay redirect). */
  targetFieldSlot?: "A" | "B";
  /** En dobles: bando del defensor (puede ser aliado en Earthquake / Surf). */
  targetSide?: "player" | "wild";
  moveName: string;
  moveType: string;
  /** Categoría del movimiento — el cliente elige proyectil vs contacto. */
  category?: "PHYSICAL" | "SPECIAL" | "STATUS";
  hit: boolean;
  isStatus: boolean;
  damage: number;
  effectiveness: number;
  hpAfter: number;
  critical?: boolean;
  /** Golpes que conectaron en un multi-hit (Double Slap, Pin Missile…). */
  hitCount?: number;
  /** Daño de cada golpe, en orden — el cliente anima uno por uno. */
  hitDamages?: number[];
  skipped?: SkipReason | null;
  /** Despertó / se descongeló justo antes de actuar. */
  statusNote?: "woke" | "thawed" | null;
  statusApplied?: StatusCondition | null;
  /** Estado del atacante al aplicar residual (para el mensaje del log). */
  residualStatus?: StatusCondition | null;
  statChange?: { stat: BattleStat; stages: number } | null;
  /** Fase de un movimiento de 2 turnos (Fly, Dig, Solar Beam…). */
  chargePhase?: "start" | "finish" | null;
  /** Semi-invulnerabilidad activa tras el turno de carga (vanish). */
  semiInvuln?: "air" | "underground" | "underwater" | null;
  /** Boost propio: carga (Skull Bash) o movimiento de auto-buff (Swords Dance). */
  selfStatChange?: { stat: BattleStat; stages: number } | null;
  /** Varios boosts propios en un mismo uso (Calm Mind, Dragon Dance…). */
  selfStatChanges?: { stat: BattleStat; stages: number }[];
  /** HP que el atacante recuperó (curación directa o drenaje). */
  healAmount?: number;
  /** HP del atacante tras curarse — el cliente lo aplica sin recalcular. */
  healHpAfter?: number;
  /** La curación viene de drenar al rival (Giga Drain), no de Recover. */
  healFromDrain?: boolean;
  /** El movimiento se usó pero no tuvo ningún efecto. */
  noEffect?: boolean;
  /** KO fulminante (Fissure, Guillotine…). */
  ohko?: boolean;
  /** El golpe hizo retroceder al objetivo: pierde su turno. */
  causedFlinch?: boolean;
  /** Égida de Torre absorbió por completo este movimiento dañino. */
  shielded?: boolean;
  residualDamage?: number;
  residualHpAfter?: number;
  recoilDamage?: number;
  /** HP del atacante tras el retroceso — evita recalcular en el cliente. */
  recoilHpAfter?: number;
  /** PP restante del movimiento del jugador tras usarlo (si aplica). */
  playerPpAfter?: number;
  /** Objeto equipado del jugador que se activó en esta acción (Leftovers, Focus Sash, etc.). */
  itemName?: string;
  itemEffect?: "focus_sash" | "sitrus_berry" | "lum_berry" | "leftovers";
  itemAmount?: number;
  itemCuredStatus?: StatusCondition;
  /** HP real del jugador después de resolver el objeto — el cliente lo aplica directo, sin recalcular. */
  itemHpAfter?: number;
}

/**
 * PP actual de un movimiento.
 * - `null`/`undefined`: legacy sin valor → se trata como lleno (max).
 * - `0`: agotado (vacío).
 * - `> 0`: clamp al máximo.
 *
 * Nota: el default de Prisma era 0 = “sin inicializar / lleno”. Eso chocaba con
 * gastar el último PP. Los creates siempre setean max; hay backfill SQL para
 * filas legacy en 0.
 */
export function effectivePp(currentPp: number | null | undefined, maxPp: number | null | undefined): number {
  const max = maxPp ?? 20;
  if (currentPp == null) return max;
  if (currentPp <= 0) return 0;
  return Math.min(currentPp, max);
}
