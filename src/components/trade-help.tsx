"use client";

import { HubHelpPanel } from "@/components/journey-guidance";
import { useTranslations } from "next-intl";

/** Ayuda colapsable compartida Shop | Mercado. */
export function TradeHelp() {
  const t = useTranslations("ux");
  const bullets = (t.raw("help.market") as string[]) ?? [];
  return (
    <HubHelpPanel
      storageKey="hub-help-market"
      bullets={bullets}
      handbookChapter="economy"
    />
  );
}
