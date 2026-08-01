/**
 * Claves i18n (`campaign.*`) para errores de acciones de campaña en el cliente.
 * Puras y testeables: el UI solo mapea código → toast.
 */

export type ClaimZoneError =
  | "unauthorized"
  | "invalid"
  | "not_done"
  | "already_claimed"
  | "missing_item";

export type StartTrainerError =
  | "no_lead"
  | "fainted_lead"
  | "not_found"
  | "already_beaten"
  | "in_battle"
  | "locked";

export function campaignClaimErrorKey(error: ClaimZoneError): string {
  switch (error) {
    case "not_done":
      return "rewardClaimNotDone";
    case "already_claimed":
      return "rewardClaimAlready";
    case "missing_item":
      return "rewardClaimMissingItem";
    case "unauthorized":
    case "invalid":
    default:
      return "rewardClaimFailed";
  }
}

export function campaignTrainerErrorKey(error: StartTrainerError): string {
  switch (error) {
    case "locked":
      return "trainerErrorLocked";
    case "already_beaten":
      return "trainerErrorBeaten";
    case "no_lead":
      return "trainerErrorNoLead";
    case "fainted_lead":
      return "trainerErrorFaintedLead";
    case "not_found":
      return "trainerErrorNotFound";
    case "in_battle":
      return "trainerErrorInBattle";
    default:
      return "trainerErrorFailed";
  }
}
