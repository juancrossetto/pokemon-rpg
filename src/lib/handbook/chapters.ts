/** Capítulos del Manual del entrenador. El copy vive en `messages.*.json` → `handbook`. */

export const HANDBOOK_CHAPTERS = ["journey", "battle", "pvp", "economy"] as const;

export type HandbookChapterId = (typeof HANDBOOK_CHAPTERS)[number];

export type HandbookChapterMeta = {
  id: HandbookChapterId;
  /** Material Symbol. */
  icon: string;
};

export const HANDBOOK_CHAPTER_META: readonly HandbookChapterMeta[] = [
  { id: "journey", icon: "explore" },
  { id: "battle", icon: "swords" },
  { id: "pvp", icon: "sports_mma" },
  { id: "economy", icon: "payments" },
] as const;

export function isHandbookChapter(value: string | null | undefined): value is HandbookChapterId {
  return !!value && (HANDBOOK_CHAPTERS as readonly string[]).includes(value);
}

/** Mapea una ruta de la app al capítulo más relevante del manual. */
export function chapterForPath(pathname: string): HandbookChapterId | null {
  const clean = pathname.split("?")[0] || "/";
  if (clean === "/battle" || clean.startsWith("/battle/")) {
    return "battle";
  }
  if (clean === "/campaign" || clean.startsWith("/gyms") || clean === "/team" || clean === "/park" || clean.startsWith("/park/")) {
    return "journey";
  }
  if (clean === "/pvp" || clean.startsWith("/pvp/") || clean === "/ranking") {
    return "pvp";
  }
  if (
    clean === "/market" ||
    clean === "/shop" ||
    clean === "/inventory" ||
    clean.startsWith("/events")
  ) {
    return "economy";
  }
  return null;
}
