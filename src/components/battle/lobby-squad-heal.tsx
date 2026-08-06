"use client";

import { useTranslations } from "next-intl";
import { HealButton } from "@/components/heal-button";

/** Fila de cura embebida en la mochila del lobby (evita una card suelta). */
export function LobbySquadHealRow({
  locale,
  hurtCount,
  cooldownMsLeft,
  rushCost,
  coins,
  teamMaxLevel,
  onHealed,
  onHealFailed,
}: {
  locale: string;
  hurtCount: number;
  cooldownMsLeft: number;
  rushCost: number;
  coins: number;
  teamMaxLevel: number;
  onHealed: () => void;
  onHealFailed: () => void;
}) {
  const t = useTranslations("battle.lobby");

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
          {t("squadStatus")}
        </p>
        <p className="mt-0.5 truncate text-[13px] font-semibold leading-tight text-white">
          {t("hurtCount", { count: hurtCount })}
        </p>
      </div>
      <div className="shrink-0">
        <HealButton
          locale={locale}
          needsHealing
          cooldownMsLeft={cooldownMsLeft}
          rushCost={rushCost}
          coins={coins}
          teamMaxLevel={teamMaxLevel}
          compact
          onHealed={onHealed}
          onHealFailed={onHealFailed}
        />
      </div>
    </div>
  );
}
