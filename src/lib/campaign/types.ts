/** Generaciones en orden. Solo Kanto tiene locations cargadas — ver `regions.ts`. */
export type CampaignRegionId = "kanto" | "johto" | "hoenn" | "sinnoh";

export type CampaignLocationKind =
  | "town"
  | "route"
  | "dungeon"
  | "forest"
  | "gym";

/** Qué tan seguido aparecen salvajes en una zona. */
export type EncounterRate = "low" | "medium" | "high";

export type CampaignSector = {
  id: string;
  nameKey: string;
  order: number;
};

export type CampaignStage = {
  id: string;
  locationId: string;
  sectorId?: string;
  order: number;
  nameKey: string;
  spawnSpeciesIds: number[];
  levelMin: number;
  levelMax: number;
  energyCost?: number;
  /** Pisa la densidad por defecto del tipo de ubicación — ver `encounters.ts`. */
  encounterRate?: EncounterRate;
  /** Al completar este stage, desbloquea esta location (si aún no lo está). */
  unlocksLocationId?: string;
  /** Milestone de gimnasio: el clear real es la medalla (gym.order). */
  isGymMilestone?: boolean;
  gymOrder?: number;
};

export type CampaignLocation = {
  id: string;
  regionId: CampaignRegionId;
  order: number;
  nameKey: string;
  kind: CampaignLocationKind;
  mapKey: string;
  sectors?: CampaignSector[];
  stages: CampaignStage[];
  /** Si true, desbloquear requiere medalla del gymOrder (además del spine). */
  requiresGymOrder?: number;
};

export type CampaignRegion = {
  id: CampaignRegionId;
  nameKey: string;
  locations: CampaignLocation[];
};

export type CampaignMilestone =
  | {
      kind: "stage";
      id: string;
      locationId: string;
      stageId: string;
      nameKey: string;
    }
  | {
      kind: "gym";
      id: string;
      locationId: string;
      gymOrder: number;
      nameKey: string;
    }
  | {
      kind: "complete";
      id: "region-complete";
      nameKey: string;
    };
