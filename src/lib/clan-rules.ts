/**
 * Reglas de clanes — compartidas entre actions y UI (sin Prisma).
 */

import type { ClanAffinity, ClanFocus, ClanJoinPolicy } from "@/lib/clan-types";
import { sanitizeUserText } from "@/lib/user-text";
import {
  DEFAULT_CLAN_EMBLEM,
  parseClanEmblem,
  serializeClanEmblem,
  type ClanEmblem,
} from "@/lib/clan-emblem";

export const CLAN_MAX_MEMBERS = 20;
export const CLAN_CREATION_COST = 500;
export const CLAN_NAME_MIN = 3;
export const CLAN_NAME_MAX = 24;
export const CLAN_TAG_MIN = 2;
export const CLAN_TAG_MAX = 5;
export const CLAN_DESC_MAX = 280;
export const CLAN_MOTTO_MAX = 80;
export const CLAN_ANNOUNCE_MAX = 280;
export const CLAN_LEAVE_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h anti-hop
export const CLAN_APP_OUT_MAX = 5;
export const CLAN_INVITE_OUT_MAX = 20;

const TAG_RE = /^[A-Z0-9]+$/;
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ]*$/u;

export const CLAN_AFFINITIES: ClanAffinity[] = [
  "NORMAL",
  "FIRE",
  "WATER",
  "GRASS",
  "ELECTRIC",
  "ICE",
  "ROCK",
  "GROUND",
  "PSYCHIC",
  "DARK",
  "STEEL",
  "DRAGON",
  "FAIRY",
  "FIGHTING",
  "GHOST",
];

export const CLAN_FOCUSES: ClanFocus[] = [
  "CASUAL",
  "COMPETITIVE",
  "PVE",
  "PVP",
  "COLLECTION",
  "EVENTS",
  "SOCIAL",
  "MIXED",
];

export const CLAN_JOIN_POLICIES: ClanJoinPolicy[] = ["OPEN", "REQUEST", "INVITE"];

/**
 * El nombre de clan es el caso donde el saneamiento más importa: la unicidad
 * se calcula sobre esto (`canonicalizeClanName` construye encima), así que dos
 * nombres que se **ven** iguales pero difieren en un ancho cero pasaban los
 * dos y quedaban indistinguibles en pantalla.
 */
export function normalizeClanName(raw: string): string {
  return sanitizeUserText(raw, { max: CLAN_NAME_MAX });
}

/** Clave de unicidad laxa: minúsculas, sin diacríticos, sin espacios dobles. */
export function canonicalizeClanName(raw: string): string {
  return normalizeClanName(raw)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function normalizeClanTag(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidClanName(name: string): boolean {
  return (
    name.length >= CLAN_NAME_MIN &&
    name.length <= CLAN_NAME_MAX &&
    NAME_RE.test(name)
  );
}

export function isValidClanTag(tag: string): boolean {
  return (
    tag.length >= CLAN_TAG_MIN &&
    tag.length <= CLAN_TAG_MAX &&
    TAG_RE.test(tag)
  );
}

export function isValidClanAffinity(value: string): value is ClanAffinity {
  return CLAN_AFFINITIES.includes(value as ClanAffinity);
}

export function isValidClanFocus(value: string): value is ClanFocus {
  return CLAN_FOCUSES.includes(value as ClanFocus);
}

export function isValidClanJoinPolicy(value: string): value is ClanJoinPolicy {
  return CLAN_JOIN_POLICIES.includes(value as ClanJoinPolicy);
}

/**
 * Nombre, tag, lema, descripción y anuncio de clan: todo texto que ven
 * terceros. Antes era `trim().slice()`, que no ve los invisibles ni el bidi.
 */
export function clampClanText(raw: string, max: number): string {
  return sanitizeUserText(raw, { max });
}

export function resolveEmblem(raw: unknown): ClanEmblem {
  // Escritura: solo presets allowlisteados llegan a la DB.
  return serializeClanEmblem(parseClanEmblem(raw ?? DEFAULT_CLAN_EMBLEM));
}

export { DEFAULT_CLAN_EMBLEM };
