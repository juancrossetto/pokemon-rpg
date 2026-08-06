/** Ítems de curación fuera de combate (mismo orden que healPokemonWithPotion). */
export const HEAL_BERRIES = ["Oran Berry", "Sitrus Berry"] as const;

/**
 * Revivir / Max Revivir. Fracción del HP máx. al reanimar (clásico).
 * Viven como `POTION` sin `healAmount` para no mezclarse con curas de HP.
 */
export const REVIVE_ITEMS = [
  { name: "Revive", hpFraction: 0.5 },
  { name: "Max Revive", hpFraction: 1 },
] as const;

export const REVIVE_ITEM_NAMES = REVIVE_ITEMS.map((i) => i.name);

export function isReviveItemName(name: string): boolean {
  return (REVIVE_ITEM_NAMES as readonly string[]).includes(name);
}

export function reviveHpFraction(name: string): number | null {
  const hit = REVIVE_ITEMS.find((i) => i.name === name);
  return hit ? hit.hpFraction : null;
}

/** Potas / bayas que restauran PP (click derecho → Restaurar PP). */
export const PP_RESTORE_ITEMS = [
  { name: "Leppa Berry", amount: 10, allMoves: false },
  { name: "Ether", amount: 10, allMoves: false },
  { name: "Max Ether", amount: 9999, allMoves: false },
  { name: "Elixir", amount: 10, allMoves: true },
  { name: "Max Elixir", amount: 9999, allMoves: true },
] as const;

/** Estimación de curación por ítem (para UI optimista). */
const HEAL_AMOUNT_BY_ITEM: Record<string, number> = {
  Potion: 20,
  "Super Potion": 50,
  "Hyper Potion": 200,
  "Max Potion": 9999,
  "Full Restore": 9999,
  "Oran Berry": 10,
  "Sitrus Berry": 30,
};

export function estimateHealAmount(itemName: string): number {
  return HEAL_AMOUNT_BY_ITEM[itemName] ?? 20;
}

export type SquadBagCounts = {
  /** Pociones + bayas Oran/Sitrus. */
  heal: number;
  /** Sprite del próximo ítem de curación (o Potion por defecto). */
  healItemName: string;
  /** Ether / Leppa / Elixir… */
  leppa: number;
  /** Sprite del próximo ítem de PP. */
  ppItemName: string;
  rareCandy: number;
  /** Revive + Max Revive. */
  revive: number;
  /** Sprite del próximo revive (Revive por defecto). */
  reviveItemName: string;
};

export const EMPTY_SQUAD_BAG: SquadBagCounts = {
  heal: 0,
  healItemName: "Potion",
  leppa: 0,
  ppItemName: "Ether",
  rareCandy: 0,
  revive: 0,
  reviveItemName: "Revive",
};
