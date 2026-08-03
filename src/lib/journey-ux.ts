import type { CampaignMilestone } from "@/lib/campaign/types";

/**
 * Destino del CTA principal según el próximo hito del viaje.
 *
 * Los gimnasios van al hub `/gyms`, que es el mapa de misión y da contexto.
 * La excepción son los nodos del Alto Mando: `computeGymStatuses` los filtra,
 * así que el hub no los muestra y el jugador con las 8 medallas quedaba
 * mirando una pantalla completa sin saber que faltaba un paso. Para esos casos
 * quien llama pasa `gymHref` con la ruta directa al gimnasio.
 */
export function milestoneHref(
  milestone: CampaignMilestone,
  opts?: { gymHref?: string | null },
): string {
  if (milestone.kind === "gym") return opts?.gymHref ?? "/gyms";
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
  | "starter-resources"
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
