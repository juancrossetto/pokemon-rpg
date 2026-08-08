"use client";

import { useEffect } from "react";
import {
  persistPvpRankUp,
  persistPvpRatingAnim,
} from "@/lib/pvp/rating-anim";

/**
 * Persiste el delta de Elo / ascenso para animar en el hub PvP al volver.
 * No renderiza UI en la pantalla de outcome.
 */
export function PvpHubAnimPersist({
  ratingBefore,
  ratingAfter,
}: {
  ratingBefore: number;
  ratingAfter: number;
}) {
  useEffect(() => {
    persistPvpRatingAnim(ratingBefore, ratingAfter);
    persistPvpRankUp(ratingBefore, ratingAfter);
  }, [ratingBefore, ratingAfter]);

  return null;
}
