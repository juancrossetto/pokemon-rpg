// Estimación de daño para el menú de poderes.
//
// Reusa la parte determinista de la fórmula de `resolveMoveUse` (nivel, poder,
// atk/def, STAB, efectividad) y devuelve el rango que produce el factor random
// de 0.85–1.00. Deja afuera crítico y multiplicadores de objeto: son eventos
// puntuales y meterlos ensancharía el rango hasta volverlo inútil.
//
// Es un aviso, no la verdad: el turno lo sigue resolviendo el servidor.

import { getTypeEffectiveness } from "@/lib/type-effectiveness";

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
  type: string;
  power?: number | null;
  category?: "PHYSICAL" | "SPECIAL" | "STATUS";
}

export interface DamageForecast {
  /** Porcentaje del HP máximo del rival, 0–100 y redondeado. */
  minPct: number;
  maxPct: number;
  /** True cuando el mínimo ya alcanza para noquear. */
  guaranteedKo: boolean;
}

export function forecastDamage(
  attacker: ForecastAttacker,
  defender: ForecastDefender,
  move: ForecastMove,
  defenderCurrentHp: number,
): DamageForecast | null {
  const category = move.category ?? "PHYSICAL";
  if (category === "STATUS" || move.power == null || defender.maxHp <= 0) return null;

  let atkStat = category === "PHYSICAL" ? attacker.atk : attacker.spAtk;
  if (category === "PHYSICAL" && attacker.burned) {
    atkStat = Math.max(1, Math.floor(atkStat * 0.5));
  }
  const defStat = category === "PHYSICAL" ? defender.def : defender.spDef;
  if (defStat <= 0) return null;

  const base = Math.floor(
    (Math.floor((2 * attacker.level) / 5 + 2) * move.power * (atkStat / defStat)) / 50 + 2,
  );
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = getTypeEffectiveness(move.type, defender.types);
  const scale = base * stab * effectiveness;

  const min = Math.max(0, Math.floor(scale * MIN_RANDOM));
  const max = Math.max(0, Math.floor(scale * MAX_RANDOM));

  return {
    minPct: Math.min(100, Math.round((min / defender.maxHp) * 100)),
    maxPct: Math.min(100, Math.round((max / defender.maxHp) * 100)),
    guaranteedKo: min >= defenderCurrentHp,
  };
}
