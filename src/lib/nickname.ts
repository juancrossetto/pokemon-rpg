import { sanitizeUserTextOrNull } from "@/lib/user-text";

/** Name Rater: primer mote gratis al capturar; cambios posteriores cuestan monedas. */
export const RENAME_COST = 200;
export const MAX_NICKNAME_LENGTH = 20;

/**
 * El mote lo ven otros jugadores en el equipo, el PC y los rankings, así que
 * pasa por el saneamiento común: `trim().slice()` dejaba pasar anchos cero
 * (mote en blanco), controles bidi (suplantar a otro) y tildes apiladas.
 */
export function normalizeNickname(raw: string): string | null {
  return sanitizeUserTextOrNull(raw, { max: MAX_NICKNAME_LENGTH });
}
