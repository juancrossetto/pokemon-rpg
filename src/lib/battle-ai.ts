import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import type { CombatantStats, MoveSnapshot } from "@/lib/battle";

/**
 * Elige el movimiento del rival: prioriza KO, luego SE, evita 0×,
 * y deja un poco de aleatoriedad para que no sea perfecto.
 */
export function pickWildMove(
  moves: MoveSnapshot[],
  attacker: CombatantStats,
  defender: CombatantStats,
  defenderHp: number,
  movePp: number[],
): MoveSnapshot {
  const usable = moves
    .map((move, i) => ({ move, pp: movePp[i] ?? move.pp ?? 5 }))
    .filter((m) => m.pp > 0);

  const pool = usable.length > 0 ? usable.map((u) => u.move) : moves;
  if (pool.length === 0) {
    return {
      id: -1,
      name: "struggle",
      type: "normal",
      category: "PHYSICAL",
      power: 50,
      accuracy: null,
      priority: 0,
      pp: 1,
    };
  }

  let best = pool[0];
  let bestScore = -Infinity;

  for (const move of pool) {
    let score = Math.random() * 8; // ruido
    if (move.category === "STATUS" || move.power == null) {
      score += 12;
      const eff = getTypeEffectiveness(move.type, defender.types);
      if (eff === 0) score -= 40;
    } else {
      const atk = move.category === "PHYSICAL" ? attacker.atk : attacker.spAtk;
      const def = move.category === "PHYSICAL" ? defender.def : defender.spDef;
      const base = Math.floor(
        (Math.floor((2 * attacker.level) / 5 + 2) * move.power * (atk / Math.max(1, def))) / 50 + 2,
      );
      const stab = attacker.types.includes(move.type) ? 1.5 : 1;
      const eff = getTypeEffectiveness(move.type, defender.types);
      const est = Math.floor(base * stab * eff);
      score += est;
      if (eff === 0) score -= 100;
      else if (eff > 1) score += 25 * eff;
      else if (eff < 1) score -= 10;
      if (est >= defenderHp) score += 80;
    }
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best;
}
