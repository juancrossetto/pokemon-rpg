import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import { STRUGGLE_MOVE, type CombatantStats, type MoveSnapshot } from "@/lib/battle";
import { drainFraction, healFraction } from "@/lib/move-effects";

export type PickMoveContext = {
  /** HP actual del que elige el movimiento. */
  attackerHp?: number;
  attackerMaxHp?: number;
  /**
   * moveIds recientes de este combatiente (el último al final).
   * Sirve para salir de bucles Absorber↔Absorber en auto.
   */
  recentMoveIds?: number[];
};

function estimateDamage(
  move: MoveSnapshot,
  attacker: CombatantStats,
  defender: CombatantStats,
): { est: number; eff: number } {
  if (move.category === "STATUS" || move.power == null) {
    return { est: 0, eff: getTypeEffectiveness(move.type, defender.types) };
  }
  const atk = move.category === "PHYSICAL" ? attacker.atk : attacker.spAtk;
  const def = move.category === "PHYSICAL" ? defender.def : defender.spDef;
  const base = Math.floor(
    (Math.floor((2 * attacker.level) / 5 + 2) * move.power * (atk / Math.max(1, def))) / 50 +
      2,
  );
  const stab = attacker.types.some((t) => t.toLowerCase() === move.type.toLowerCase())
    ? 1.5
    : 1;
  const eff = getTypeEffectiveness(move.type, defender.types);
  return { est: Math.floor(base * stab * eff), eff };
}

function hpRatio(ctx?: PickMoveContext): number | null {
  if (ctx?.attackerHp == null || ctx?.attackerMaxHp == null || ctx.attackerMaxHp <= 0) {
    return null;
  }
  return Math.max(0, Math.min(1, ctx.attackerHp / ctx.attackerMaxHp));
}

function consecutiveTailCount(ids: number[] | undefined, moveId: number): number {
  if (!ids || ids.length === 0) return 0;
  let n = 0;
  for (let i = ids.length - 1; i >= 0; i--) {
    if (ids[i] !== moveId) break;
    n += 1;
  }
  return n;
}

/**
 * Absorber / Mega Drain con STAB contra un rival del mismo tipo (p. ej. Oddish
 * vs Oddish): el daño es resistente, el drenaje cura, y el combate no avanza.
 */
function isSameTypeDrainStall(
  move: MoveSnapshot,
  attacker: CombatantStats,
  defender: CombatantStats,
  est: number,
  defenderHp: number,
): boolean {
  if (drainFraction(move.name) == null) return false;
  const moveType = move.type.toLowerCase();
  if (!attacker.types.some((t) => t.toLowerCase() === moveType)) return false;
  if (!defender.types.some((t) => t.toLowerCase() === moveType)) return false;
  const eff = getTypeEffectiveness(move.type, defender.types);
  if (eff > 0.5) return false;
  // Chip insignificante respecto al HP del rival.
  return est < Math.max(6, defenderHp * 0.1);
}

/**
 * Elige el movimiento del rival: prioriza KO, luego SE, evita 0×,
 * y deja un poco de aleatoriedad para que no sea perfecto.
 *
 * Anti-stall: penaliza drenaje/cura cuando no hace falta, evita repetir el
 * mismo Absorber en espejos de tipo, y rompe con Struggle si no hay salida.
 */
export function pickWildMove(
  moves: MoveSnapshot[],
  attacker: CombatantStats,
  defender: CombatantStats,
  defenderHp: number,
  movePp: number[],
  ctx?: PickMoveContext,
): MoveSnapshot {
  const usable = moves
    .map((move, i) => ({ move, pp: movePp[i] ?? move.pp ?? 5 }))
    .filter((m) => m.pp > 0);

  const pool = usable.length > 0 ? usable.map((u) => u.move) : moves;
  if (pool.length === 0) {
    return STRUGGLE_MOVE;
  }

  const remainingById = new Map(usable.map((u) => [u.move.id, u.pp]));
  const ratio = hpRatio(ctx);
  const hasNonDrainDamage = pool.some(
    (m) =>
      m.category !== "STATUS" &&
      m.power != null &&
      m.power > 0 &&
      drainFraction(m.name) == null,
  );

  let best = pool[0]!;
  let bestScore = -Infinity;

  for (const move of pool) {
    let score = Math.random() * 8;
    const { est, eff } = estimateDamage(move, attacker, defender);
    const drain = drainFraction(move.name);
    const heal = healFraction(move.name);
    const repeats = consecutiveTailCount(ctx?.recentMoveIds, move.id);
    const remaining = remainingById.get(move.id) ?? move.pp ?? 0;
    const maxPp = move.pp ?? remaining;
    const timesUsed = Math.max(0, maxPp - remaining);

    if (move.category === "STATUS" || move.power == null) {
      score += 8;
      if (eff === 0) score -= 40;
      // Cura a HP alto = stall.
      if (heal != null && ratio != null) {
        if (ratio >= 0.85) score -= 90;
        else if (ratio >= 0.6) score -= 40;
      } else if (hasNonDrainDamage && (ratio == null || ratio >= 0.45)) {
        // Growl/buff no debe ganar a Acid cuando podemos atacar.
        score -= 28;
      }
      // Buff/status en bucle.
      if (repeats >= 2) score -= 35 * repeats;
    } else {
      score += est;
      if (eff === 0) score -= 100;
      else if (eff > 1) score += 25 * eff;
      else if (eff < 1) score -= 10;
      if (est >= defenderHp) score += 80;

      if (drain != null) {
        // Drenaje con HP alto: mejor pegar con otra cosa si existe.
        if (ratio != null && hasNonDrainDamage) {
          if (ratio >= 0.85) score -= 70;
          else if (ratio >= 0.55) score -= 35;
        }
        if (
          hasNonDrainDamage &&
          isSameTypeDrainStall(move, attacker, defender, est, defenderHp)
        ) {
          // Hay Acid/otro golpe: Absorber en espejo grass es trampa.
          score -= 120;
        }
        // Repetir Absorber una y otra vez.
        if (repeats >= 1) score -= 25 * repeats;
        if (repeats >= 3) score -= 40;
        if (timesUsed >= 2 && isSameTypeDrainStall(move, attacker, defender, est, defenderHp)) {
          score -= 40;
        }
      } else if (repeats >= 3) {
        score -= 20;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  // Único ataque = drenaje en espejo (Oddish↔Oddish Absorber): tras 2 usos,
  // Struggle. Si no, preferir el drenaje antes que Growl en bucle.
  if (!hasNonDrainDamage) {
    const stallDrain = pool.find((m) => {
      if (m.category === "STATUS" || m.power == null) return false;
      const { est } = estimateDamage(m, attacker, defender);
      return isSameTypeDrainStall(m, attacker, defender, est, defenderHp);
    });
    if (stallDrain) {
      const streak = consecutiveTailCount(ctx?.recentMoveIds, stallDrain.id);
      const remaining = remainingById.get(stallDrain.id) ?? stallDrain.pp ?? 0;
      const maxPp = stallDrain.pp ?? remaining;
      const timesUsed = Math.max(0, maxPp - remaining);
      if (streak >= 2 || timesUsed >= 2) {
        return STRUGGLE_MOVE;
      }
      if (best.category === "STATUS" || best.power == null) {
        return stallDrain;
      }
    }
  }

  return best;
}

/**
 * Elige el moveId del jugador en auto-batalla. Respeta Choice lock y Struggle
 * (sin PP). Reusa la misma heurística del rival.
 */
export function pickAutoPlayerMoveId(
  moves: {
    moveId: number;
    name: string;
    type: string;
    category: MoveSnapshot["category"];
    power?: number | null;
    accuracy?: number | null;
    pp: number;
    target?: string | null;
  }[],
  attacker: CombatantStats,
  defender: CombatantStats,
  defenderHp: number,
  choiceLockMoveId: number | null,
  ctx?: PickMoveContext,
): number {
  if (choiceLockMoveId != null) {
    const locked = moves.find((m) => m.moveId === choiceLockMoveId);
    if (locked && locked.pp > 0) return choiceLockMoveId;
  }
  if (moves.length === 0) return 0;
  if (moves.every((m) => m.pp <= 0)) return moves[0]!.moveId;

  const snapshots: MoveSnapshot[] = moves.map((m) => ({
    id: m.moveId,
    name: m.name,
    type: m.type,
    category: m.category,
    power: m.power ?? null,
    accuracy: m.accuracy ?? null,
    priority: 0,
    pp: m.pp,
    target: m.target,
  }));
  const pps = moves.map((m) => m.pp);
  return pickWildMove(snapshots, attacker, defender, defenderHp, pps, ctx).id;
}
