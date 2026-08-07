/**
 * Nombres y descripciones de movimientos por locale (en/es/pt).
 * Generado con `npx tsx scripts/generate-move-i18n.ts` desde PokeAPI.
 */
import catalog from "@/data/move-i18n.json";

type LangEntry = { name: string; effect: string };
type MoveEntry = { en: LangEntry; es: LangEntry; pt: LangEntry };

const MOVE_I18N = catalog as Record<string, MoveEntry>;

export type MoveLocale = "en" | "es" | "pt";

export function normalizeMoveLocale(locale?: string | null): MoveLocale {
  const raw = (locale ?? "en").toLowerCase().split("-")[0] ?? "en";
  if (raw === "es" || raw === "pt") return raw;
  return "en";
}

export function moveSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function entryFor(name: string, locale?: string | null): LangEntry | null {
  const row = MOVE_I18N[moveSlug(name)];
  if (!row) return null;
  return row[normalizeMoveLocale(locale)] ?? row.en;
}

/** Nombre oficial del movimiento en el locale (fallback: title-case del slug). */
export function localizedMoveName(name: string, locale?: string | null): string | null {
  return entryFor(name, locale)?.name ?? null;
}

/** Flavor / efecto corto en el locale. */
export function localizedMoveEffect(name: string, locale?: string | null): string | null {
  const effect = entryFor(name, locale)?.effect?.trim();
  return effect ? effect : null;
}
