/**
 * Movimientos de 2 turnos (Fly, Dig, Solar Beam…).
 *
 * El schema de Move no guarda la fase de carga (PokeAPI meta no la marca),
 * así que resolvemos por nombre — mismo patrón que multi-hit.ts.
 *
 * - vanish: turno 1 se va (semi-invulnerable); turno 2 baja y pega.
 * - charge: turno 1 se prepara (vulnerable); turno 2 pega. Skull Bash sube Def.
 */

export type SemiInvulnKind = "air" | "underground" | "underwater";

export type TwoTurnSpec = {
  kind: "vanish" | "charge";
  invuln?: SemiInvulnKind;
  /** Boost propio al empezar la carga (Skull Bash: +1 Def). */
  chargeStat?: { stat: "atk" | "def" | "spe"; stages: number };
  /** Multiplicador de crítico en el golpe (Razor Wind / Sky Attack). */
  highCrit?: boolean;
};

const TWO_TURN_BY_NAME: Record<string, TwoTurnSpec> = {
  fly: { kind: "vanish", invuln: "air" },
  dig: { kind: "vanish", invuln: "underground" },
  dive: { kind: "vanish", invuln: "underwater" },
  bounce: { kind: "vanish", invuln: "air" },
  "razor-wind": { kind: "charge", highCrit: true },
  "skull-bash": { kind: "charge", chargeStat: { stat: "def", stages: 1 } },
  "solar-beam": { kind: "charge" },
  "sky-attack": { kind: "charge", highCrit: true },
};

function normalizeMoveName(moveName: string): string {
  return moveName.trim().toLowerCase().replace(/\s+/g, "-");
}

export function twoTurnSpec(moveName: string): TwoTurnSpec | null {
  return TWO_TURN_BY_NAME[normalizeMoveName(moveName)] ?? null;
}

export function invulnForMove(moveName: string): SemiInvulnKind | null {
  return twoTurnSpec(moveName)?.invuln ?? null;
}

/** Movimientos que conectan contra alguien en el aire (Fly/Bounce). */
const HITS_AIR = new Set([
  "gust",
  "twister",
  "thunder",
  "sky-uppercut",
  "hurricane",
  "smack-down",
  "thousand-arrows",
]);

/** Movimientos que conectan contra Dig. */
const HITS_UNDERGROUND = new Set(["earthquake", "magnitude", "fissure"]);

/** Movimientos que conectan contra Dive. */
const HITS_UNDERWATER = new Set(["surf", "whirlpool"]);

/** En Gen III+ estos pegan el doble si el rival está semi-invulnerable. */
const DOUBLE_VS_INVULN = new Set([
  "gust",
  "twister",
  "earthquake",
  "magnitude",
  "surf",
  "whirlpool",
]);

export function canHitSemiInvuln(moveName: string, invuln: SemiInvulnKind | null): boolean {
  if (!invuln) return true;
  const key = normalizeMoveName(moveName);
  if (invuln === "air") return HITS_AIR.has(key);
  if (invuln === "underground") return HITS_UNDERGROUND.has(key);
  if (invuln === "underwater") return HITS_UNDERWATER.has(key);
  return false;
}

/** Multiplicador extra (1 o 2) cuando el golpe conecta contra un semi-invulnerable. */
export function invulnPowerMultiplier(moveName: string, invuln: SemiInvulnKind | null): number {
  if (!invuln) return 1;
  if (!canHitSemiInvuln(moveName, invuln)) return 1;
  return DOUBLE_VS_INVULN.has(normalizeMoveName(moveName)) ? 2 : 1;
}
