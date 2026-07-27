import type { DexStatus } from "@/lib/pokedex";

/**
 * Tipos y lógica pura de evolución, **sin acceso a datos**.
 *
 * Vive separado de `evolution-chain.ts` por el mismo motivo que `rarity.ts`
 * vive separado de `market-hub.ts`: ese módulo importa `prisma` para sus
 * consultas, y basta con que un componente de cliente importe un tipo desde
 * ahí para que el bundle del browser arrastre `pg` y el build falle pidiendo
 * `dns`. Acá no hay nada que consultar, así que lo pueden usar las seis
 * pantallas de cliente que muestran cadenas de evolución.
 *
 * `evolution-chain.ts` reexporta todo esto, así que el código de servidor que
 * ya importaba desde allá sigue funcionando sin cambios.
 */

/**
 * Cómo se llega a esta forma desde la anterior. Se arma con los campos del
 * hijo, no del padre: Eevee tiene tres evoluciones con una piedra distinta
 * cada una y `evolveLevel`, que vive en el padre, no puede distinguirlas.
 */
export type EvolutionRequirement =
  | { kind: "level"; level: number }
  | {
      kind: "item";
      itemName: string;
      minLevel?: number | null;
      /** Precio en monedas del objeto. `null` si no se vende por monedas. */
      buyPrice?: number | null;
      /** Precio en gemas. `null` si no se vende por gemas. */
      gemPrice?: number | null;
    }
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
  /** Hijo directo de la forma actual (siguiente evo posible, no nietos). */
  isNextOption: boolean;
};

/** Estado del requisito de una evo respecto al Pokémon / mochila actuales. */
export type EvolveReadiness = {
  ready: boolean;
  /** Para ítem: si el jugador tiene la piedra. */
  ownsItem?: boolean;
  /** Niveles que faltan (solo level-up). */
  levelsShort?: number;
};

export function readinessForRequirement(
  requirement: EvolutionRequirement | null,
  currentLevel: number,
  ownedItems: ReadonlySet<string>,
): EvolveReadiness | null {
  if (!requirement) return null;
  if (requirement.kind === "level") {
    const levelsShort = Math.max(0, requirement.level - currentLevel);
    return { ready: levelsShort === 0, levelsShort };
  }
  if (requirement.kind === "item") {
    const ownsItem = ownedItems.has(requirement.itemName);
    const min = requirement.minLevel;
    const levelOk = min == null || currentLevel >= min;
    return {
      ready: ownsItem && levelOk,
      ownsItem,
      levelsShort: levelOk ? 0 : Math.max(0, (min ?? 0) - currentLevel),
    };
  }
  // Intercambio / otros: informativo, no accionable todavía.
  return { ready: false };
}

/** Próximas evoluciones posibles desde la forma actual. */
export function nextEvolveOptions(
  stages: EvolutionStage[],
  currentLevel: number,
  ownedItems: ReadonlySet<string>,
): Array<{ stage: EvolutionStage; readiness: EvolveReadiness }> {
  return stages
    .filter((s) => s.isNextOption && s.requirement)
    .map((stage) => ({
      stage,
      readiness: readinessForRequirement(stage.requirement, currentLevel, ownedItems)!,
    }));
}

export function anyEvolveReady(
  stages: EvolutionStage[],
  currentLevel: number,
  ownedItems: ReadonlySet<string>,
): boolean {
  return nextEvolveOptions(stages, currentLevel, ownedItems).some((o) => o.readiness.ready);
}
