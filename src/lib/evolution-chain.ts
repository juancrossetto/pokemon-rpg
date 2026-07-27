import { prisma } from "@/lib/prisma";
import type { DexStatus } from "@/lib/pokedex";

/**
 * Cómo se llega a esta forma desde la anterior. Se arma con los campos del
 * hijo, no del padre: Eevee tiene tres evoluciones con una piedra distinta
 * cada una y `evolveLevel`, que vive en el padre, no puede distinguirlas.
 */
export type EvolutionRequirement =
  | { kind: "level"; level: number }
  | { kind: "item"; itemName: string }
  | { kind: "trade" }
  | { kind: "other"; trigger: string };

export type EvolutionStage = {
  speciesId: number;
  name: string;
  spriteUrl: string;
  types: string[];
  /** Nivel en la forma previa para llegar a esta (null si es raíz o evo no-level). */
  evolveFromLevel: number | null;
  /** Requisito para llegar a esta forma. Null en la raíz de la cadena. */
  requirement: EvolutionRequirement | null;
  status: DexStatus;
  isCurrent: boolean;
};

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

function requirementOf(
  row: SpeciesEvoRow,
  parent: SpeciesEvoRow | undefined,
): EvolutionRequirement | null {
  if (!parent) return null;

  if (row.evolveTrigger === "use-item" && row.evolveItem) {
    return { kind: "item", itemName: row.evolveItem };
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
      requirement: requirementOf(row, parent),
      status,
      isCurrent: id === currentId,
    };
  });
}

/** Carga cadenas para las especies del equipo + estado Pokédex del usuario. */
export async function loadEvolutionChainsForTeam(
  userId: string,
  teamSpeciesIds: number[],
): Promise<Map<number, EvolutionStage[]>> {
  const unique = [...new Set(teamSpeciesIds)];
  if (unique.length === 0) return new Map();

  const [species, owned, seenRows] = await Promise.all([
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
  ]);

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
    result.set(id, buildEvolutionChain(id, byId, childrenOf, caughtIds, seenIds));
  }
  return result;
}
