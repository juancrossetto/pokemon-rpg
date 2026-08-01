export { stageEncounterRate, locationEncounterRate } from "./encounters";

export type {
  CampaignLocation,
  CampaignLocationKind,
  CampaignMilestone,
  CampaignRegion,
  CampaignRegionId,
  CampaignSector,
  CampaignStage,
  EncounterRate,
} from "./types";

export {
  KANTO_REGION,
  DEFAULT_REGION_ID,
  DEFAULT_UNLOCKED_LOCATION_ID,
  DEFAULT_SELECTED_LOCATION_ID,
  DEFAULT_FARMING_LOCATION_ID,
  DEFAULT_FARMING_STAGE_ID,
  allKantoStages,
  getKantoLocation,
  getKantoStage,
} from "./kanto";

export {
  campaignMapPath,
  campaignMapSrc,
  campaignMapFallback,
  campaignMapHasArt,
  campaignMapArtLayout,
  campaignBannerSrc,
  campaignBannerArt,
  campaignBannerForZones,
  campaignBannerForChapter,
  type CampaignBannerArt,
} from "./maps";

export {
  type MapLocation,
  type MapStage,
  type MapEncounter,
  buildMapLocations,
} from "./map-selection";

// `map-data.ts` NO se exporta acá a propósito: usa prisma, y este barrel lo
// importan componentes cliente — arrastraría `pg` al bundle del navegador.
// Importalo directo: `@/lib/campaign/map-data`.

export {
  REGIONS,
  REGION_IDS,
  type RegionMeta,
  isCampaignRegionId,
  regionMeta,
  regionMapSrc,
  listRegions,
  listPlayableRegions,
} from "./regions";

export {
  CAMPAIGN_DEFAULTS,
  type CampaignProgressRow,
  type ExpeditionView,
  getRegion,
  locationOrderIndex,
  isLocationUnlocked,
  isStageCompleted,
  isStageUnlocked,
  journeyProgressPercent,
  nextMilestone,
  resolveSpawn,
  unlockLocationIdAfter,
  applyStageCompletion,
  applyGymBadgeUnlock,
  buildExpeditionView,
  listLocationsForUi,
  chapterWildStagesForGym,
  areChapterStagesCompleteForGym,
} from "./progress";

export { type Chapter, buildChapters, activeChapterIndex } from "./chapters";

export {
  type CampaignNodeStatus,
  type CampaignRequirementType,
  type CampaignPrimaryActionKind,
  type CampaignActionLabelKey,
  type CampaignRequirement,
  type CampaignActionState,
  type CampaignActionContext,
  getGymChallengeRequirements,
  canChallengeGym,
  getCampaignPrimaryAction,
  resolveZoneNodeStatus,
  getMissingRequirements,
  getZoneUnlockRequirements,
} from "./action-state";
