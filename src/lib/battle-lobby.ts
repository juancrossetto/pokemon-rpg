import type { MapEncounter, MapLocation } from "@/lib/campaign/map-selection";
import type { EncounterRate } from "@/lib/campaign/types";

export type BattleLobbyTeamMember = {
  id: string;
  name: string;
  speciesName: string;
  level: number;
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
  types: string[];
  unspentPoints: number;
};

export type BattleLobbyRecent = {
  id: string;
  status: "WON" | "LOST" | "FLED" | "CAUGHT";
  speciesName: string;
  spriteUrl: string;
  level: number;
};

export type BattleLobbyData = {
  energy: number;
  energyMax: number;
  energyCost: number;
  balls: number;
  potions: number;
  unspentTotal: number;
  team: BattleLobbyTeamMember[];
  recent: BattleLobbyRecent[];
  expedition: {
    locationNameKey: string;
    stageNameKey: string;
    /** Mapa de la región — el mismo que ve el jugador en el dashboard. */
    mapSrc: string;
    regionNameKey: string;
    predictedTypes: string[];
  } | null;
  /** Zonas para el selector de mapa (mismo diálogo que en Inicio). */
  mapLocations: MapLocation[];
  farmingLocationId: string;
  farmingStageId: string;
  /** Especies que pueden aparecer en la zona actual (unión de sus stages). */
  encounters: MapEncounter[];
  encounterLevelMin: number;
  encounterLevelMax: number;
  encounterRate: EncounterRate;
  /** Cuántos del equipo están en pie — el escuadrón completo vive en /team. */
  teamReady: number;
  teamTotal: number;
};
