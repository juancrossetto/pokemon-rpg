const STORAGE_KEY = "tower-auto";

export const TOWER_AUTO_REST_RECOVERY_THRESHOLD = 0.65;

export type TowerAutoRestChoice = "recover" | "attune";

export type TowerAutoBlessing = {
  id: string;
  rarity: "common" | "rare" | "epic";
  effects: readonly {
    kind:
      | "max_hp_pct"
      | "speed_pct"
      | "heal_team_pct"
      | "revive_one_pct"
      | "type_damage_pct"
      | "coins_pct"
      | "shield_first_hit";
    value: number;
  }[];
};

/**
 * En descanso AUTO prioriza supervivencia. Con el equipo razonablemente sano
 * cambia la cura por una bendición para no desperdiciar el piso.
 */
export function pickTowerAutoRest(
  teamHpRatio: number,
  canAttune: boolean,
): TowerAutoRestChoice {
  if (!canAttune || teamHpRatio < TOWER_AUTO_REST_RECOVERY_THRESHOLD) {
    return "recover";
  }
  return "attune";
}

/**
 * Selección determinística de bendición. La rareza pesa, pero con poca vida
 * las opciones defensivas/curativas pasan por delante de daño y monedas.
 */
export function pickTowerAutoBlessing<T extends TowerAutoBlessing>(
  blessings: readonly T[],
  teamHpRatio: number,
): T | null {
  const rarityScore = { common: 0, rare: 24, epic: 50 } as const;
  const lowHp = teamHpRatio < TOWER_AUTO_REST_RECOVERY_THRESHOLD;

  let best: T | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const blessing of blessings) {
    let score = rarityScore[blessing.rarity];
    for (const effect of blessing.effects) {
      const effectScore =
        effect.kind === "revive_one_pct"
          ? lowHp
            ? 145
            : 72
          : effect.kind === "heal_team_pct"
            ? lowHp
              ? 130
              : 28
            : effect.kind === "shield_first_hit"
              ? 92
              : effect.kind === "max_hp_pct"
                ? 84
                : effect.kind === "speed_pct"
                  ? 65
                  : effect.kind === "type_damage_pct"
                    ? 60
                    : 42;
      score += effectScore + Math.min(20, Math.max(0, effect.value));
    }

    if (score > bestScore) {
      best = blessing;
      bestScore = score;
    }
  }

  return best;
}

let current = false;
let hydrated = false;
const listeners = new Set<() => void>();

export function getTowerAuto(): boolean {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      current = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // localStorage bloqueado: AUTO queda apagado.
    }
  }
  return current;
}

export function getServerTowerAuto(): boolean {
  return false;
}

export function setTowerAuto(on: boolean) {
  current = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // La sesión actual igual conserva la preferencia en memoria.
  }
  for (const listener of listeners) listener();
}

export function subscribeTowerAuto(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
