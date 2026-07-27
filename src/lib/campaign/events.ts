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
const ITEM_CHANCE = 0.08;

export function rollExplorationEvent(): ExplorationEvent {
  const roll = Math.random();
  if (roll < ALPHA_CHANCE) {
    return { kind: "alpha", levelBonus: 3 + Math.floor(Math.random() * 3) };
  }
  if (roll < ALPHA_CHANCE + ITEM_CHANCE) return { kind: "item" };
  return { kind: "none" };
}

/** Objetos que pueden aparecer explorando — solo consumibles básicos. */
export const EVENT_ITEM_NAMES = ["Poke Ball", "Potion", "Oran Berry"] as const;

export function pickEventItemName(): string {
  return EVENT_ITEM_NAMES[Math.floor(Math.random() * EVENT_ITEM_NAMES.length)];
}
