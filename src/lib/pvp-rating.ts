// Rating Elo para la ladder PvP (dossier fase 4). Estándar de ajedrez: la
// diferencia de rating define la expectativa de victoria y cuánto se mueve el
// puntaje. K alto = la ladder reacciona rápido, apto para un MVP con pocos
// partidos por jugador.

export const PVP_STARTING_RATING = 1000;
const K_FACTOR = 32;

function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

/** Nuevo rating de A tras un partido. `won` = si A ganó. */
export function newRating(rating: number, opponentRating: number, won: boolean): number {
  const expected = expectedScore(rating, opponentRating);
  const score = won ? 1 : 0;
  return Math.round(rating + K_FACTOR * (score - expected));
}

/** Deltas de ambos jugadores en un partido (challenger vs opponent). */
export function ratingDeltas(
  challengerRating: number,
  opponentRating: number,
  challengerWon: boolean,
): { challengerAfter: number; opponentAfter: number } {
  return {
    challengerAfter: newRating(challengerRating, opponentRating, challengerWon),
    opponentAfter: newRating(opponentRating, challengerRating, !challengerWon),
  };
}
