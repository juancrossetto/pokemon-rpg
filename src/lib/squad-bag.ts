/** Ítems de curación fuera de combate (mismo orden que healPokemonWithPotion). */
export const HEAL_BERRIES = ["Oran Berry", "Sitrus Berry"] as const;

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
};

export const EMPTY_SQUAD_BAG: SquadBagCounts = {
  heal: 0,
  healItemName: "Potion",
  leppa: 0,
  ppItemName: "Ether",
  rareCandy: 0,
};
