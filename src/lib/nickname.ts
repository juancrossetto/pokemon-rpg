/** Name Rater: primer mote gratis al capturar; cambios posteriores cuestan monedas. */
export const RENAME_COST = 200;
export const MAX_NICKNAME_LENGTH = 20;

export function normalizeNickname(raw: string): string | null {
  const trimmed = raw.trim().slice(0, MAX_NICKNAME_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}
