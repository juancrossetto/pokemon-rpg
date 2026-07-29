/**
 * Multi-golpe Gen I–IV.
 *
 * El schema de Move no guarda min/max hits (PokeAPI meta), así que
 * resolvemos por nombre de movimiento. Accuracy se tira una sola vez;
 * cada golpe puede criticar y se corta si el rival cae.
 */

export type MultiHitSpec =
  | { kind: "fixed"; hits: number }
  | { kind: "range"; min: number; max: number };

/** Distribución Gen III+: 2→3/8, 3→3/8, 4→1/8, 5→1/8. */
export function rollRangeHits(min: number, max: number, rng: () => number = Math.random): number {
  if (min >= max) return min;
  if (min === 2 && max === 5) {
    const r = rng();
    if (r < 3 / 8) return 2;
    if (r < 6 / 8) return 3;
    if (r < 7 / 8) return 4;
    return 5;
  }
  const span = max - min + 1;
  return min + Math.floor(rng() * span);
}

const MULTI_HIT_BY_NAME: Record<string, MultiHitSpec> = {
  // Exactamente 2
  "double-kick": { kind: "fixed", hits: 2 },
  twineedle: { kind: "fixed", hits: 2 },
  bonemerang: { kind: "fixed", hits: 2 },
  "double-hit": { kind: "fixed", hits: 2 },
  // Exactamente 3
  "triple-kick": { kind: "fixed", hits: 3 }, // simplificado: 3 hits fijos (sin escalar poder)
  // 2–5
  "double-slap": { kind: "range", min: 2, max: 5 },
  "comet-punch": { kind: "range", min: 2, max: 5 },
  "fury-attack": { kind: "range", min: 2, max: 5 },
  "pin-missile": { kind: "range", min: 2, max: 5 },
  "spike-cannon": { kind: "range", min: 2, max: 5 },
  barrage: { kind: "range", min: 2, max: 5 },
  "fury-swipes": { kind: "range", min: 2, max: 5 },
  "arm-thrust": { kind: "range", min: 2, max: 5 },
  "bullet-seed": { kind: "range", min: 2, max: 5 },
  "icicle-spear": { kind: "range", min: 2, max: 5 },
  "rock-blast": { kind: "range", min: 2, max: 5 },
  "tail-slap": { kind: "range", min: 2, max: 5 },
};

export function multiHitSpec(moveName: string): MultiHitSpec | null {
  const key = moveName.trim().toLowerCase().replace(/\s+/g, "-");
  return MULTI_HIT_BY_NAME[key] ?? null;
}

export function rollMultiHitCount(spec: MultiHitSpec, rng: () => number = Math.random): number {
  if (spec.kind === "fixed") return spec.hits;
  return rollRangeHits(spec.min, spec.max, rng);
}
