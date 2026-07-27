import type { ItemType } from "@/generated/prisma/client";

// Categorías del inventario. Son EXACTAMENTE los tipos que existen en el
// schema — no se inventan pestañas ("Held Items", "Quest", "Materials") que
// hoy estarían siempre vacías y sólo enseñarían al jugador a ignorarlas.
// Cuando el schema sume un tipo, se agrega acá y el resto sigue funcionando.
export const INVENTORY_CATEGORIES = [
  "POTION",
  "POKEBALL",
  "BERRY",
  "EVOLUTION_STONE",
  "MACHINE",
  "HELD",
] as const satisfies readonly ItemType[];

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

/** "all" es una vista, no un tipo del schema. */
export type CategoryFilter = InventoryCategory | "all";

// OJO: tienen que ser ligaduras que existan en Material Symbols. Si el nombre
// no resuelve, la fuente dibuja el texto crudo ("CATCHING_POKEMON") en vez del
// glifo. `catching_pokemon` no resuelve acá — por eso Poké Balls usa
// `sports_baseball`, el mismo que ya usaba el mercado.
export const CATEGORY_ICON: Record<InventoryCategory, string> = {
  POTION: "healing",
  POKEBALL: "sports_baseball",
  BERRY: "nutrition",
  EVOLUTION_STONE: "diamond",
  MACHINE: "smart_display",
  HELD: "auto_awesome",
};

/**
 * Capacidad de la mochila. Es SOLO decorativa: no se valida en ninguna
 * transacción, así que superarla no bloquea comprar ni recibir objetos.
 * Está para dar sensación de RPG; convertirla en regla real implicaría
 * tocar mercado, entregas y recompensas.
 */
export const BACKPACK_CAPACITY = 300;

/**
 * Un Pokémon del equipo frente a una MT concreta.
 *
 * Las MT no piden nivel: el seed las graba con `learnLevel: null` y la
 * compatibilidad sale sólo de que exista la fila `SpeciesMove` con
 * `method: MACHINE`. Por eso acá no hay ningún campo de nivel — no existe el
 * dato, y mostrar uno inventado sería peor que no mostrar nada.
 */
export type TmLearner = {
  instanceId: string;
  name: string;
  spriteUrl: string;
  level: number;
  /** La especie figura en la tabla de MT para ese movimiento. */
  canLearn: boolean;
  /** Ya tiene el movimiento en alguno de sus cuatro slots. */
  alreadyKnown: boolean;
};

export type InventoryEntry = {
  itemId: string;
  name: string;
  type: InventoryCategory;
  quantity: number;
  effectText: string | null;
  buyPrice: number;
  /** Sólo MACHINE: el movimiento que enseña. */
  moveName: string | null;
  /** Sólo MACHINE: el equipo actual, con su estado frente a esta MT. */
  learners: TmLearner[];
};

export function totalUnits(entries: InventoryEntry[]): number {
  return entries.reduce((sum, e) => sum + e.quantity, 0);
}

/**
 * Filtro de la grilla: categoría + búsqueda por nombre. Vive acá y no dentro
 * del componente para poder ejercitarlo sin navegador — es la interacción
 * central de la pantalla.
 */
export function filterEntries(
  entries: InventoryEntry[],
  category: CategoryFilter,
  query: string,
): InventoryEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter(
    (e) =>
      (category === "all" || e.type === category) &&
      (q === "" || e.name.toLowerCase().includes(q)),
  );
}

export function countsByCategory(
  entries: InventoryEntry[],
): Record<InventoryCategory, number> {
  const counts = Object.fromEntries(
    INVENTORY_CATEGORIES.map((c) => [c, 0]),
  ) as Record<InventoryCategory, number>;
  for (const entry of entries) counts[entry.type] += entry.quantity;
  return counts;
}
