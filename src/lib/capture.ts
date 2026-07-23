// Fórmula de captura real de los juegos Gen III/IV (la misma familia que
// Rojo Fuego/Verde Hoja) — ver Bulbapedia "Catch rate". No incluye el bonus
// por estado alterado (parálisis/sueño/etc) porque todavía no existen esos
// efectos en el motor de batalla.
//
// a = ((3×MaxHP − 2×HP) × CaptureRate × BallBonus) / (3×MaxHP)
// Si a ≥ 255 → atrapado siempre.
// Si no, se hacen hasta 4 "temblores": cada uno tiene probabilidad
// (a/255)^(1/4) de tener éxito: sólo se atrapa si los 4 tienen éxito.
export interface CaptureAttemptResult {
  caught: boolean;
  shakes: number; // 0-4 — cuántos temblores tuvo antes de escapar (4 = atrapado)
}

export function attemptCapture(
  currentHp: number,
  maxHp: number,
  captureRate: number,
  ballMultiplier: number,
): CaptureAttemptResult {
  const a = Math.floor(
    ((3 * maxHp - 2 * currentHp) * captureRate * ballMultiplier) / (3 * maxHp),
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
