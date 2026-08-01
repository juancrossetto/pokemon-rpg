import type { CampaignMilestone } from "@/lib/campaign/types";

/** Destino del CTA principal según el próximo hito del viaje. */
export function milestoneHref(milestone: CampaignMilestone): string {
  if (milestone.kind === "gym") return "/gyms";
  if (milestone.kind === "complete") return "/campaign";
  return "/battle";
}

/** Clave i18n (`campaign.*`) del CTA principal. */
export function milestoneCtaKey(
  milestone: CampaignMilestone,
): "challengeGym" | "continueExpedition" | "viewJourney" {
  if (milestone.kind === "gym") return "challengeGym";
  if (milestone.kind === "complete") return "viewJourney";
  return "continueExpedition";
}

export type FirstVisitKey =
  | "journey-onboarding"
  | "coach-explore"
  | "coach-gym"
  | "coach-team-slot"
  | "hub-help-campaign"
  | "hub-help-battle"
  | "hub-help-market";

const PREFIX = "pokerpg:seen:";

export function hasSeen(key: FirstVisitKey): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return true;
  }
}

export function markSeen(key: FirstVisitKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, "1");
  } catch {
    /* private mode */
  }
}

/** Una sola vez por pestaña/sesión (p. ej. tip de slot vacío al entrar, no al depositar). */
export function hasSeenThisSession(key: FirstVisitKey): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(PREFIX + key) === "1";
  } catch {
    return true;
  }
}

export function markSeenThisSession(key: FirstVisitKey): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + key, "1");
  } catch {
    /* private mode */
  }
}

export function hasSeenUnlock(locationId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(`${PREFIX}unlock:${locationId}`) === "1";
  } catch {
    return true;
  }
}

export function markUnlockSeen(locationId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}unlock:${locationId}`, "1");
  } catch {
    /* ignore */
  }
}
