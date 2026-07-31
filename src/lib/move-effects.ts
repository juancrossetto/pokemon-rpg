/**
 * Efectos que el schema de `Move` no guarda (PokeAPI no expone meta acá):
 * curación, drenaje, auto-boost, OHKO, retroceso, flinch y crítico alto.
 * Se resuelven por nombre, mismo patrón que `multi-hit.ts` y `two-turn.ts`.
 *
 * Módulo puro (sin Prisma): lo consumen el motor del servidor y el pronóstico
 * de daño del cliente.
 */

import type { BattleStat } from "@/lib/status";

export function moveKey(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

/* ------------------------------------------------------------------ *
 * Curación directa                                                     *
 * ------------------------------------------------------------------ */

/** Fracción del HP máximo que restaura el movimiento sobre el propio usuario. */
const HEAL_MOVES: Record<string, number> = {
  recover: 0.5,
  "soft-boiled": 0.5,
  "milk-drink": 0.5,
  "slack-off": 0.5,
  roost: 0.5,
  synthesis: 0.5,
  "morning-sun": 0.5,
  moonlight: 0.5,
  "heal-order": 0.5,
  "shore-up": 0.5,
  "life-dew": 0.25,
  "jungle-healing": 0.25,
  // Wish cura al turno siguiente en los juegos; acá se resuelve en el acto
  // porque no hay estado de campo diferido.
  wish: 0.5,
};

export function healFraction(moveName: string): number | null {
  return HEAL_MOVES[moveKey(moveName)] ?? null;
}

/** Rest: cura al máximo y deja dormido al usuario. */
export function isRestMove(moveName: string): boolean {
  return moveKey(moveName) === "rest";
}

/* ------------------------------------------------------------------ *
 * Drenaje                                                              *
 * ------------------------------------------------------------------ */

/** Fracción del daño infligido que el atacante recupera. */
const DRAIN_MOVES: Record<string, number> = {
  absorb: 0.5,
  "mega-drain": 0.5,
  "giga-drain": 0.5,
  "leech-life": 0.5,
  "drain-punch": 0.5,
  "horn-leech": 0.5,
  "parabolic-charge": 0.5,
  "bitter-blade": 0.5,
  "draining-kiss": 0.75,
  "oblivion-wing": 0.75,
  "dream-eater": 0.5,
};

export function drainFraction(moveName: string): number | null {
  return DRAIN_MOVES[moveKey(moveName)] ?? null;
}

/* ------------------------------------------------------------------ *
 * Auto-boost (movimientos STATUS que suben stats propias)              *
 * ------------------------------------------------------------------ */

export type StatDelta = { stat: BattleStat; stages: number };

const SELF_STAT_MOVES: Record<string, StatDelta[]> = {
  "swords-dance": [{ stat: "atk", stages: 2 }],
  howl: [{ stat: "atk", stages: 1 }],
  meditate: [{ stat: "atk", stages: 1 }],
  sharpen: [{ stat: "atk", stages: 1 }],
  harden: [{ stat: "def", stages: 1 }],
  withdraw: [{ stat: "def", stages: 1 }],
  "defense-curl": [{ stat: "def", stages: 1 }],
  "acid-armor": [{ stat: "def", stages: 2 }],
  barrier: [{ stat: "def", stages: 2 }],
  "iron-defense": [{ stat: "def", stages: 2 }],
  agility: [{ stat: "spe", stages: 2 }],
  "rock-polish": [{ stat: "spe", stages: 2 }],
  "nasty-plot": [{ stat: "spa", stages: 2 }],
  "tail-glow": [{ stat: "spa", stages: 3 }],
  amnesia: [{ stat: "spd", stages: 2 }],
  "calm-mind": [
    { stat: "spa", stages: 1 },
    { stat: "spd", stages: 1 },
  ],
  "bulk-up": [
    { stat: "atk", stages: 1 },
    { stat: "def", stages: 1 },
  ],
  "dragon-dance": [
    { stat: "atk", stages: 1 },
    { stat: "spe", stages: 1 },
  ],
  growth: [
    { stat: "atk", stages: 1 },
    { stat: "spa", stages: 1 },
  ],
  "work-up": [
    { stat: "atk", stages: 1 },
    { stat: "spa", stages: 1 },
  ],
  "quiver-dance": [
    { stat: "spa", stages: 1 },
    { stat: "spd", stages: 1 },
    { stat: "spe", stages: 1 },
  ],
  "shell-smash": [
    { stat: "atk", stages: 2 },
    { stat: "spa", stages: 2 },
    { stat: "spe", stages: 2 },
    { stat: "def", stages: -1 },
    { stat: "spd", stages: -1 },
  ],
  "double-team": [{ stat: "eva", stages: 1 }],
  minimize: [{ stat: "eva", stages: 2 }],
  "cosmic-power": [
    { stat: "def", stages: 1 },
    { stat: "spd", stages: 1 },
  ],
  coil: [
    { stat: "atk", stages: 1 },
    { stat: "def", stages: 1 },
    { stat: "acc", stages: 1 },
  ],
  "hone-claws": [
    { stat: "atk", stages: 1 },
    { stat: "acc", stages: 1 },
  ],
};

export function selfStatChanges(moveName: string): StatDelta[] | null {
  return SELF_STAT_MOVES[moveKey(moveName)] ?? null;
}

/* ------------------------------------------------------------------ *
 * OHKO                                                                 *
 * ------------------------------------------------------------------ */

const OHKO_MOVES = new Set(["fissure", "horn-drill", "guillotine", "sheer-cold"]);

export function isOhkoMove(moveName: string): boolean {
  return OHKO_MOVES.has(moveKey(moveName));
}

/**
 * Precisión de un OHKO (Gen III+): 30% base, +1% por nivel de ventaja,
 * y falla siempre contra un rival de nivel superior.
 */
export function ohkoAccuracy(attackerLevel: number, defenderLevel: number): number {
  if (attackerLevel < defenderLevel) return 0;
  return Math.min(100, 30 + (attackerLevel - defenderLevel));
}

/* ------------------------------------------------------------------ *
 * Retroceso propio (recoil)                                            *
 * ------------------------------------------------------------------ */

/** Fracción del daño infligido que el atacante se hace a sí mismo. */
const RECOIL_MOVES: Record<string, number> = {
  "take-down": 1 / 4,
  submission: 1 / 4,
  "wild-charge": 1 / 4,
  "double-edge": 1 / 3,
  "brave-bird": 1 / 3,
  "flare-blitz": 1 / 3,
  "wood-hammer": 1 / 3,
  "volt-tackle": 1 / 3,
  "light-of-ruin": 1 / 2,
  "head-smash": 1 / 2,
};

export function recoilFraction(moveName: string): number | null {
  return RECOIL_MOVES[moveKey(moveName)] ?? null;
}

/* ------------------------------------------------------------------ *
 * Flinch                                                               *
 * ------------------------------------------------------------------ */

const FLINCH_MOVES: Record<string, number> = {
  bite: 0.3,
  "bone-club": 0.1,
  headbutt: 0.3,
  "hyper-fang": 0.1,
  stomp: 0.3,
  "rock-slide": 0.3,
  "air-slash": 0.3,
  "iron-head": 0.3,
  "zen-headbutt": 0.2,
  "dark-pulse": 0.2,
  extrasensory: 0.1,
  astonish: 0.3,
  snore: 0.3,
  twister: 0.2,
  waterfall: 0.2,
  "icicle-crash": 0.3,
  "steamroller": 0.3,
  "heart-stamp": 0.3,
  "needle-arm": 0.3,
  "sky-attack": 0.3,
  "fake-out": 1,
};

export function flinchChance(moveName: string): number {
  return FLINCH_MOVES[moveKey(moveName)] ?? 0;
}

/* ------------------------------------------------------------------ *
 * Crítico alto                                                         *
 * ------------------------------------------------------------------ */

/** Movimientos con +1 nivel de crítico (Gen II+). */
const HIGH_CRIT_MOVES = new Set([
  "aeroblast",
  "air-cutter",
  "attack-order",
  "blaze-kick",
  "crabhammer",
  "cross-chop",
  "cross-poison",
  "drill-run",
  "karate-chop",
  "leaf-blade",
  "night-slash",
  "poison-tail",
  "psycho-cut",
  "razor-leaf",
  "razor-wind",
  "shadow-claw",
  "sky-attack",
  "slash",
  "snipe-shot",
  "spacial-rend",
  "stone-edge",
]);

export function highCritStage(moveName: string): number {
  return HIGH_CRIT_MOVES.has(moveKey(moveName)) ? 1 : 0;
}

/* ------------------------------------------------------------------ *
 * Movimientos STATUS sin efecto implementado                           *
 * ------------------------------------------------------------------ */

/**
 * Movimientos STATUS que reconocemos pero cuya mecánica no existe en el motor
 * (clima, pantallas, trampas). Se listan para poder avisar "no pasó nada" en
 * vez de fingir un uso exitoso.
 */
const UNSUPPORTED_STATUS_MOVES = new Set([
  "sunny-day",
  "rain-dance",
  "sandstorm",
  "hail",
  "snowscape",
  "reflect",
  "light-screen",
  "aurora-veil",
  "safeguard",
  "mist",
  "spikes",
  "toxic-spikes",
  "stealth-rock",
  "sticky-web",
  "protect",
  "detect",
  "substitute",
  "leech-seed",
  "trick-room",
  "tailwind",
  "haze",
  "encore",
  "disable",
  "taunt",
  "torment",
  "perish-song",
  "destiny-bond",
  "transform",
  "mimic",
  "metronome",
  "counter",
  "mirror-coat",
  "focus-energy",
  "baton-pass",
  "roar",
  "whirlwind",
  "confuse-ray",
  "supersonic",
  "swagger",
  "flatter",
  "attract",
  "curse",
  "belly-drum",
  "pain-split",
  "endure",
]);

export function isUnsupportedStatusMove(moveName: string): boolean {
  return UNSUPPORTED_STATUS_MOVES.has(moveKey(moveName));
}
