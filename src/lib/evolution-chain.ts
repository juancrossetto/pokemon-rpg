import { prisma } from "@/lib/prisma";
import type { DexStatus } from "@/lib/pokedex";
import type { EvolutionRequirement, EvolutionStage } from "@/lib/evolution-readiness";

/*
  Los tipos y la lógica pura viven en `evolution-readiness.ts`.

  Este módulo importa `prisma`, así que **no debe importarlo ningún componente
  de cliente**: bastaba con que uno trajera un tipo desde acá para que `pg`
  entrara al bundle del browser y el build fallara con "Can't resolve 'dns'".

  Antes se reexportaban los helpers puros para no romper imports viejos, pero
  eso era justamente la trampa: importarlos desde este archivo parecía
  correcto y volvía a romper el build. Sin reexports, un cliente que apunte
  acá falla en `tsc` con un error claro en vez de al compilar.
*/

type SpeciesEvoRow = {
  id: number;
  name: string;
  spriteUrl: string;
  types: string[];
  evolveLevel: number | null;
  evolvesFromId: number | null;
  evolveTrigger: string | null;
  evolveItem: string | null;
  evolveMinLevel: number | null;
};

const EVO_SELECT = {
  id: true,
  name: true,
  spriteUrl: true,
  types: true,
  evolveLevel: true,
  evolvesFromId: true,
  evolveTrigger: true,
  evolveItem: true,
  evolveMinLevel: true,
} as const;

/** Precio de los objetos de evolución, por nombre. */
export type ItemPriceMap = Map<string, { buyPrice: number; gemPrice: number | null }>;

function requirementOf(
  row: SpeciesEvoRow,
  parent: SpeciesEvoRow | undefined,
  prices?: ItemPriceMap,
): EvolutionRequirement | null {
  if (!parent) return null;

  if (row.evolveTrigger === "use-item" && row.evolveItem) {
    // En Kanto clásico las piedras NO piden nivel; `evolveMinLevel` casi siempre
    // es null. Si algún día viene de PokeAPI, lo mostramos / exigimos.
    // El precio viaja dentro del requisito: así la pestaña EVO puede decir
    // cuánto cuesta sin que cada componente de cliente tenga que consultarlo.
    const price = prices?.get(row.evolveItem);
    return {
      kind: "item",
      itemName: row.evolveItem,
      minLevel: row.evolveMinLevel,
      buyPrice: price?.buyPrice ?? null,
      gemPrice: price?.gemPrice ?? null,
    };
  }
  if (row.evolveTrigger === "trade") return { kind: "trade" };

  // Para level-up manda el nivel del padre: es el que `level-up.ts` chequea de
  // verdad al subir de nivel. `evolveMinLevel` queda de respaldo.
  const level = parent.evolveLevel ?? row.evolveMinLevel;
  if (level != null) return { kind: "level", level };

  return row.evolveTrigger ? { kind: "other", trigger: row.evolveTrigger } : null;
}

function dexStatus(id: number, caughtIds: Set<number>, seenIds: Set<number>): DexStatus {
  if (caughtIds.has(id)) return "caught";
  if (seenIds.has(id)) return "seen";
  return "unseen";
}

/**
 * Línea de evolución que pasa por `currentId`:
 * - Ancestros hasta la raíz
 * - Descendientes por camino único
 * - Si la forma actual tiene varias `evolvesTo` (Eevee), se listan todas como siguientes
 */
export function buildEvolutionChain(
  currentId: number,
  byId: Map<number, SpeciesEvoRow>,
  childrenOf: Map<number, number[]>,
  caughtIds: Set<number>,
  seenIds: Set<number>,
  prices?: ItemPriceMap,
): EvolutionStage[] {
  if (!byId.has(currentId)) return [];

  const toRoot: number[] = [];
  const visited = new Set<number>();
  let cursor: number | null = currentId;
  while (cursor != null && !visited.has(cursor)) {
    visited.add(cursor);
    toRoot.push(cursor);
    cursor = byId.get(cursor)?.evolvesFromId ?? null;
  }
  toRoot.reverse();

  const afterCurrent: number[] = [];
  let walk = currentId;
  for (;;) {
    const kids = childrenOf.get(walk) ?? [];
    if (kids.length === 1) {
      afterCurrent.push(kids[0]);
      walk = kids[0];
      continue;
    }
    if (kids.length > 1 && walk === currentId) {
      afterCurrent.push(...kids);
    }
    break;
  }

  const orderedIds = [...toRoot, ...afterCurrent];
  const currentIndex = orderedIds.indexOf(currentId);
  const immediateNext = new Set(childrenOf.get(currentId) ?? []);

  return orderedIds.map((id, index) => {
    const row = byId.get(id)!;
    const parentId = row.evolvesFromId;
    const parent = parentId != null ? byId.get(parentId) : undefined;
    let status = dexStatus(id, caughtIds, seenIds);
    // Ya pasó por esta forma (evolución previa): nunca silueta, solo opaco.
    if (index < currentIndex && status === "unseen") {
      status = "seen";
    }
    return {
      speciesId: id,
      name: row.name,
      spriteUrl: row.spriteUrl,
      types: row.types,
      evolveFromLevel: parent?.evolveLevel ?? null,
      requirement: requirementOf(row, parent, prices),
      status,
      isCurrent: id === currentId,
      isNextOption: immediateNext.has(id),
    };
  });
}

/** Piedras / objetos de evolución que el jugador tiene en la mochila (qty > 0). */
export async function loadOwnedEvolutionItems(userId: string): Promise<Set<string>> {
  const rows = await prisma.inventoryItem.findMany({
    where: {
      userId,
      quantity: { gt: 0 },
      OR: [
        { item: { type: "EVOLUTION_STONE" } },
        { item: { gemPrice: { gt: 0 } } },
      ],
    },
    select: { item: { select: { name: true } } },
  });
  return new Set(rows.map((r) => r.item.name));
}

/** Carga cadenas para las especies del equipo + estado Pokédex del usuario. */
export async function loadEvolutionChainsForTeam(
  userId: string,
  teamSpeciesIds: number[],
): Promise<Map<number, EvolutionStage[]>> {
  const unique = [...new Set(teamSpeciesIds)];
  if (unique.length === 0) return new Map();

  const [species, owned, seenRows, evoItems] = await Promise.all([
    prisma.species.findMany({ select: EVO_SELECT }),
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId },
      select: { speciesId: true },
      distinct: ["speciesId"],
    }),
    prisma.pokedexEntry.findMany({
      where: { userId },
      select: { speciesId: true },
    }),
    // Precios de los objetos de evolución, en una sola consulta para toda la
    // pantalla: la pestaña EVO muestra cuánto cuesta cada uno.
    prisma.item.findMany({
      where: {
        OR: [{ type: "EVOLUTION_STONE" }, { gemPrice: { gt: 0 } }],
      },
      select: { name: true, buyPrice: true, gemPrice: true },
    }),
  ]);

  const prices: ItemPriceMap = new Map(
    evoItems.map((i) => [i.name, { buyPrice: i.buyPrice, gemPrice: i.gemPrice }]),
  );

  const caughtIds = new Set(owned.map((o) => o.speciesId));
  const seenIds = new Set(seenRows.map((s) => s.speciesId));
  for (const id of caughtIds) seenIds.add(id);

  const byId = new Map(species.map((s) => [s.id, s]));
  const childrenOf = new Map<number, number[]>();
  for (const s of species) {
    if (s.evolvesFromId == null) continue;
    const list = childrenOf.get(s.evolvesFromId) ?? [];
    list.push(s.id);
    childrenOf.set(s.evolvesFromId, list);
  }

  const result = new Map<number, EvolutionStage[]>();
  for (const id of unique) {
    result.set(id, buildEvolutionChain(id, byId, childrenOf, caughtIds, seenIds, prices));
  }
  return result;
}
