import { calculateMaxHp } from "@/lib/stats";

/**
 * Escalado de enemigos por bloque — no `stats * floor`.
 * Devuelve nivel efectivo y multiplicador de HP para el combate.
 */
export function scaleEnemyForFloor(input: {
  floorNumber: number;
  baseLevel: number;
  baseHp: number;
  hpMult?: number;
  difficultyId?: string;
}): { level: number; maxHp: number } {
  const block = Math.floor((input.floorNumber - 1) / 10);
  const within = ((input.floorNumber - 1) % 10) + 1;
  // Soft curve inside block; moderate boss jump handled by caller hpMult/level.
  const levelBump = block * 2 + Math.floor(within / 4);
  const expert = input.difficultyId === "expert";
  const level = input.baseLevel + levelBump + (expert ? 4 : 0);
  const mult = (input.hpMult ?? 1) * (1 + block * 0.04) * (expert ? 1.25 : 1);
  const maxHp = Math.max(1, Math.floor(calculateMaxHp(input.baseHp, level) * mult));
  return { level, maxHp };
}
