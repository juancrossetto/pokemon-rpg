import type { MapLocation } from "./map-selection";

/**
 * Capítulos del viaje.
 *
 * No hace falta ningún dato nuevo: un capítulo es el tramo de zonas que termina
 * en un gimnasio. La cadena ya está ordenada y los gimnasios ya son hitos, así
 * que agrupar por `kind === "gym"` reconstruye la estructura narrativa completa.
 *
 * Esto es lo que convierte 31 cards iguales en 8 metas con nombre y final.
 */
export type Chapter = {
  number: number;
  /** El gimnasio que lo cierra le da nombre al capítulo. */
  nameKey: string;
  zones: MapLocation[];
  gym: MapLocation | null;
  gymOrder: number | null;
  stagesDone: number;
  stagesTotal: number;
  speciesCaught: number;
  speciesTotal: number;
  /** Alguna de sus zonas está desbloqueada. */
  unlocked: boolean;
  /** Medalla del gimnasio obtenida (o, sin gimnasio, todos los stages hechos). */
  completed: boolean;
  /** Progreso del capítulo: stages salvajes + la medalla como último paso. */
  percent: number;
};

export function buildChapters(
  locations: MapLocation[],
  earnedGymOrders: number[],
  gymOrderByLocationId: Record<string, number>,
  /** Órdenes del Alto Mando: no cortan capítulo, son el tramo final entero. */
  eliteOrders: Set<number> = new Set(),
): Chapter[] {
  const earned = new Set(earnedGymOrders);
  const chapters: Chapter[] = [];
  let current: MapLocation[] = [];

  const push = (zones: MapLocation[]) => {
    if (zones.length === 0) return;
    const gym = zones.find((z) => z.kindKey === "kinds.gym") ?? null;
    // El capítulo se llama como su ciudad destino, no como el gimnasio: en la
    // lista "Ciudad Azulona" se lee mejor que ocho "Gimnasio de …" iguales.
    const last = zones[zones.length - 1];
    const lastOrder = gymOrderByLocationId[last.id];
    // El tramo final se llama por su meta ("Campeón"), no por la última ciudad.
    const destination =
      lastOrder !== undefined && eliteOrders.has(lastOrder)
        ? last
        : ([...zones].reverse().find((z) => z.kindKey === "kinds.town") ?? last);
    const gymOrder = gym ? (gymOrderByLocationId[gym.id] ?? null) : null;
    const badgeEarned = gymOrder !== null && earned.has(gymOrder);

    // El gimnasio no aporta stages: cuenta como el paso final del capítulo.
    // Sumarlo acá lo contaba dos veces (13 stages donde había 12).
    const wildZones = zones.filter((z) => z !== gym);
    const stagesDone = wildZones.reduce((sum, z) => sum + z.completedStages, 0);
    const stagesTotal = wildZones.reduce((sum, z) => sum + z.totalStages, 0);
    const encounters = zones.flatMap((z) => z.encounters);
    const uniqueSpecies = new Map(encounters.map((e) => [e.speciesId, e]));
    const speciesTotal = uniqueSpecies.size;
    const speciesCaught = [...uniqueSpecies.values()].filter((e) => e.caught).length;

    // La medalla vale como el último paso del capítulo: sin eso, terminar todos
    // los stages mostraría 100% con el gimnasio todavía pendiente.
    const steps = stagesTotal + (gym ? 1 : 0);
    const done = stagesDone + (badgeEarned ? 1 : 0);

    chapters.push({
      number: chapters.length + 1,
      nameKey: destination.nameKey,
      zones,
      gym,
      gymOrder,
      stagesDone,
      stagesTotal,
      speciesCaught,
      speciesTotal,
      unlocked: zones.some((z) => z.unlocked),
      // Terminar el capítulo es medalla + stages: ganar el gimnasio salteándose
      // zonas deja el capítulo abierto, que es justo el motivo para volver.
      completed: stagesDone >= stagesTotal && (gym ? badgeEarned : stagesTotal > 0),
      percent: steps > 0 ? Math.round((done / steps) * 100) : 0,
    });
  };

  for (const zone of locations) {
    current.push(zone);
    const order = gymOrderByLocationId[zone.id];
    // Un gimnasio cierra capítulo; el Alto Mando no, porque los cinco desafíos
    // son un solo tramo final. El `push` de después junta ese bloque entero.
    if (zone.kindKey === "kinds.gym" && order !== undefined && !eliteOrders.has(order)) {
      push(current);
      current = [];
    }
  }
  push(current);

  return chapters;
}

/** El capítulo donde está parado el jugador: el primero sin terminar. */
export function activeChapterIndex(chapters: Chapter[], farmingLocationId: string): number {
  const withFarming = chapters.findIndex((c) =>
    c.zones.some((z) => z.id === farmingLocationId),
  );
  if (withFarming >= 0) return withFarming;
  const firstOpen = chapters.findIndex((c) => c.unlocked && !c.completed);
  return firstOpen >= 0 ? firstOpen : 0;
}
