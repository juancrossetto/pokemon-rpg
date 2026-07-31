// Estimación de daño para el menú de poderes.
//
// Reusa la parte determinista de la fórmula de `resolveMoveUse` (nivel, poder,
// atk/def, STAB, efectividad, multi-golpe, reparto en dobles) y devuelve el
// rango que produce el factor random de 0.85–1.00. Deja afuera el crítico y el
// multiplicador del objeto equipado: el primero es puntual y ensancharía el
// rango hasta volverlo inútil; el segundo todavía no llega hasta la arena.
//
// Es un aviso, no la verdad: el turno lo sigue resolviendo el servidor.

import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import { multiHitSpec } from "@/lib/multi-hit";
import { isOhkoMove } from "@/lib/move-effects";
import { twoTurnSpec } from "@/lib/two-turn";
import { DOUBLES_SPREAD_DAMAGE_MULT } from "@/lib/move-target";

const MIN_RANDOM = 0.85;
const MAX_RANDOM = 1.0;

export interface ForecastAttacker {
  level: number;
  atk: number;
  spAtk: number;
  types: string[];
  burned: boolean;
}

export interface ForecastDefender {
  def: number;
  spDef: number;
  types: string[];
  maxHp: number;
}

export interface ForecastMove {
  /** Nombre PokeAPI: habilita multi-golpe, 2 turnos y OHKO. */
  name?: string;
  type: string;
  power?: number | null;
  category?: "PHYSICAL" | "SPECIAL" | "STATUS";
}

export interface ForecastContext {
  /** Objetivos que alcanza el golpe. 2+ aplica el reparto de dobles (×0.75). */
  targetCount?: number;
}

export interface DamageForecast {
  /** Porcentaje del HP máximo del rival, 0–100 y redondeado. */
  minPct: number;
  maxPct: number;
  /** True cuando el mínimo ya alcanza para noquear. */
  guaranteedKo: boolean;
  /** Rango de golpes de un multi-hit; el porcentaje ya es el acumulado. */
  hits?: { min: number; max: number };
  /** Pega recién al turno siguiente (Fly, Solar Beam…). */
  twoTurn?: boolean;
}

/** OHKO: el rango no aplica, sólo la probabilidad de conectar. */
export function forecastOhko(
  attackerLevel: number,
  defenderLevel: number,
): { chancePct: number } | null {
  if (attackerLevel < defenderLevel) return { chancePct: 0 };
  return { chancePct: Math.min(100, 30 + (attackerLevel - defenderLevel)) };
}

export function forecastDamage(
  attacker: ForecastAttacker,
  defender: ForecastDefender,
  move: ForecastMove,
  defenderCurrentHp: number,
  context: ForecastContext = {},
): DamageForecast | null {
  if (move.name && isOhkoMove(move.name)) return null;

  // Sin categoría no estimamos: defaultar a PHYSICAL inflaba el aviso cuando el
  // atacante tenía mucho Atq y el move era SPECIAL (p. ej. Seadra + Bubble Beam).
  const category = move.category;
  if (!category || category === "STATUS" || move.power == null || defender.maxHp <= 0) {
    return null;
  }

  let atkStat = category === "PHYSICAL" ? attacker.atk : attacker.spAtk;
  if (category === "PHYSICAL" && attacker.burned) {
    atkStat = Math.max(1, Math.floor(atkStat * 0.5));
  }
  const defStat = category === "PHYSICAL" ? defender.def : defender.spDef;
  if (defStat <= 0 || atkStat <= 0) return null;

  const base = Math.floor(
    (Math.floor((2 * attacker.level) / 5 + 2) * move.power * (atkStat / defStat)) / 50 + 2,
  );
  const moveType = move.type.toLowerCase();
  const stab = attacker.types.some((t) => t.toLowerCase() === moveType) ? 1.5 : 1;
  const effectiveness = getTypeEffectiveness(move.type, defender.types);
  const spread = (context.targetCount ?? 1) >= 2 ? DOUBLES_SPREAD_DAMAGE_MULT : 1;
  const scale = base * stab * effectiveness * spread;

  // Un multi-golpe acumula: el rango real es (minGolpes × roll bajo) a
  // (maxGolpes × roll alto). Mostrar un solo golpe subestimaba Pin Missile ×5.
  const multi = move.name ? multiHitSpec(move.name) : null;
  const minHits = multi ? (multi.kind === "fixed" ? multi.hits : multi.min) : 1;
  const maxHits = multi ? (multi.kind === "fixed" ? multi.hits : multi.max) : 1;

  const min = Math.max(0, Math.floor(scale * MIN_RANDOM)) * minHits;
  const max = Math.max(0, Math.floor(scale * MAX_RANDOM)) * maxHits;

  const twoTurn = move.name ? twoTurnSpec(move.name) != null : false;

  return {
    minPct: Math.min(100, Math.round((min / defender.maxHp) * 100)),
    maxPct: Math.min(100, Math.round((max / defender.maxHp) * 100)),
    // Un 2-turnos no puede noquear este turno, y un multi-golpe puede cortarse
    // antes: sólo se garantiza el KO con el mínimo de golpes.
    guaranteedKo: !twoTurn && min >= defenderCurrentHp,
    hits: multi ? { min: minHits, max: maxHits } : undefined,
    twoTurn: twoTurn || undefined,
  };
}
