/**
 * Targeting de movimientos (PokeAPI `move.target.name`) para dobles.
 * @see https://pokeapi.co/api/v2/move-target/
 */

export type MoveTargetKind =
  | "selected-pokemon"
  | "all-opponents"
  | "all-other-pokemon"
  | "user"
  | "ally"
  | "user-or-ally"
  | "user-and-allies"
  | "users-field"
  | "opponents-field"
  | "entire-field"
  | "all-pokemon"
  | "all-allies"
  | "random-opponent"
  | "specific-move"
  | "selected-pokemon-me-first"
  | "fainting-pokemon"
  | string;

/** Fallback por nombre si el Move aún no tiene `target` en DB (pre-sync). */
const SPREAD_FOES_BY_NAME = new Set([
  "rock-slide",
  "razor-leaf",
  "growl",
  "tail-whip",
  "string-shot",
  "sweet-scent",
  "heal-block",
  "captivate",
  "snarl",
  "glaciate",
  "boomburst", // all-other in API but often treated as spread
]);

const SPREAD_ALL_BY_NAME = new Set([
  "earthquake",
  "surf",
  "discharge",
  "lava-plume",
  "lava plume",
  "teeter-dance",
  "brutal-swing",
  "petal-blizzard",
  "sludge-wave",
  "bulldoze",
  "explosion",
  "self-destruct",
  "magnitude",
]);

export function normalizeMoveTarget(
  target: string | null | undefined,
  moveName?: string,
): MoveTargetKind {
  const raw = (target ?? "").trim().toLowerCase();
  if (raw.length > 0) return raw;
  const key = (moveName ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  if (SPREAD_ALL_BY_NAME.has(key)) return "all-other-pokemon";
  if (SPREAD_FOES_BY_NAME.has(key)) return "all-opponents";
  return "selected-pokemon";
}

/** Pega a ambos rivales (y opcionalmente al aliado). */
export function isSpreadMove(target: string | null | undefined, moveName?: string): boolean {
  const t = normalizeMoveTarget(target, moveName);
  return t === "all-opponents" || t === "all-other-pokemon";
}

export function isSelfOrAllyOnlyMove(
  target: string | null | undefined,
  moveName?: string,
): boolean {
  const t = normalizeMoveTarget(target, moveName);
  return (
    t === "user" ||
    t === "ally" ||
    t === "user-or-ally" ||
    t === "user-and-allies" ||
    t === "all-allies" ||
    t === "users-field"
  );
}

/** En dobles el jugador debe elegir calle del rival (si hay 2 vivos). */
export function needsFoeTargetPick(target: string | null | undefined, moveName?: string): boolean {
  if (isSpreadMove(target, moveName)) return false;
  if (isSelfOrAllyOnlyMove(target, moveName)) return false;
  // Cualquier otro (selected-pokemon, random, field de rival, etc.) → elegir foe.
  return true;
}

/** También daña al aliado (Earthquake, Surf…). */
export function hitsAllyInDoubles(target: string | null | undefined, moveName?: string): boolean {
  return normalizeMoveTarget(target, moveName) === "all-other-pokemon";
}

/**
 * Multiplicador Gen IV+ cuando un move spread pega a 2+ objetivos vivos.
 * (0.75× por objetivo.)
 */
export const DOUBLES_SPREAD_DAMAGE_MULT = 0.75;
