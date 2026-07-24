// Reglas de clanes (dossier fase 6). Constantes y validación compartidas entre
// los server actions y la UI — por eso viven en un archivo normal y no dentro
// del "use server", que solo puede exportar funciones async.

export const CLAN_MAX_MEMBERS = 20;

/** Crear un clan cuesta monedas: otro sumidero de economía y evita el spam. */
export const CLAN_CREATION_COST = 500;

export const CLAN_NAME_MIN = 3;
export const CLAN_NAME_MAX = 24;
export const CLAN_TAG_MIN = 2;
export const CLAN_TAG_MAX = 5;

// Tag: alfanumérico en mayúsculas, se muestra como [TAG] junto al nombre.
const TAG_RE = /^[A-Z0-9]+$/;
// Nombre: letras (con acentos), números y espacios simples.
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ]*$/u;

export function normalizeClanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function normalizeClanTag(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidClanName(name: string): boolean {
  return name.length >= CLAN_NAME_MIN && name.length <= CLAN_NAME_MAX && NAME_RE.test(name);
}

export function isValidClanTag(tag: string): boolean {
  return tag.length >= CLAN_TAG_MIN && tag.length <= CLAN_TAG_MAX && TAG_RE.test(tag);
}
