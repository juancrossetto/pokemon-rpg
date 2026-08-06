/**
 * Limpia el `effectText` de PokeAPI para mostrarlo en UI.
 * Quita placeholders (`$effect_chance`) y espacios dobles.
 */
export function formatMoveEffectText(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\$effect_chance/g, "a chance")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}
