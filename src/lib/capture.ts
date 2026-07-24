// Fórmula Gen III/IV. `statusBonus` (1 / 1.5 / 2) multiplica el catch rate.
export interface CaptureAttemptResult {
  caught: boolean;
  shakes: number; // 0-4 — cuántos temblores tuvo antes de escapar (4 = atrapado)
}

export function attemptCapture(
  currentHp: number,
  maxHp: number,
  captureRate: number,
  ballMultiplier: number,
  statusBonus = 1,
): CaptureAttemptResult {
  const a = Math.floor(
    ((3 * maxHp - 2 * currentHp) * captureRate * ballMultiplier * statusBonus) / (3 * maxHp),
  );

  if (a >= 255) {
    return { caught: true, shakes: 4 };
  }

  const shakeProbability = 65535 * (a / 255) ** 0.25;

  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (Math.random() * 65536 < shakeProbability) {
      shakes++;
    } else {
      break;
    }
  }

  return { caught: shakes === 4, shakes };
}
