"use client";

import { HealButton } from "@/components/heal-button";

/**
 * Chip compacto del Centro Pokémon — sin copy de “heridos”.
 * El ícono Chansey (rojo) / bolt (rush) basta como señal.
 */
export function LobbySquadHealRow({
  locale,
  cooldownMsLeft,
  rushCost,
  coins,
  teamMaxLevel,
  onHealed,
  onHealFailed,
}: {
  locale: string;
  cooldownMsLeft: number;
  rushCost: number;
  coins: number;
  teamMaxLevel: number;
  onHealed: () => void;
  onHealFailed: () => void;
}) {
  return (
    <HealButton
        locale={locale}
        needsHealing
        cooldownMsLeft={cooldownMsLeft}
        rushCost={rushCost}
        coins={coins}
        teamMaxLevel={teamMaxLevel}
        iconOnly
        onHealed={onHealed}
        onHealFailed={onHealFailed}
    />
  );
}
