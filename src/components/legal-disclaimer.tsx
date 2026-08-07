"use client";

import { useTranslations } from "next-intl";

/**
 * Aviso legal fan-made (Nintendo / Pokémon). Compacto a propósito:
 * no pelea con pantallas viewport-locked; va en auth y menú de cuenta.
 */
export function LegalDisclaimer({
  className = "",
  tone = "auth",
}: {
  className?: string;
  /** `auth` = bajo el formulario; `menu` = pie del user menu. */
  tone?: "auth" | "menu";
}) {
  const t = useTranslations("legal");
  const base =
    tone === "menu"
      ? "text-[9px] leading-snug text-white/30"
      : "text-[9px] leading-snug text-white/28 sm:text-[10px]";

  return (
    <p role="note" className={`text-center ${base} ${className}`.trim()}>
      <span className="block">{t("copyright")}</span>
      <span className="block">{t("nintendo")}</span>
      <span className="mt-0.5 block">{t("fanMade")}</span>
    </p>
  );
}
