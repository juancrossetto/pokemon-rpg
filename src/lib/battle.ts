import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import type { StatusCondition } from "@/lib/status";

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
}

/**
 * Fórmula Gen III+ con STAB, tipo, variación, crítico (1/16 → ×1.5)
 * y burn en físicos.
 */
export function resolveMoveUse(
  attacker: CombatantStats,
  defender: CombatantStats,
  move: MoveSnapshot,
  options: ResolveOptions = {},
): MoveResult {
  const hit = options.forceHit
    ? true
    : move.accuracy === null
      ? true
      : Math.random() * 100 < move.accuracy;
  if (!hit || move.category === "STATUS" || move.power === null) {
    return { hit, damage: 0, effectiveness: 1, critical: false };
  }

  let atkStat = move.category === "PHYSICAL" ? attacker.atk : attacker.spAtk;
  if (move.category === "PHYSICAL" && options.attackerBurned) {
    atkStat = Math.max(1, Math.floor(atkStat * 0.5));
  }
  const defStat = move.category === "PHYSICAL" ? defender.def : defender.spDef;

  const base = Math.floor(
    (Math.floor((2 * attacker.level) / 5 + 2) * move.power * (atkStat / defStat)) / 50 + 2,
  );

  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = getTypeEffectiveness(move.type, defender.types);
  const critical = Math.random() < 1 / 16;
  const critMult = critical ? 1.5 : 1;
  const randomFactor = 0.85 + Math.random() * 0.15;
  const itemMult = options.powerMultiplier ?? 1;

  const damage = Math.max(
    0,
    Math.floor(base * stab * effectiveness * critMult * randomFactor * itemMult),
  );
  return { hit, damage, effectiveness, critical };
}

export function xpForVictory(wildLevel: number): number {
  return wildLevel * 12;
}

/** Une IDs de participantes de batalla sin duplicados (orden de primera aparición). */
export function mergeBattleParticipantIds(
  ...idLists: (readonly (string | null | undefined)[] | string | null | undefined)[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of idLists) {
    const ids = typeof list === "string" ? [list] : (list ?? []);
    for (const id of ids) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export type SkipReason = "asleep" | "paralyzed" | "frozen" | "disobey" | "flinch";

export interface TurnEvent {
  side: "player" | "wild";
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
  statChange?: { stat: "atk" | "def" | "spe"; stages: number } | null;
  residualDamage?: number;
  residualHpAfter?: number;
  recoilDamage?: number;
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
