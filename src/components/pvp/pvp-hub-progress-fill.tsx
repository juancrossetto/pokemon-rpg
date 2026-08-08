"use client";

import { useEffect, useState } from "react";
import { playBattleSfx } from "@/lib/battle-sfx";
import {
  ensureHubRatingBarAnim,
  peekPvpRatingAnim,
  subscribeHubBarWidth,
} from "@/lib/pvp/rating-anim";
import { nextRankProgress } from "@/lib/pvp/tiers";
import { PVP_RANK_UP_LOCK_MS } from "@/components/pvp/pvp-rank-up-popup";

/**
 * Relleno de barra del hub (rating + premios de temporada).
 * Si hay anim pendiente post-ranked, llena con SFX al volver a esta pantalla.
 */
export function PvpHubProgressFill({
  pct,
  className = "pvp-arena-bar h-full rounded-full",
}: {
  pct: number;
  className?: string;
}) {
  const [width, setWidth] = useState(() => {
    const pending = typeof window !== "undefined" ? peekPvpRatingAnim() : null;
    return pending ? nextRankProgress(pending.before).pct : pct;
  });

  useEffect(() => {
    const pending = peekPvpRatingAnim();
    if (!pending) {
      const id = requestAnimationFrame(() => setWidth(pct));
      return () => cancelAnimationFrame(id);
    }

    const unsub = subscribeHubBarWidth(setWidth);
    ensureHubRatingBarAnim({
      settlePct: pct,
      rankUpLockMs: PVP_RANK_UP_LOCK_MS,
      playSfx: playBattleSfx,
    });
    return unsub;
  }, [pct]);

  return <div className={className} style={{ width: `${width}%` }} />;
}
