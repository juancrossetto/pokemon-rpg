export const PARK_TABS = ["mine", "corner", "fishing", "wonder", "farm", "daycare", "frontier"] as const;
export type ParkTab = (typeof PARK_TABS)[number];

export const DEFAULT_PARK_TAB: ParkTab = "mine";

export function isParkTab(value: string | null | undefined): value is ParkTab {
  return PARK_TABS.some((tab) => tab === value);
}

export function parseParkTab(raw: string | null | undefined): ParkTab {
  return isParkTab(raw) ? raw : DEFAULT_PARK_TAB;
}

export function parkTabHref(tab: ParkTab): string {
  return tab === DEFAULT_PARK_TAB ? "/park" : `/park?tab=${tab}`;
}
