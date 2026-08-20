import type { MapLocation } from "@/lib/campaign/map-selection";
import type { ZoneObjectiveState } from "@/lib/campaign/objectives";

/**
 * "Lo que pide esta zona", en una frase.
 *
 * El panel de zona listaba cinco secciones de datos —objetivos, salvajes,
 * entrenadores, tramos, maestría— y dejaba que el jugador dedujera qué tenía
 * que hacer. Deducir es trabajo: la ficha ahora abre diciéndolo.
 *
 * La frase sale de los datos, no de texto escrito a mano por zona: son 38
 * zonas × 3 idiomas, y un texto fijo además mentiría apenas el jugador avanza.
 * Acá se elige el pendiente que corta el paso y se arma la clave i18n con sus
 * números, así la frase se actualiza sola con el progreso.
 *
 * Puro y sin Prisma: se testea con fixtures.
 */

export type ZoneAsk = {
  /** Clave bajo `campaign.ask.*`. */
  key: string;
  params?: Record<string, string | number>;
};

/**
 * Orden de prioridad: lo que **bloquea** antes que lo opcional.
 *
 * Entrenadores y tramos cierran la zona; la Pokédex es un extra cobrable. Si
 * se mostrara la Pokédex primero, la ficha pediría algo que no hace falta para
 * seguir — que es exactamente el malentendido que esto viene a sacar.
 */
export function zoneAsk(
  zone: Pick<
    MapLocation,
    "unlocked" | "completedStages" | "totalStages" | "trainers" | "kindKey"
  >,
  objectives: readonly ZoneObjectiveState[],
  /** Estado del gimnasio, cuando la zona lo es. */
  gym?: { won: boolean; chapterCleared: boolean },
): ZoneAsk {
  if (!zone.unlocked) return { key: "ask.locked" };

  /*
    El gimnasio tiene tres estados y hasta acá decía lo mismo en los tres: una
    medalla ya ganada convivía con "desafiá al líder cuando tu equipo esté
    listo", que se contradice con el "GANADO" que muestra el mismo panel dos
    líneas abajo.
  */
  if (zone.kindKey === "kinds.gym") {
    if (gym?.won) return { key: "ask.gymWon" };
    if (gym?.chapterCleared === false) return { key: "ask.gymChapterFirst" };
    return { key: "ask.gym" };
  }

  const trainersLeft = zone.trainers.filter((tr) => !tr.defeated);
  const stagesLeft = Math.max(0, zone.totalStages - zone.completedStages);

  // Un solo entrenador pendiente se nombra: "vencé a X" orienta más que
  // "vencé a 1 entrenador", y es el caso más común al cerrar una zona.
  if (trainersLeft.length === 1 && stagesLeft === 0) {
    return { key: "ask.oneTrainerNamed", params: { name: trainersLeft[0].nameKey } };
  }
  if (trainersLeft.length > 0 && stagesLeft === 0) {
    return { key: "ask.trainers", params: { count: trainersLeft.length } };
  }
  if (stagesLeft > 0 && trainersLeft.length > 0) {
    return {
      key: "ask.stagesAndTrainers",
      params: { stages: stagesLeft, trainers: trainersLeft.length },
    };
  }
  if (stagesLeft > 0) return { key: "ask.stages", params: { count: stagesLeft } };

  // Zona cerrada: sólo queda lo opcional, y se dice que es opcional.
  const pokedex = objectives.find((o) => o.id === "pokedex");
  if (pokedex && !pokedex.done) {
    return {
      key: "ask.pokedexOptional",
      params: { count: Math.max(0, pokedex.target - pokedex.current) },
    };
  }
  const claimable = objectives.find((o) => o.claimable);
  if (claimable) return { key: "ask.claim" };

  return { key: "ask.done" };
}

/**
 * Nombre de tramo sin el prefijo de la zona.
 *
 * Los stages se llaman "Ruta 21 (mar) · tramo 1". Repetido dentro de un panel
 * titulado RUTA 21 (MAR), o dentro de la frase "Completá Ruta 1 · tramo 3 en
 * Ruta 1", esas palabras no distinguen nada: lo único que cambia es el número.
 *
 * Un nombre sin separador (los sectores del bosque, por ejemplo) pasa entero.
 */
export function stageShortName(label: string): string {
  const parts = label.split("·");
  const tail = parts.length > 1 ? parts[parts.length - 1].trim() : label;
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}
