import type {
  MapEncounter,
  MapLocation,
  MapStage,
  MapTrainer,
} from "@/lib/campaign/map-selection";
import type { EncounterRate } from "@/lib/campaign/types";

/** Objetivo de zona compacto para el lobby mobile. */
export type BattleLobbyObjective = {
  id: string;
  current: number;
  target: number;
  done: boolean;
  claimable: boolean;
  claimed: boolean;
};

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

/** Stack usable en combate salvaje (mismo criterio que la mochila in-battle). */
export type BattleLobbyLoadoutStack = {
  /** Nombre canónico del ítem (DB / sprites). */
  name: string;
  quantity: number;
  /** Balls: multiplicador de captura. Pociones: PS que cura. */
  potency: number | null;
};

export type BattleLobbyData = {
  energy: number;
  energyMax: number;
  energyCost: number;
  /** Balls con stock, mejores primero. */
  balls: BattleLobbyLoadoutStack[];
  /** Pociones con stock, más débiles primero (como en combate). */
  heals: BattleLobbyLoadoutStack[];
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
  /** Datos del Centro Pokémon: curar sin salir de la pantalla de combate. */
  heal: {
    hurtCount: number;
    cooldownMsLeft: number;
    rushCost: number;
    coins: number;
    teamMaxLevel: number;
  };
  /** Zona de farming (para cobrar objetivos desde el lobby). */
  zoneId: string | null;
  /** Tramos salvajes de la zona (sin hito de gimnasio). */
  stages: Pick<
    MapStage,
    "id" | "nameKey" | "unlocked" | "done" | "clearsCurrent" | "clearsRequired" | "isGym"
  >[];
  /** Entrenadores de la zona actual. */
  trainers: MapTrainer[];
  /** Objetivos de zona (mismo criterio que home). */
  objectives: BattleLobbyObjective[];
  /**
   * Mobile: al llegar desde home con `?play=1`, arrancar Explorar solo si
   * el equipo y la energía alcanzan.
   */
  autoPlay?: boolean;
};
