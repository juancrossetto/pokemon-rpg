"use client";

import { useTranslations } from "next-intl";
import { HubHelpButton } from "@/components/journey-guidance";

/**
 * Ayuda del comercio: sólo un botón `i` (sin fila).
 * Al tocarlo abre un popup con los tips del hub.
 */
export function TradeHelp() {
  const t = useTranslations("ux");
  const bullets = (t.raw("help.market") as string[]) ?? [];

  return (
    <HubHelpButton bullets={bullets} handbookChapter="economy" roleKey="market" />
  );
}
