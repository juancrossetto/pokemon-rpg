/**
 * Saneamiento del texto que un jugador escribe y otros ven.
 *
 * No es un filtro de contenido —eso es una decisión de política, no de
 * código—: es la capa objetiva de abajo. Hoy cada punto de entrada hacía
 * `raw.trim().slice(0, max)`, que alcanza para el largo y nada más. Con eso
 * pasan cosas que rompen la pantalla del resto:
 *
 * - **Nombres invisibles**: un apodo de puros espacios de ancho cero pasa el
 *   `trim()` (no son whitespace ASCII) y se guarda como una fila en blanco.
 * - **Suplantación por bidi**: los controles U+202A–U+202E dan vuelta el orden
 *   de dibujo, así que un nombre puede *verse* como el de otro jugador.
 * - **Zalgo**: apilar tildes combinantes hace que una línea invada las de
 *   arriba y abajo y desarme la lista.
 * - **Estiramiento**: veinte espacios seguidos empujan el layout aunque el
 *   largo esté dentro del límite.
 *
 * Los rangos van con escapes `\u` a propósito: escritos como carácter literal
 * son invisibles en el editor y en el diff, que es justo lo que los hace
 * fáciles de romper sin darse cuenta.
 *
 * El recorte va **al final** y por puntos de código, no por unidades UTF-16:
 * cortar a la mitad un par sustituto parte un emoji y deja basura en la base.
 */

/** Formato invisible: guion blando, ancho cero, joiners, bidi, BOM. */
const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/**
 * Controles que **son** separadores (tab, salto, retorno, form feed). Van a
 * espacio y no a la nada: borrarlos pega las palabras — "Team\\nRocket"
 * terminaba como "TeamRocket".
 */
const CONTROL_WHITESPACE = /[\u0009-\u000D]/g;

/** El resto de C0/C1: ningún texto de UI los necesita. */
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;

/** Marcas combinantes (tildes y diacríticos apilables). */
const COMBINING = /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20F0\uFE20-\uFE2F]/;

/**
 * Cuántas combinantes seguidas se toleran sobre una misma letra. Una alcanza
 * para cualquier idioma real (á, ñ, ü); a partir de ahí es apilado decorativo,
 * que es lo que invade las líneas vecinas.
 */
const MAX_COMBINING_RUN = 1;

function stripCombiningRuns(value: string): string {
  let out = "";
  let run = 0;
  for (const char of value) {
    if (COMBINING.test(char)) {
      run += 1;
      if (run > MAX_COMBINING_RUN) continue;
    } else {
      run = 0;
    }
    out += char;
  }
  return out;
}

export type SanitizeOptions = {
  /** Tope en **puntos de código**, no en unidades UTF-16. */
  max: number;
};

/**
 * Deja el texto listo para guardar y mostrar. Devuelve cadena vacía si no
 * queda nada visible — el caller decide si eso es un error o un valor nulo.
 */
export function sanitizeUserText(raw: string, options: SanitizeOptions): string {
  /*
    El orden importa. El apilado se corta **antes** de normalizar: si se
    normaliza primero, NFC compone la base con la primera tilde ("a" + ́  → "á")
    y el contador vuelve a cero, así que todavía pasaba una segunda marca y el
    resultado quedaba con dos acentos. Limpiando primero, el NFC de después
    compone la única que sobrevive y deja un carácter legítimo.
  */
  const cleaned = stripCombiningRuns(
    raw.replace(CONTROL_WHITESPACE, " ").replace(CONTROL, "").replace(INVISIBLE, ""),
  )
    .normalize("NFC")
    // Cualquier corrida de espacios (incluidos los tipográficos) pasa a uno.
    .replace(/\s+/gu, " ")
    .trim();

  return [...cleaned]
    .slice(0, Math.max(0, Math.floor(options.max)))
    .join("")
    .trim();
}

/** Igual que `sanitizeUserText` pero devuelve `null` cuando queda vacío. */
export function sanitizeUserTextOrNull(
  raw: string,
  options: SanitizeOptions,
): string | null {
  const value = sanitizeUserText(raw, options);
  return value.length > 0 ? value : null;
}

/**
 * ¿Queda algo legible? Un nombre que después de limpiar queda vacío tiene que
 * rechazarse, no guardarse en blanco.
 */
export function hasVisibleText(raw: string): boolean {
  return sanitizeUserText(raw, { max: 1 }).length > 0;
}
