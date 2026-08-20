import type { CampaignLocation, CampaignRegion, CampaignStage } from "./types";

let stageOrder = 0;

function wild(id: string, order: number, kind: CampaignLocation["kind"], species: number[], levels: readonly [number, number], unlocksLocationId: string, clearsRequired = 3): CampaignLocation {
  const nameKey = `locations.${id.replaceAll("-", "_")}`;
  const stage: CampaignStage = {
    id: `${id}-1`, locationId: id, order: stageOrder++,
    // La etapa lleva el nombre real de la zona. "Tramo de Johto" repetido 33
    // veces hacía que rutas, pueblos y guaridas se sintieran intercambiables.
    nameKey, spawnSpeciesIds: species,
    levelMin: levels[0], levelMax: levels[1], clearsRequired, unlocksLocationId,
    encounterRate: kind === "town" ? "low" : kind === "route" ? "high" : "medium",
  };
  return { id, regionId: "johto", order, nameKey, kind, mapKey: id, stages: [stage] };
}

function gym(id: string, order: number, gymOrder: number, speciesId: number, level: number, unlocksLocationId?: string): CampaignLocation {
  const nameKey = `locations.${id.replaceAll("-", "_")}`;
  return {
    id, regionId: "johto", order, nameKey,
    kind: "gym", mapKey: id, requiresGymOrder: gymOrder,
    stages: [{
      id: `${id}-milestone`, locationId: id, order: stageOrder++,
      nameKey, spawnSpeciesIds: [speciesId],
      levelMin: level, levelMax: level + 2, isGymMilestone: true, gymOrder, unlocksLocationId,
    }],
  };
}

const locations: CampaignLocation[] = [
  wild("johto-new-bark", 0, "town", [161, 163, 165], [42, 45], "johto-route-29", 1),
  wild("johto-route-29", 1, "route", [161, 163, 187, 19], [43, 47], "johto-cherrygrove"),
  wild("johto-cherrygrove", 2, "town", [60, 183, 187], [44, 48], "johto-route-30", 2),
  wild("johto-route-30", 3, "route", [10, 13, 163, 165, 167], [45, 49], "johto-route-31"),
  wild("johto-route-31", 4, "route", [69, 92, 163, 167], [46, 50], "johto-violet-city"),
  wild("johto-violet-city", 5, "town", [163, 179, 187], [47, 51], "johto-sprout-tower", 2),
  wild("johto-sprout-tower", 6, "dungeon", [19, 92, 163], [48, 52], "johto-violet-gym", 4),
  gym("johto-violet-gym", 7, 1, 164, 52, "johto-route-32"),
  wild("johto-route-32", 8, "route", [23, 69, 179, 187, 194], [50, 54], "johto-union-cave"),
  wild("johto-union-cave", 9, "dungeon", [41, 74, 95, 194], [51, 56], "johto-azalea-town", 4),
  wild("johto-azalea-town", 10, "town", [165, 167, 190], [53, 57], "johto-slowpoke-well", 2),
  wild("johto-slowpoke-well", 11, "dungeon", [41, 79, 118], [54, 58], "johto-azalea-gym", 4),
  gym("johto-azalea-gym", 12, 2, 168, 58, "johto-ilex-forest"),
  wild("johto-ilex-forest", 13, "forest", [43, 46, 165, 167, 204], [56, 60], "johto-route-34", 4),
  wild("johto-route-34", 14, "route", [63, 96, 132, 209], [57, 61], "johto-goldenrod-city"),
  wild("johto-goldenrod-city", 15, "town", [52, 63, 133], [58, 62], "johto-goldenrod-gym", 3),
  gym("johto-goldenrod-gym", 16, 3, 241, 62, "johto-route-35"),
  wild("johto-route-35", 17, "route", [16, 29, 32, 193], [60, 64], "johto-national-park"),
  wild("johto-national-park", 18, "forest", [123, 127, 191, 204], [61, 65], "johto-route-36", 4),
  wild("johto-route-36", 19, "route", [58, 69, 185], [62, 66], "johto-ecruteak-city"),
  wild("johto-ecruteak-city", 20, "town", [92, 163, 234], [63, 67], "johto-burned-tower", 2),
  wild("johto-burned-tower", 21, "dungeon", [19, 20, 109, 126], [64, 68], "johto-ecruteak-gym", 4),
  gym("johto-ecruteak-gym", 22, 4, 94, 68, "johto-route-38"),
  wild("johto-route-38", 23, "route", [81, 128, 164, 241], [66, 70], "johto-olivine-city"),
  wild("johto-olivine-city", 24, "town", [72, 98, 170], [67, 71], "johto-lighthouse", 2),
  wild("johto-lighthouse", 25, "dungeon", [81, 100, 179, 190], [68, 72], "johto-olivine-gym", 4),
  gym("johto-olivine-gym", 26, 5, 208, 72, "johto-route-40"),
  wild("johto-route-40", 27, "route", [72, 73, 170, 226], [70, 74], "johto-whirl-islands"),
  wild("johto-whirl-islands", 28, "dungeon", [42, 86, 116, 170], [71, 75], "johto-cianwood-city", 4),
  wild("johto-cianwood-city", 29, "town", [98, 106, 107], [72, 76], "johto-cianwood-gym", 2),
  gym("johto-cianwood-gym", 30, 6, 237, 76, "johto-route-42"),
  wild("johto-route-42", 31, "route", [21, 22, 179, 231], [74, 78], "johto-mt-mortar"),
  wild("johto-mt-mortar", 32, "dungeon", [42, 67, 75, 236], [75, 79], "johto-mahogany-town", 4),
  wild("johto-mahogany-town", 33, "town", [220, 225, 234], [76, 80], "johto-lake-of-rage", 2),
  wild("johto-lake-of-rage", 34, "route", [129, 130, 223], [77, 81], "johto-rocket-hq", 4),
  wild("johto-rocket-hq", 35, "dungeon", [20, 82, 101, 198], [78, 82], "johto-mahogany-gym", 4),
  gym("johto-mahogany-gym", 36, 7, 221, 82, "johto-ice-path"),
  wild("johto-ice-path", 37, "dungeon", [41, 124, 220, 225], [80, 84], "johto-blackthorn-city", 5),
  wild("johto-blackthorn-city", 38, "town", [147, 148, 206], [81, 85], "johto-dragons-den", 3),
  wild("johto-dragons-den", 39, "dungeon", [116, 117, 147, 148], [82, 86], "johto-blackthorn-gym", 5),
  gym("johto-blackthorn-gym", 40, 8, 230, 86),
];

export const JOHTO_REGION: CampaignRegion = { id: "johto", nameKey: "regions.johto", locations };
