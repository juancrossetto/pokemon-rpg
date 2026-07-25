import type { CampaignLocation, CampaignLocationKind, CampaignStage, EncounterRate } from "./types";

/**
 * Densidad de encuentros por defecto según el tipo de ubicación.
 *
 * Un stage puede pisarla con su propio `encounterRate` (p. ej. una zona de
 * pasto alto dentro de una ciudad). Hoy es descriptivo: le dice al jugador qué
 * esperar de la zona. Si más adelante querés que afecte la mecánica, este es el
 * único lugar del que tiene que leer `start-encounter`.
 */
const DEFAULT_RATE: Record<CampaignLocationKind, EncounterRate> = {
  town: "low",
  route: "high",
  forest: "high",
  dungeon: "medium",
  gym: "low",
};

const RATE_ORDER: Record<EncounterRate, number> = { low: 0, medium: 1, high: 2 };

export function stageEncounterRate(
  stage: CampaignStage,
  location: CampaignLocation | null | undefined,
): EncounterRate {
  if (stage.encounterRate) return stage.encounterRate;
  return location ? DEFAULT_RATE[location.kind] : "medium";
}

/** La densidad de la zona: la más alta entre sus stages. */
export function locationEncounterRate(location: CampaignLocation): EncounterRate {
  const rates = location.stages.map((stage) => stageEncounterRate(stage, location));
  if (rates.length === 0) return DEFAULT_RATE[location.kind];
  return rates.reduce((best, rate) => (RATE_ORDER[rate] > RATE_ORDER[best] ? rate : best));
}
