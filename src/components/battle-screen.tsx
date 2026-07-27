"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BattleArena, type BattleArenaProps } from "@/components/battle-arena";
import { BattleLobby } from "@/components/battle-lobby";
import type { BattleLobbyData } from "@/lib/battle-lobby";

/**
 * La batalla ACTIVA se toma de props al montar y cuando pasamos de lobby →
 * combate (mismo /battle, sin remount).
 *
 * Importante: si el server manda `null` (sesión ya WON/LOST tras el KO),
 * **no** desmontamos BattleArena. El cartel de resultado vive en el cliente
 * hasta que el jugador elige la siguiente acción. Un refresh RSC temprano
 * antes hacía que el lobby (o un redirect a /run) pisara ese resumen.
 */
export function BattleScreen({
  initialBattle,
  locale,
  hasHealthyTeam,
  lobby,
  gymContinueId = null,
}: {
  initialBattle: BattleArenaProps | null;
  locale: string;
  hasHealthyTeam: boolean;
  lobby: BattleLobbyData | null;
  /** Corrida de gym ACTIVE sin batalla ACTIVE (entre entrenadores / tras F5). */
  gymContinueId?: string | null;
}) {
  const t = useTranslations("battle");
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
    if (lobby) {
      return (
        <BattleLobby locale={locale} hasHealthyTeam={hasHealthyTeam} lobby={lobby} />
      );
    }
    if (gymContinueId) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-margin-mobile py-10">
          <p className="text-center text-body-md text-on-surface-variant">
            {t("advancePrompt")}
          </p>
          <Link
            href={`/gyms/${gymContinueId}/run`}
            className="rounded-lg bg-pokeball-red px-6 py-3 text-label-md font-bold text-white hover:bg-pokeball-red/80 transition-colors"
          >
            {t("continueChallenge")}
          </Link>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <BattleArena key={battle.battleId} {...battle} />
    </div>
  );
}
