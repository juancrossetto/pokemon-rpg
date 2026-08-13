// Preferencia de auto-batalla: el cliente elige movimientos (y targets en
// dobles) sin tocar el menú. Persiste como la velocidad de animación.
//
// Gate de progresión: se desbloquea con ≥3 Pokémon a nivel ≥10 (equipo + PC).
// Antes de eso el toggle está apagado y no corre el loop automático.

import { getTypeEffectiveness } from "@/lib/type-effectiveness";

const STORAGE_KEY = "battle-auto";

/** Nivel mínimo por Pokémon para desbloquear AUTO. */
export const BATTLE_AUTO_UNLOCK_LEVEL = 10;
/** Cuántos Pokémon a ese nivel hacen falta. */
export const BATTLE_AUTO_UNLOCK_COUNT = 3;

export type AutoSwitchMember = {
  instanceId: string;
  level: number;
  currentHp: number;
  maxHp: number;
  types: string[];
};

function bestStabEffectiveness(attackerTypes: readonly string[], defenderTypes: string[]): number {
  if (attackerTypes.length === 0 || defenderTypes.length === 0) return 1;
  return Math.max(...attackerTypes.map((type) => getTypeEffectiveness(type, defenderTypes)));
}

/**
 * AUTO sólo cambia cuando hay una mejora táctica inequívoca: el activo no
 * tiene ventaja y un compañero sano sí puede pegar supereficaz. Así evita
 * sacrificar integrantes sin rotar ante cada diferencia mínima.
 */
export function pickAutoSwitchCandidate<T extends AutoSwitchMember>(
  party: readonly T[],
  activeInstanceId: string,
  defenderTypes: string[],
): T | null {
  const active = party.find((member) => member.instanceId === activeInstanceId);
  if (!active || active.currentHp <= 0 || defenderTypes.length === 0) return null;

  const activeEffectiveness = bestStabEffectiveness(active.types, defenderTypes);
  if (activeEffectiveness > 1) return null;

  const activeHpRatio = active.maxHp > 0 ? active.currentHp / active.maxHp : 0;
  const activeScore = activeEffectiveness * active.level * (0.65 + activeHpRatio * 0.35);

  let best: T | null = null;
  let bestScore = activeScore;
  for (const member of party) {
    if (member.instanceId === activeInstanceId || member.currentHp <= 0 || member.maxHp <= 0) {
      continue;
    }
    const hpRatio = member.currentHp / member.maxHp;
    if (hpRatio < 0.35) continue;

    const effectiveness = bestStabEffectiveness(member.types, defenderTypes);
    if (effectiveness <= 1) continue;

    const score = effectiveness * member.level * (0.65 + hpRatio * 0.35);
    if (score >= activeScore * 1.4 && score > bestScore) {
      best = member;
      bestScore = score;
    }
  }

  return best;
}

let current = false;
let hydrated = false;
const listeners = new Set<() => void>();

/**
 * ¿El jugador ya puede usar auto-batalla?
 * Cuenta cualquier `PokemonInstance` propio (equipo o PC).
 */
export function isBattleAutoUnlocked(levels: Iterable<number>): boolean {
  let n = 0;
  for (const level of levels) {
    if (level >= BATTLE_AUTO_UNLOCK_LEVEL) {
      n += 1;
      if (n >= BATTLE_AUTO_UNLOCK_COUNT) return true;
    }
  }
  return false;
}

/** Snapshot cliente — hidrata desde localStorage en la primera lectura. */
export function getBattleAuto(): boolean {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      current = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // localStorage bloqueado: seguimos en off.
    }
  }
  return current;
}

/** En el servidor no hay preferencia: siempre off (evita mismatch de hidratación). */
export function getServerBattleAuto(): boolean {
  return false;
}

export function setBattleAuto(on: boolean) {
  current = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // Sin persistencia; la sesión actual igual respeta el toggle.
  }
  for (const listener of listeners) listener();
}

export function toggleBattleAuto(): boolean {
  const next = !getBattleAuto();
  setBattleAuto(next);
  return next;
}

export function subscribeBattleAuto(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
