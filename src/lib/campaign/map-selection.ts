import { locationEncounterRate } from "./encounters";
import { isStageUnlocked, listLocationsForUi, type CampaignProgressRow } from "./progress";
import { locationPoint } from "./region-map";
import type { EncounterRate } from "./types";

export type MapStage = {
  id: string;
  nameKey: string;
  unlocked: boolean;
  done: boolean;
  isGym: boolean;
};

export type MapEncounter = {
  speciesId: number;
  name: string;
  spriteUrl: string;
  types: string[];
  caught: boolean;
};

export type MapLocation = {
  id: string;
  nameKey: string;
  kindKey: string;
  unlocked: boolean;
  /** Posición en % sobre el mapa de la región. */
  x: number;
  y: number;
  completedStages: number;
  totalStages: number;
  levelMin: number;
  levelMax: number;
  /** Densidad de encuentros de la zona (la más alta de sus stages). */
  encounterRate: EncounterRate;
  stages: MapStage[];
  /** Especies que spawnean en la zona (unión de sus stages). */
  spawnSpeciesIds: number[];
  /** Se completa en `loadMapLocations` — vacío si se armó sin datos de DB. */
  encounters: MapEncounter[];
};

/**
 * Zonas dibujables sobre el mapa de región, con su estado de desbloqueo.
 *
 * Lo consumen el dashboard y el lobby de batalla: los dos abren el mismo
 * selector, así que la forma de los datos vive acá y no en cada página.
 * Se descartan las locations sin punto en el arte.
 */
export function buildMapLocations(progress: CampaignProgressRow): MapLocation[] {
  return listLocationsForUi(progress).flatMap(
    ({ location, unlocked, completedStages, totalStages }) => {
      const point = locationPoint(location.id);
      if (!point) return [];
      const wildStages = location.stages.filter((s) => !s.isGymMilestone);
      const levelSource = wildStages.length > 0 ? wildStages : location.stages;
      return [
        {
          id: location.id,
          nameKey: location.nameKey,
          kindKey: `kinds.${location.kind}`,
          unlocked,
          x: point.x,
          y: point.y,
          completedStages,
          totalStages,
          levelMin: levelSource.length ? Math.min(...levelSource.map((s) => s.levelMin)) : 1,
          levelMax: levelSource.length ? Math.max(...levelSource.map((s) => s.levelMax)) : 1,
          encounterRate: locationEncounterRate(location),
          spawnSpeciesIds: [...new Set(wildStages.flatMap((s) => s.spawnSpeciesIds))],
          encounters: [],
          stages: location.stages.map((stage) => ({
            id: stage.id,
            nameKey: stage.nameKey,
            unlocked: isStageUnlocked(stage, progress),
            done: progress.completedStageIds.includes(stage.id),
            isGym: !!stage.isGymMilestone,
          })),
        },
      ];
    },
  );
}
