import type { ItemType } from "@/generated/prisma/client";
import type { DexRarity } from "@/lib/pokedex";
import { SPECIES_EVOLUTION_ITEM } from "@/lib/evolution-items";

/** Nombres de objetos que disparan evo por uso (Cordón, King's Rock, etc.). */
const CATALOG_EVOLUTION_ITEMS = new Set(Object.values(SPECIES_EVOLUTION_ITEM));

/**
 * Piedras (`EVOLUTION_STONE`) y objetos del catálogo de evo por ítem (Cordón
 * Unión, Metal Coat, …) aunque el schema los marque como HELD.
 */
export function isInventoryEvolutionItem(item: {
  type: string;
  name: string;
}): boolean {
  return (
    item.type === "EVOLUTION_STONE" || CATALOG_EVOLUTION_ITEMS.has(item.name)
  );
}

// Categorías del inventario. Los primeros seis son exactamente los `ItemType`
// del schema. `FRAGMENT` es extra: los fragmentos viven en `SpeciesFragment`,
// no en `InventoryItem`, y se listan acá para que se vean en la mochila.
export const INVENTORY_CATEGORIES = [
  "POTION",
  "POKEBALL",
  "BERRY",
  "EVOLUTION_STONE",
  "MACHINE",
  "HELD",
] as const satisfies readonly ItemType[];

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

/**
 * Pestañas de la mochila. `FRAGMENT` no es un `ItemType` del schema: los
 * fragmentos viven en `SpeciesFragment`, pero se listan acá para que se
 * vean juntos con el resto del botín.
 */
export const BAG_CATEGORIES = [...INVENTORY_CATEGORIES, "FRAGMENT"] as const;

export type BagCategory = (typeof BAG_CATEGORIES)[number];

/** "all" es una vista, no un tipo del schema. */
export type CategoryFilter = BagCategory | "all";

// OJO: tienen que ser ligaduras que existan en Material Symbols. Si el nombre
// no resuelve, la fuente dibuja el texto crudo ("CATCHING_POKEMON") en vez del
// glifo. `catching_pokemon` no resuelve acá — por eso Poké Balls usa
// `sports_baseball`, el mismo que ya usaba el mercado.
export const CATEGORY_ICON: Record<BagCategory, string> = {
  POTION: "healing",
  POKEBALL: "sports_baseball",
  BERRY: "nutrition",
  EVOLUTION_STONE: "diamond",
  MACHINE: "smart_display",
  HELD: "auto_awesome",
  FRAGMENT: "extension",
};

export function isFragmentEntry(entry: { type: string }): boolean {
  return entry.type === "FRAGMENT";
}

/**
 * Un Pokémon del equipo frente a un held (p. ej. Exp. Share).
 */
export type EquipTarget = {
  instanceId: string;
  name: string;
  spriteUrl: string;
  level: number;
  /** Ya tiene este mismo ítem puesto. */
  alreadyEquipped: boolean;
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

/**
 * Un Pokémon del equipo frente a una piedra / Cordón / ítem de evo.
 * La lista es el equipo completo: los que no pueden usarlo quedan bloqueados.
 */
export type EvolveTarget = {
  instanceId: string;
  name: string;
  spriteUrl: string;
  level: number;
  /** La especie evoluciona con este ítem. */
  speciesMatches: boolean;
  /** Especie + nivel OK → accionable. */
  canEvolve: boolean;
  /** Niveles que faltan (0 si no aplica o ya alcanza). */
  levelsShort: number;
  /** Destino de la evo; null si la especie no usa este ítem. */
  toSpeciesId: number | null;
  toName: string | null;
  toSpriteUrl: string | null;
};

export type InventoryEntry = {
  itemId: string;
  /** Nombre canónico del seed (sprites / acciones). */
  name: string;
  /** Etiqueta localizada para UI. */
  displayName: string;
  type: BagCategory;
  quantity: number;
  effectText: string | null;
  buyPrice: number;
  /** FRAGMENT: especie del cristal. */
  speciesId?: number;
  /** FRAGMENT: rareza de Pokédex para pintar el cristal. */
  dexRarity?: DexRarity;
  /** FRAGMENT: cuántos hacen falta para armar. */
  fragmentNeed?: number;
  /** Sólo MACHINE: el movimiento que enseña. */
  moveName: string | null;
  /** Sólo MACHINE: stats del movimiento. */
  moveType: string | null;
  moveCategory: "PHYSICAL" | "SPECIAL" | "STATUS" | null;
  movePower: number | null;
  moveAccuracy: number | null;
  movePp: number | null;
  /** Sólo MACHINE: el equipo actual, con su estado frente a esta MT. */
  learners: TmLearner[];
  /**
   * Piedras / Cordón / ítems de evo: el equipo completo con compatibilidad.
   * Vacío si el objeto no se “usa” para evolucionar.
   */
  evolveTargets: EvolveTarget[];
  /** HELD: equipo para elegir a quién equipárselo. */
  equipTargets: EquipTarget[];
  /** Dónde conseguirlo, ya localizado (mapa / tienda / eventos…). */
  sources: string[];
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
      (q === "" ||
        e.name.toLowerCase().includes(q) ||
        e.displayName.toLowerCase().includes(q)),
  );
}

export function countsByCategory(
  entries: InventoryEntry[],
): Record<BagCategory, number> {
  const counts = Object.fromEntries(
    BAG_CATEGORIES.map((c) => [c, 0]),
  ) as Record<BagCategory, number>;
  for (const entry of entries) counts[entry.type] += entry.quantity;
  return counts;
}
