import { calculateMaxHp, UNSPENT_POINTS_PER_LEVEL, xpForLevel } from "@/lib/stats";

/**
 * Aplica XP ganada y resuelve las subidas de nivel encadenadas.
 *
 * Vivía dentro de `battle-move.ts`, que es `"use server"` y por lo tanto sólo
 * puede exportar funciones async — así que no había forma de reusarla desde
 * otro lado. La incursión reparte XP por un camino propio (el intento termina
 * sin "victoria"), y duplicar esta lógica habría dejado dos curvas de nivel
 * que se pueden desincronizar. Es pura: mismos argumentos, mismo resultado.
 */
export function applyXpGain(
  currentXp: number,
  currentLevel: number,
  currentHp: number,
  unspentPoints: number,
  baseHp: number,
  ptConstitution: number,
  xpEarned: number,
) {
  const newXpTotal = currentXp + xpEarned;
  let newLevel = currentLevel;
  let newUnspentPoints = unspentPoints;
  let newMaxHp = calculateMaxHp(baseHp, newLevel, ptConstitution);
  let newCurrentHp = currentHp;

  while (newXpTotal >= xpForLevel(newLevel + 1)) {
    newLevel += 1;
    newUnspentPoints += UNSPENT_POINTS_PER_LEVEL;
    const previousMaxHp = newMaxHp;
    newMaxHp = calculateMaxHp(baseHp, newLevel, ptConstitution);
    newCurrentHp += newMaxHp - previousMaxHp;
  }

  return {
    newXpTotal,
    newLevel,
    newUnspentPoints,
    newMaxHp,
    newCurrentHp,
    leveledUpTo: newLevel > currentLevel ? newLevel : null,
  };
}
