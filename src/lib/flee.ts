// Fórmula real de fuga de los juegos clásicos (Gen I-III, ver Bulbapedia
// "Escape"): compara la Velocidad del jugador contra la del salvaje. Cuanto
// más lento sea el jugador respecto al rival, menor la chance de escapar. No
// incluye el escalado por intentos repetidos (+30 por intento) porque acá no
// se trackea un contador de intentos entre turnos — cada intento se evalúa
// como si fuera el primero.
export function canEscape(playerSpeed: number, wildSpeed: number): boolean {
  if (playerSpeed >= wildSpeed || wildSpeed === 0) return true;
  const odds = Math.min(255, Math.floor((playerSpeed * 32) / wildSpeed));
  return Math.floor(Math.random() * 256) < odds;
}
