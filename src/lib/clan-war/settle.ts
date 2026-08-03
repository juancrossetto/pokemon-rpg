import { ratingDeltas } from "@/lib/pvp-rating";
import { warWinnerSide } from "@/lib/clan-war/rules";

export function settleClanWarRatings(input: {
  ratingA: number;
  ratingB: number;
  scoreA: number;
  scoreB: number;
}): { ratingAAfter: number; ratingBAfter: number; winner: "A" | "B" | "draw" } {
  const winner = warWinnerSide(input.scoreA, input.scoreB);
  if (winner === "draw") {
    // Empate: media de un win y un loss (0.5) vía Elo — newRating con won=false
    // no sirve; aplicamos medias simétricas.
    const aWin = ratingDeltas(input.ratingA, input.ratingB, true);
    const aLoss = ratingDeltas(input.ratingA, input.ratingB, false);
    return {
      winner,
      ratingAAfter: Math.round((aWin.challengerAfter + aLoss.challengerAfter) / 2),
      ratingBAfter: Math.round((aWin.opponentAfter + aLoss.opponentAfter) / 2),
    };
  }
  const aWon = winner === "A";
  const deltas = ratingDeltas(input.ratingA, input.ratingB, aWon);
  return {
    winner,
    ratingAAfter: deltas.challengerAfter,
    ratingBAfter: deltas.opponentAfter,
  };
}
