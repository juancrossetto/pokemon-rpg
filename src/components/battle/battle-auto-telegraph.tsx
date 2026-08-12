"use client";

/** Chip “próxima jugada” del AUTO — telegraph breve antes del golpe. */

import type { CSSProperties } from "react";

export function BattleAutoTelegraph({
  moveName,
  moveType,
  label,
}: {
  moveName: string;
  moveType: string;
  label: string;
}) {
  return (
    <div
      className="battle-auto-telegraph"
      role="status"
      aria-live="polite"
      style={
        {
          "--telegraph-type": `var(--type-${moveType}, #8899aa)`,
        } as CSSProperties
      }
    >
      <span className="battle-auto-telegraph__label">{label}</span>
      <span className="battle-auto-telegraph__move">{moveName}</span>
    </div>
  );
}
