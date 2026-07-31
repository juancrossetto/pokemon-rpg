"use client";

import { TrainerStatRows, type StatRow } from "@/components/profile/trainer-stat-rows";

export type ProfileTabId = "summary" | "badges" | "team";

export type ProfileHubLabels = {
  tabs: Record<ProfileTabId, string>;
  /** Rótulo de la ficha del entrenador. */
  facts: string;
  manageTeam: string;
};

/**
 * Ficha del entrenador: una sola lista con todo lo que identifica la cuenta.
 *
 * Reemplaza a la grilla de métricas y a la sección de insignias destacadas. Esa
 * sección repetía las medallas que ya se ven enteras en su propia pestaña, y
 * las métricas contaban una parte de lo mismo desde otro ángulo. Acá va una
 * fila por dato y cada dato aparece una vez.
 */
export function TrainerFacts({
  sectionLabel,
  rows,
}: {
  sectionLabel: string;
  rows: StatRow[];
}) {
  return (
    <section>
      <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70">
        {sectionLabel}
      </p>
      <TrainerStatRows rows={rows} />
    </section>
  );
}
