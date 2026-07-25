"use client";

import { useEffect, useState } from "react";
import { BattleArena, type BattleArenaProps } from "@/components/battle-arena";
import { BattleLobby } from "@/components/battle-lobby";
import type { BattleLobbyData } from "@/lib/battle-lobby";

/**
 * La batalla ACTIVA se toma de props al montar y cuando pasamos de lobby →
 * combate (mismo /battle, sin remount). No se limpia si el server manda null
 * a mitad de pelea: un refresh RSC tras una action terminaría desmontando
 * BattleArena antes de la animación de cierre.
 */
export function BattleScreen({
  initialBattle,
  locale,
  hasHealthyTeam,
  lobby,
}: {
  initialBattle: BattleArenaProps | null;
  locale: string;
  hasHealthyTeam: boolean;
  lobby: BattleLobbyData | null;
}) {
  const [battle, setBattle] = useState(initialBattle);

  useEffect(() => {
    if (!initialBattle) return;
    setBattle((prev) => {
      if (!prev) return initialBattle;
      if (prev.battleId !== initialBattle.battleId) return initialBattle;
      return prev;
    });
  }, [initialBattle]);

  if (!battle) {
    if (!lobby) return null;
    return (
      <BattleLobby locale={locale} hasHealthyTeam={hasHealthyTeam} lobby={lobby} />
    );
  }

  return <BattleArena key={battle.battleId} {...battle} />;
}
