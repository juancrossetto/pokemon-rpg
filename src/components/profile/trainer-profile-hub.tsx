"use client";

import { TrainerStatRows, type StatRow } from "@/components/profile/trainer-stat-rows";

export type ProfileTabId = "summary" | "badges" | "team";

export type ProfileHubLabels = {
  tabs: Record<ProfileTabId, string>;
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
export function TrainerFacts({ rows }: { rows: StatRow[] }) {
  /*
    Sin rótulo propio: la pestaña activa ya dice qué se está viendo, y el panel
    ahora cuelga del selector, así que un "FICHA DEL ENTRENADOR" flotando
    encima repetía la etiqueta que está tres píxeles más arriba.
  */
  return <TrainerStatRows rows={rows} />;
}
