/**
 * Eventos de exploración.
 *
 * "Cada exploración puede disparar eventos… con probabilidades bajas. Esto hace
 * que cada exploración tenga expectativa." Esa expectativa es el punto: la
 * recompensa variable retiene mucho más que la fija, y no cuesta contenido
 * nuevo — se monta sobre el encuentro que ya ocurre.
 *
 * Probabilidades deliberadamente bajas: un evento que sale siempre deja de ser
 * un evento y pasa a ser el default.
 */
export type ExplorationEvent =
  | { kind: "none" }
  /** El salvaje aparece varios niveles por encima de la zona. */
  | { kind: "alpha"; levelBonus: number }
  /** Encontrás un objeto antes de empezar el combate. */
  | { kind: "item" };

const ALPHA_CHANCE = 0.04;
const ITEM_CHANCE = 0.12;
/** Por debajo de este levelMax de zona no salen alphas (cap. 1 más amable). */
const ALPHA_MIN_ZONE_LEVEL = 8;

export function rollExplorationEvent(opts?: {
  /** levelMax del stage actual — si es bajo, no hay alphas. */
  zoneLevelMax?: number;
  /** Override determinista para tests de balance. */
  roll?: number;
}): ExplorationEvent {
  const roll = opts?.roll ?? Math.random();
  const allowAlpha =
    opts?.zoneLevelMax == null || opts.zoneLevelMax >= ALPHA_MIN_ZONE_LEVEL;
  if (allowAlpha && roll < ALPHA_CHANCE) {
    return { kind: "alpha", levelBonus: 3 + Math.floor(Math.random() * 3) };
  }
  if (roll < ALPHA_CHANCE + ITEM_CHANCE) return { kind: "item" };
  return { kind: "none" };
}

/** Objetos que pueden aparecer explorando — consumibles básicos + Revivir. */
export const EVENT_ITEM_NAMES = [
  "Poke Ball",
  "Potion",
  "Super Potion",
  "Hyper Potion",
  "Oran Berry",
  "Revive",
] as const;

/** La mitad de los hallazgos son curaciÃ³n y escalan con la zona. */
export function pickEventItemName(opts?: {
  zoneLevelMax?: number;
  /** Override determinista para tests de balance. */
  roll?: number;
}): string {
  const level = opts?.zoneLevelMax ?? 1;
  const potion = level >= 40 ? "Hyper Potion" : level >= 20 ? "Super Potion" : "Potion";
  const pool = [potion, potion, potion, "Poke Ball", "Oran Berry", "Revive"];
  const roll = Math.min(0.999999, Math.max(0, opts?.roll ?? Math.random()));
  return pool[Math.floor(roll * pool.length)]!;
}
