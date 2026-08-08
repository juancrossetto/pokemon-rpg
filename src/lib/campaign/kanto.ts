import type { CampaignLocation, CampaignRegion, CampaignStage } from "./types";

function routeStages(
  locationId: string,
  prefix: string,
  count: number,
  baseOrder: number,
  species: number[],
  levelMin: number,
  levelMax: number,
  unlocksLocationId?: string,
): CampaignStage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    locationId,
    order: baseOrder + i,
    nameKey: `stages.${prefix}_${i + 1}`,
    spawnSpeciesIds: species,
    levelMin: levelMin + Math.floor(i / 2),
    levelMax: levelMax + Math.floor(i / 2),
    unlocksLocationId: i === count - 1 ? unlocksLocationId : undefined,
  }));
}

const VIRIDIAN_FOREST_SECTORS = [
  { id: "vf-entrance", nameKey: "sectors.vf_entrance", order: 1 },
  { id: "vf-mid", nameKey: "sectors.vf_mid", order: 2 },
  { id: "vf-deep", nameKey: "sectors.vf_deep", order: 3 },
] as const;

/** ~15 stages model location (Viridian Forest). */
function viridianForestStages(baseOrder: number): CampaignStage[] {
  const entranceSpecies = [10, 11, 13, 14, 16]; // Caterpie, Metapod, Weedle, Kakuna, Pidgey
  const midSpecies = [10, 13, 16, 17, 25]; // +Pidgeotto, Pikachu
  const deepSpecies = [12, 15, 16, 17, 25]; // Butterfree, Beedrill, …

  // 2 stages por sector en vez de 5. Con 15 stages, el bosque era el 24% del
  // juego entero y todo dentro del capítulo 1: el jugador tardaba más en llegar
  // a su primera medalla que del gimnasio 2 al 8 juntos. Los sectores siguen
  // dando la sensación de profundidad sin el muro de grindeo.
  const sectors = [
    { key: "e", sectorId: "vf-entrance", species: entranceSpecies, level: 3 },
    { key: "m", sectorId: "vf-mid", species: midSpecies, level: 4 },
    { key: "d", sectorId: "vf-deep", species: deepSpecies, level: 5 },
  ];

  const stages: CampaignStage[] = [];
  let n = 0;
  for (const sector of sectors) {
    for (let i = 0; i < 2; i++) {
      const last = sector.key === "d" && i === 1;
      stages.push({
        id: `vf-${sector.key}-${i + 1}`,
        locationId: "viridian-forest",
        sectorId: sector.sectorId,
        order: baseOrder + n,
        nameKey: `stages.vf_${sector.key}_${i + 1}`,
        spawnSpeciesIds: sector.species,
        levelMin: sector.level + i,
        levelMax: sector.level + 2 + i,
        unlocksLocationId: last ? "pewter-city" : undefined,
      });
      n += 1;
    }
  }
  return stages;
}

const PALLET: CampaignLocation = {
  id: "pallet-town",
  regionId: "kanto",
  order: 0,
  nameKey: "locations.pallet_town",
  kind: "town",
  mapKey: "pallet-town",
  stages: [
    {
      id: "pallet-1",
      locationId: "pallet-town",
      order: 0,
      nameKey: "stages.pallet_1",
      spawnSpeciesIds: [16, 19], // Pidgey, Rattata
      levelMin: 2,
      levelMax: 4,
      unlocksLocationId: "route-1",
    },
  ],
};

const ROUTE_1: CampaignLocation = {
  id: "route-1",
  regionId: "kanto",
  order: 1,
  nameKey: "locations.route_1",
  kind: "route",
  mapKey: "route-1",
  stages: routeStages("route-1", "r1", 2, 1, [16, 19], 2, 4, "viridian-city"),
};

const VIRIDIAN_CITY: CampaignLocation = {
  id: "viridian-city",
  regionId: "kanto",
  order: 2,
  nameKey: "locations.viridian_city",
  kind: "town",
  mapKey: "viridian-city",
  stages: [
    {
      id: "viridian-1",
      locationId: "viridian-city",
      order: 4,
      nameKey: "stages.viridian_1",
      spawnSpeciesIds: [16, 19, 21],
      levelMin: 3,
      levelMax: 5,
      unlocksLocationId: "route-2",
    },
  ],
};

const ROUTE_2: CampaignLocation = {
  id: "route-2",
  regionId: "kanto",
  order: 3,
  nameKey: "locations.route_2",
  kind: "route",
  mapKey: "route-2",
  stages: routeStages(
    "route-2",
    "r2",
    2,
    5,
    [10, 13, 16, 19],
    3,
    5,
    "viridian-forest",
  ),
};

const VIRIDIAN_FOREST: CampaignLocation = {
  id: "viridian-forest",
  regionId: "kanto",
  order: 4,
  nameKey: "locations.viridian_forest",
  kind: "forest",
  mapKey: "viridian-forest",
  sectors: [...VIRIDIAN_FOREST_SECTORS],
  stages: viridianForestStages(8),
};

const PEWTER_CITY: CampaignLocation = {
  id: "pewter-city",
  regionId: "kanto",
  order: 5,
  nameKey: "locations.pewter_city",
  kind: "town",
  mapKey: "pewter-city",
  stages: [
    {
      id: "pewter-1",
      locationId: "pewter-city",
      order: 23,
      nameKey: "stages.pewter_1",
      spawnSpeciesIds: [16, 19, 21],
      levelMin: 5,
      levelMax: 8,
      unlocksLocationId: "pewter-gym",
    },
  ],
};

const PEWTER_GYM: CampaignLocation = {
  id: "pewter-gym",
  regionId: "kanto",
  order: 6,
  nameKey: "locations.pewter_gym",
  kind: "gym",
  mapKey: "pewter-gym",
  requiresGymOrder: 1,
  stages: [
    {
      id: "pewter-gym-milestone",
      locationId: "pewter-gym",
      order: 24,
      nameKey: "stages.pewter_gym_milestone",
      spawnSpeciesIds: [74], // Geodude flavour; real clear = badge
      levelMin: 9,
      levelMax: 11,
      isGymMilestone: true,
      gymOrder: 1,
      unlocksLocationId: "route-3",
    },
  ],
};

const ROUTE_3: CampaignLocation = {
  id: "route-3",
  regionId: "kanto",
  order: 7,
  nameKey: "locations.route_3",
  kind: "route",
  mapKey: "route-3",
  stages: routeStages("route-3", "r3", 3, 25, [21, 22, 23, 27], 8, 12, "mt-moon"),
};

const MT_MOON: CampaignLocation = {
  id: "mt-moon",
  regionId: "kanto",
  order: 8,
  nameKey: "locations.mt_moon",
  kind: "dungeon",
  mapKey: "mt-moon",
  stages: routeStages(
    "mt-moon",
    "mm",
    4,
    28,
    [35, 41, 46, 74],
    10,
    14,
    "cerulean-city",
  ),
};

const CERULEAN: CampaignLocation = {
  id: "cerulean-city",
  regionId: "kanto",
  order: 9,
  nameKey: "locations.cerulean_city",
  kind: "town",
  mapKey: "cerulean-city",
  stages: [
    {
      id: "cerulean-1",
      locationId: "cerulean-city",
      order: 32,
      nameKey: "stages.cerulean_1",
      spawnSpeciesIds: [16, 19, 43, 60],
      levelMin: 12,
      levelMax: 16,
      unlocksLocationId: "cerulean-gym",
    },
  ],
};


/** Ciudad/pueblo: un solo stage salvaje que abre lo siguiente. */
function townLocation(opts: {
  id: string;
  order: number;
  key: string;
  stageOrder: number;
  species: number[];
  levelMin: number;
  levelMax: number;
  unlocks?: string;
  kind?: CampaignLocation["kind"];
}): CampaignLocation {
  return {
    id: opts.id,
    regionId: "kanto",
    order: opts.order,
    nameKey: `locations.${opts.key}`,
    kind: opts.kind ?? "town",
    mapKey: opts.id,
    stages: [
      {
        id: `${opts.key.replace(/_/g, "-")}-1`,
        locationId: opts.id,
        order: opts.stageOrder,
        nameKey: `stages.${opts.key}_1`,
        spawnSpeciesIds: opts.species,
        levelMin: opts.levelMin,
        levelMax: opts.levelMax,
        unlocksLocationId: opts.unlocks,
      },
    ],
  };
}

/**
 * Gimnasio: el stage no se completa farmeando, se completa ganando la medalla
 * (`isGymMilestone`). Las especies son sólo sabor para el mapa.
 */
function gymLocation(opts: {
  id: string;
  order: number;
  key: string;
  gymOrder: number;
  stageOrder: number;
  species: number[];
  levelMin: number;
  levelMax: number;
  unlocks?: string;
}): CampaignLocation {
  return {
    id: opts.id,
    regionId: "kanto",
    order: opts.order,
    nameKey: `locations.${opts.key}`,
    kind: "gym",
    mapKey: opts.id,
    requiresGymOrder: opts.gymOrder,
    stages: [
      {
        id: `${opts.id}-milestone`,
        locationId: opts.id,
        order: opts.stageOrder,
        nameKey: `stages.${opts.key}_milestone`,
        spawnSpeciesIds: opts.species,
        levelMin: opts.levelMin,
        levelMax: opts.levelMax,
        isGymMilestone: true,
        gymOrder: opts.gymOrder,
        unlocksLocationId: opts.unlocks,
      },
    ],
  };
}

// ---- Medallas 2 a 8: de Ciudad Celeste al Gimnasio de Ciudad Verde ----

const CERULEAN_GYM = gymLocation({
  id: "cerulean-gym", order: 10, key: "cerulean_gym", gymOrder: 2,
  stageOrder: 33, species: [120, 118], levelMin: 16, levelMax: 19, unlocks: "route-5",
});

const ROUTE_5: CampaignLocation = {
  id: "route-5", regionId: "kanto", order: 11, nameKey: "locations.route_5",
  kind: "route", mapKey: "route-5",
  stages: routeStages("route-5", "r5", 3, 34, [16, 43, 63, 69], 13, 17, "vermilion-city"),
};

const VERMILION_CITY = townLocation({
  id: "vermilion-city", order: 12, key: "vermilion_city", stageOrder: 37,
  species: [19, 52, 72], levelMin: 15, levelMax: 19, unlocks: "vermilion-gym",
});

const VERMILION_GYM = gymLocation({
  id: "vermilion-gym", order: 13, key: "vermilion_gym", gymOrder: 3,
  stageOrder: 38, species: [100, 25], levelMin: 20, levelMax: 24, unlocks: "route-11",
});

const ROUTE_11: CampaignLocation = {
  id: "route-11", regionId: "kanto", order: 14, nameKey: "locations.route_11",
  kind: "route", mapKey: "route-11",
  stages: routeStages("route-11", "r11", 3, 39, [21, 23, 27, 96], 16, 20, "rock-tunnel"),
};

const ROCK_TUNNEL: CampaignLocation = {
  id: "rock-tunnel", regionId: "kanto", order: 15, nameKey: "locations.rock_tunnel",
  kind: "dungeon", mapKey: "rock-tunnel",
  stages: routeStages("rock-tunnel", "rt", 4, 42, [41, 66, 74, 95], 18, 22, "lavender-town"),
};

const LAVENDER_TOWN = townLocation({
  id: "lavender-town", order: 16, key: "lavender_town", stageOrder: 46,
  species: [92, 41, 19], levelMin: 20, levelMax: 24, unlocks: "route-8",
});

const ROUTE_8: CampaignLocation = {
  id: "route-8", regionId: "kanto", order: 17, nameKey: "locations.route_8",
  kind: "route", mapKey: "route-8",
  stages: routeStages("route-8", "r8", 3, 47, [37, 52, 58, 63], 21, 25, "celadon-city"),
};

const CELADON_CITY = townLocation({
  id: "celadon-city", order: 18, key: "celadon_city", stageOrder: 50,
  species: [16, 43, 96], levelMin: 22, levelMax: 26, unlocks: "celadon-gym",
});

const CELADON_GYM = gymLocation({
  id: "celadon-gym", order: 19, key: "celadon_gym", gymOrder: 4,
  stageOrder: 51, species: [114, 44], levelMin: 26, levelMax: 30, unlocks: "route-16",
});

const ROUTE_16: CampaignLocation = {
  id: "route-16", regionId: "kanto", order: 20, nameKey: "locations.route_16",
  kind: "route", mapKey: "route-16",
  stages: routeStages("route-16", "r16", 3, 52, [20, 21, 84, 88], 24, 28, "fuchsia-city"),
};

const FUCHSIA_CITY = townLocation({
  id: "fuchsia-city", order: 21, key: "fuchsia_city", stageOrder: 55,
  species: [43, 48, 69], levelMin: 26, levelMax: 30, unlocks: "fuchsia-gym",
});

const FUCHSIA_GYM = gymLocation({
  id: "fuchsia-gym", order: 22, key: "fuchsia_gym", gymOrder: 5,
  stageOrder: 56, species: [109, 89], levelMin: 30, levelMax: 34, unlocks: "route-15",
});

const ROUTE_15: CampaignLocation = {
  id: "route-15", regionId: "kanto", order: 23, nameKey: "locations.route_15",
  kind: "route", mapKey: "route-15",
  stages: routeStages("route-15", "r15", 3, 57, [44, 48, 84, 132], 28, 32, "saffron-city"),
};

const SAFFRON_CITY = townLocation({
  id: "saffron-city", order: 24, key: "saffron_city", stageOrder: 60,
  species: [63, 96, 122], levelMin: 30, levelMax: 34, unlocks: "saffron-gym",
});

const SAFFRON_GYM = gymLocation({
  id: "saffron-gym", order: 25, key: "saffron_gym", gymOrder: 6,
  stageOrder: 61, species: [64, 122], levelMin: 34, levelMax: 38, unlocks: "route-19",
});

const ROUTE_19: CampaignLocation = {
  id: "route-19", regionId: "kanto", order: 26, nameKey: "locations.route_19",
  kind: "route", mapKey: "route-19",
  stages: routeStages("route-19", "r19", 3, 62, [72, 98, 118, 129], 32, 36, "cinnabar-island"),
};

const CINNABAR_ISLAND = townLocation({
  id: "cinnabar-island", order: 27, key: "cinnabar_island", stageOrder: 65,
  species: [58, 88, 120], levelMin: 34, levelMax: 38, unlocks: "cinnabar-gym",
});

const CINNABAR_GYM = gymLocation({
  id: "cinnabar-gym", order: 28, key: "cinnabar_gym", gymOrder: 7,
  stageOrder: 66, species: [126, 78], levelMin: 38, levelMax: 42, unlocks: "route-21",
});

const ROUTE_21: CampaignLocation = {
  id: "route-21", regionId: "kanto", order: 29, nameKey: "locations.route_21",
  kind: "route", mapKey: "route-21",
  stages: routeStages("route-21", "r21", 3, 67, [72, 79, 98, 129], 36, 40, "viridian-gym"),
};

const VIRIDIAN_GYM = gymLocation({
  id: "viridian-gym", order: 30, key: "viridian_gym", gymOrder: 8,
  stageOrder: 70, species: [111, 31], levelMin: 42, levelMax: 46,
  unlocks: "victory-road",
});

// ---- Capítulo final: Calle Victoria, Alto Mando y Campeón ----

const VICTORY_ROAD: CampaignLocation = {
  id: "victory-road", regionId: "kanto", order: 31, nameKey: "locations.victory_road",
  kind: "dungeon", mapKey: "victory-road",
  stages: routeStages("victory-road", "vr", 4, 71, [42, 74, 75, 95, 105], 40, 46, "indigo-plateau"),
};

const INDIGO_PLATEAU = townLocation({
  id: "indigo-plateau", order: 32, key: "indigo_plateau", stageOrder: 75,
  species: [41, 42, 132], levelMin: 44, levelMax: 48, unlocks: "elite-lorelei",
});

const ELITE_LORELEI = gymLocation({
  id: "elite-lorelei", order: 33, key: "elite_lorelei", gymOrder: 9,
  stageOrder: 76, species: [131, 124], levelMin: 51, levelMax: 54, unlocks: "elite-bruno",
});

const ELITE_BRUNO = gymLocation({
  id: "elite-bruno", order: 34, key: "elite_bruno", gymOrder: 10,
  stageOrder: 77, species: [68, 106], levelMin: 51, levelMax: 56, unlocks: "elite-agatha",
});

const ELITE_AGATHA = gymLocation({
  id: "elite-agatha", order: 35, key: "elite_agatha", gymOrder: 11,
  stageOrder: 78, species: [94, 24], levelMin: 53, levelMax: 58, unlocks: "elite-lance",
});

const ELITE_LANCE = gymLocation({
  id: "elite-lance", order: 36, key: "elite_lance", gymOrder: 12,
  stageOrder: 79, species: [149, 142], levelMin: 54, levelMax: 60, unlocks: "champion",
});

const CHAMPION = gymLocation({
  id: "champion", order: 37, key: "champion", gymOrder: 13,
  stageOrder: 80, species: [9, 65], levelMin: 57, levelMax: 61,
});

export const KANTO_REGION: CampaignRegion = {
  id: "kanto",
  nameKey: "regions.kanto",
  locations: [
    PALLET,
    ROUTE_1,
    VIRIDIAN_CITY,
    ROUTE_2,
    VIRIDIAN_FOREST,
    PEWTER_CITY,
    PEWTER_GYM,
    ROUTE_3,
    MT_MOON,
    CERULEAN,
    CERULEAN_GYM,
    ROUTE_5,
    VERMILION_CITY,
    VERMILION_GYM,
    ROUTE_11,
    ROCK_TUNNEL,
    LAVENDER_TOWN,
    ROUTE_8,
    CELADON_CITY,
    CELADON_GYM,
    ROUTE_16,
    FUCHSIA_CITY,
    FUCHSIA_GYM,
    ROUTE_15,
    SAFFRON_CITY,
    SAFFRON_GYM,
    ROUTE_19,
    CINNABAR_ISLAND,
    CINNABAR_GYM,
    ROUTE_21,
    VIRIDIAN_GYM,
    VICTORY_ROAD,
    INDIGO_PLATEAU,
    ELITE_LORELEI,
    ELITE_BRUNO,
    ELITE_AGATHA,
    ELITE_LANCE,
    CHAMPION,
  ],
};

/**
 * Defaults de Kanto — viven en `@/lib/regions`; se reexportan acá para no
 * romper imports existentes.
 */
export {
  DEFAULT_REGION_ID,
} from "@/lib/regions";

import { REGIONS } from "@/lib/regions";

/**
 * Route 1 queda desbloqueada al inicio (Pallet tiene order menor, también
 * entra). El farming arranca en Pallet: el gate del gym 1 exige `pallet-1`.
 */
export const DEFAULT_UNLOCKED_LOCATION_ID = REGIONS.kanto.defaults.unlockedLocationId;
export const DEFAULT_SELECTED_LOCATION_ID = REGIONS.kanto.defaults.selectedLocationId;
export const DEFAULT_FARMING_LOCATION_ID = REGIONS.kanto.defaults.farmingLocationId;
export const DEFAULT_FARMING_STAGE_ID = REGIONS.kanto.defaults.farmingStageId;

/** @deprecated Prefer `allStages("kanto")` from `./content`. */
export function allKantoStages(): CampaignStage[] {
  return KANTO_REGION.locations.flatMap((l) => l.stages).sort((a, b) => a.order - b.order);
}

/** @deprecated Prefer `getLocation("kanto", id)` from `./content`. */
export function getKantoLocation(id: string): CampaignLocation | undefined {
  return KANTO_REGION.locations.find((l) => l.id === id);
}

/** @deprecated Prefer `getStage("kanto", id)` from `./content`. */
export function getKantoStage(id: string): CampaignStage | undefined {
  return allKantoStages().find((s) => s.id === id);
}
