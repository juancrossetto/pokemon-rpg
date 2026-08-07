/**
 * Cura optimista del Active Team en home (antes del router.refresh).
 */
export const HOME_TEAM_HEALED_EVENT = "pokerpg:home-team-healed";

export function announceHomeTeamHealed(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HOME_TEAM_HEALED_EVENT));
}
