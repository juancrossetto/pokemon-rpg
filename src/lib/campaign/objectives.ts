import type { MapLocation } from "./map-selection";

/**
 * Objetivos de zona con recompensa.
 *
 * El dossier pedía que las recompensas se vieran importantes, no que fueran una
 * lista de texto. Completar un objetivo ahora paga, y el pago se reclama: ver el
 * botón encendido es el gancho que hace volver a una zona a medio terminar.
 *
 * Los tres objetivos salen de datos que ya calculábamos — no hay estado nuevo
 * más que el registro de qué reclamaste.
 */
export type ZoneObjectiveId = "stages" | "pokedex" | "trainers";

export const ZONE_OBJECTIVE_IDS: ZoneObjectiveId[] = ["stages", "pokedex", "trainers"];

export type ObjectiveReward = {
  coins: number;
  /** Nombres exactos de los ítems en la tabla `Item` (ver seed). */
  items: Array<{ itemName: string; quantity: number }>;
};

export type ZoneObjectiveState = {
  id: ZoneObjectiveId;
  done: boolean;
  current: number;
  target: number;
  reward: ObjectiveReward;
  claimed: boolean;
  /** Listo para reclamar: completo y sin cobrar. */
  claimable: boolean;
  /** Cierra la zona / desbloquea la siguiente. Pokédex queda opcional. */
  required: boolean;
};

/**
 * Stages + entrenadores: lo que marca la zona como hecha en el recorrido.
 * La Pokédex no entra — es un extra cobrable, no un candado.
 */
export function isZoneStoryCleared(
  zone: Pick<MapLocation, "completedStages" | "totalStages" | "trainers">,
): boolean {
  const stagesDone = zone.totalStages <= 0 || zone.completedStages >= zone.totalStages;
  return stagesDone && zone.trainers.every((t) => t.defeated);
}

/**
 * Recompensa por objetivo, escalada al nivel de la zona.
 *
 * Los objetos siguen la lógica de los juegos: completar un recorrido deja
 * balls y repone pociones antes del siguiente tramo; registrar especies paga
 * Caramelo Raro y limpiar entrenadores deja Revivir / Max Revivir. Todo sale
 * del catálogo que ya siembra `items.ts`.
 */
export function objectiveReward(
  zone: MapLocation,
  objective: ZoneObjectiveId,
): ObjectiveReward {
  const base = 40 + zone.levelMax * 12;
  const multiplier = objective === "pokedex" ? 1.6 : objective === "trainers" ? 1.2 : 1;
  const coins = Math.round(base * multiplier);
  const tier = zone.levelMax >= 40 ? 2 : zone.levelMax >= 20 ? 1 : 0;

  if (objective === "stages") {
    return {
      coins,
      items: [
        {
          itemName: ["Poke Ball", "Great Ball", "Ultra Ball"][tier],
          quantity: 5,
        },
        {
          itemName: ["Potion", "Super Potion", "Hyper Potion"][tier],
          quantity: [4, 3, 2][tier],
        },
      ],
    };
  }
  if (objective === "pokedex") {
    // El premio de completar Pokédex: sube un nivel entero.
    return {
      coins,
      items: [{ itemName: "Rare Candy", quantity: tier >= 2 ? 2 : 1 }],
    };
  }
  // Entrenadores: tras pelear a rajatabla hace falta reanimación, no sólo cura.
  return {
    coins,
    items: [
      {
        itemName: ["Revive", "Revive", "Max Revive"][tier],
        quantity: tier === 2 ? 2 : 3,
      },
    ],
  };
}

/** Estado de un objetivo. `claims` son los ids ya reclamados de esta zona. */
export function evaluateObjective(
  zone: MapLocation,
  objective: ZoneObjectiveId,
  claims: Set<string>,
): ZoneObjectiveState | null {
  let current = 0;
  let target = 0;

  if (objective === "stages") {
    current = zone.completedStages;
    target = zone.totalStages;
  } else if (objective === "pokedex") {
    const targets = zone.encounters.filter((e) => e.forObjective);
    current = targets.filter((e) => e.caught).length;
    target = targets.length;
  } else {
    current = zone.trainers.filter((t) => t.defeated).length;
    target = zone.trainers.length;
  }

  // Sin objetivo posible (una ciudad sin entrenadores, por ejemplo) no se muestra.
  if (target === 0) return null;

  const done = current >= target;
  const claimed = claims.has(objective);
  return {
    id: objective,
    done,
    current,
    target,
    reward: objectiveReward(zone, objective),
    claimed,
    claimable: done && !claimed,
    required: objective === "stages" || objective === "trainers",
  };
}

export function evaluateObjectives(
  zone: MapLocation,
  claims: Set<string>,
): ZoneObjectiveState[] {
  return ZONE_OBJECTIVE_IDS.flatMap((id) => {
    const state = evaluateObjective(zone, id, claims);
    return state ? [state] : [];
  });
}
