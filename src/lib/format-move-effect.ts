import { localizedMoveEffect, normalizeMoveLocale } from "@/lib/move-i18n";

const EFFECT_CHANCE: Record<"en" | "es" | "pt", string> = {
  en: "a chance",
  es: "una probabilidad",
  pt: "uma chance",
};

/**
 * Descripción de movimiento para UI.
 * Preferí flavor localizado por slug; si no hay, limpia el `effectText` de PokeAPI.
 */
export function formatMoveEffectText(
  raw: string | null | undefined,
  opts?: { locale?: string | null; moveName?: string | null },
): string | null {
  const locale = normalizeMoveLocale(opts?.locale);
  if (opts?.moveName) {
    const localized = localizedMoveEffect(opts.moveName, locale);
    if (localized) return localized;
  }

  if (!raw) return null;
  const cleaned = raw
    .replace(/\$effect_chance/g, EFFECT_CHANCE[locale])
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}
