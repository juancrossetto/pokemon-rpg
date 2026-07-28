"use client";

import { clearPendingCoinDelta } from "@/lib/coin-fx";

/**
 * Si falló la creación del clan, cancela el delta anunciado al submit.
 * Limpia en render (no en useEffect) para que CoinsBadge no anime un -500 falso.
 */
export function ClanCreateCoinFxGuard({ error }: { error: string | null }) {
  if (error) clearPendingCoinDelta();
  return null;
}
