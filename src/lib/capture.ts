// Fórmula Gen III/IV. `statusBonus` (1 / 1.5 / 2) multiplica el catch rate.
// a = ((3×maxHP − 2×curHP) × catchRate × ball × status) / (3×maxHP)
// Si a ≥ 255 → captura garantizada. Si no, hasta 4 checks con
// b ≈ 65536 × (a/255)^0.25 (cada check = un temblor).
export interface CaptureAttemptResult {
  caught: boolean;
  shakes: number; // 0-4 — cuántos temblores tuvo antes de escapar (4 = atrapado)
}

/** Multiplicador “infinito” de Master Ball en los seeds (≥255). */
const MASTER_BALL_MULTIPLIER = 255;

export function attemptCapture(
  currentHp: number,
  maxHp: number,
  captureRate: number,
  ballMultiplier: number,
  statusBonus = 1,
): CaptureAttemptResult {
  // Master Ball: siempre atrapa, sin tirada (paridad con los juegos).
  if (ballMultiplier >= MASTER_BALL_MULTIPLIER) {
    return { caught: true, shakes: 4 };
  }

  const safeMax = Math.max(1, maxHp);
  const safeHp = Math.min(safeMax, Math.max(0, currentHp));
  const a = Math.floor(
    ((3 * safeMax - 2 * safeHp) * captureRate * ballMultiplier * statusBonus) / (3 * safeMax),
  );

  if (a >= 255) {
    return { caught: true, shakes: 4 };
  }

  // Gen III: b = 65536 / (255/a)^0.25 ≡ 65536 × (a/255)^0.25
  const b = a <= 0 ? 0 : 65536 * (a / 255) ** 0.25;

  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (Math.random() * 65536 < b) {
      shakes++;
    } else {
      break;
    }
  }

  return { caught: shakes === 4, shakes };
}
