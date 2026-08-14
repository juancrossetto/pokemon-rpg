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

/** AUTO reserva las pociones para una situaciÃ³n realmente comprometida. */
export const BATTLE_AUTO_POTION_HP_PERCENT = 35;

export const AUTO_STRATEGIES = ["conservative", "balanced", "aggressive"] as const;
export type AutoStrategy = (typeof AUTO_STRATEGIES)[number];

export type AutoStrategyProfile = {
  potionHpPercent: number;
  switchMinHpRatio: number;
  switchImprovement: number;
};

export const AUTO_STRATEGY_PROFILES: Record<AutoStrategy, AutoStrategyProfile> = {
  conservative: { potionHpPercent: 55, switchMinHpRatio: 0.5, switchImprovement: 1.2 },
  balanced: {
    potionHpPercent: BATTLE_AUTO_POTION_HP_PERCENT,
    switchMinHpRatio: 0.35,
    switchImprovement: 1.4,
  },
  aggressive: { potionHpPercent: 20, switchMinHpRatio: 0.25, switchImprovement: 1.65 },
};

export type AutoPotionStack = {
  itemId: string;
  quantity: number;
  healAmount: number;
  kind: "heal" | "revive";
};

/**
 * Elige una cura sin desperdiciar objetos:
 * - sÃ³lo actÃºa con 35% de PS o menos;
 * - usa la cura mÃ¡s chica que cubra los PS faltantes;
 * - si ninguna alcanza, usa la mÃ¡s potente disponible.
 *
 * Revivir queda fuera de AUTO: elegir a quiÃ©n devolver al combate es una
 * decisiÃ³n de equipo y no debe consumir un objeto caro silenciosamente.
 */
export function pickAutoPotion<T extends AutoPotionStack>(
  stacks: readonly T[],
  currentHp: number,
  maxHp: number,
  strategy: AutoStrategy = "balanced",
): T | null {
  if (maxHp <= 0 || currentHp <= 0 || currentHp >= maxHp) return null;
  if ((currentHp / maxHp) * 100 > AUTO_STRATEGY_PROFILES[strategy].potionHpPercent) return null;

  const missingHp = maxHp - currentHp;
  const usable = stacks
    .filter(
      (stack) =>
        stack.kind === "heal" &&
        stack.quantity > 0 &&
        stack.healAmount > 0,
    )
    .sort((a, b) => a.healAmount - b.healAmount);
  if (usable.length === 0) return null;

  return usable.find((stack) => stack.healAmount >= missingHp) ?? usable.at(-1) ?? null;
}

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
  strategy: AutoStrategy = "balanced",
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
    const profile = AUTO_STRATEGY_PROFILES[strategy];
    if (hpRatio < profile.switchMinHpRatio) continue;

    const effectiveness = bestStabEffectiveness(member.types, defenderTypes);
    if (effectiveness <= 1) continue;

    const score = effectiveness * member.level * (0.65 + hpRatio * 0.35);
    if (score >= activeScore * profile.switchImprovement && score > bestScore) {
      best = member;
      bestScore = score;
    }
  }

  return best;
}

export function shouldStopAutoBattle(
  currentHp: number,
  maxHp: number,
  stopHpPercent: number,
  hasPotion: boolean,
): boolean {
  if (stopHpPercent <= 0 || maxHp <= 0 || currentHp <= 0) return false;
  return !hasPotion && (currentHp / maxHp) * 100 <= stopHpPercent;
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
