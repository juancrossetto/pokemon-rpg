"use client";

import { NpcGuideButton, useMarketGuide } from "@/components/journey-guidance";

/**
 * Ayuda del comercio: sólo un botón `i` (sin fila).
 *
 * Abre la misma card que la agente muestra en la primera visita, en vez del
 * popup genérico de tips: el jugador reconoce la guía que ya vio y no se
 * encuentra con dos explicaciones distintas del mismo hub.
 */
export function TradeHelp() {
  const guide = useMarketGuide();
  return <NpcGuideButton {...guide} />;
}
