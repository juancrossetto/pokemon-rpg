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
 *
 * Si el cliente también pierde el estado (F5 / remount) y sigue un gym o
 * torre ACTIVE, mostramos un CTA de vuelta — nunca `null` en blanco.
 */
export function BattleScreen({
  initialBattle,
  locale,
  hasHealthyTeam,
  lobby,
  gymContinueId = null,
  towerContinue = false,
}: {
  initialBattle: BattleArenaProps | null;
  locale: string;
  hasHealthyTeam: boolean;
  lobby: BattleLobbyData | null;
  /** Corrida de gym ACTIVE sin batalla ACTIVE (entre entrenadores / tras F5). */
  gymContinueId?: string | null;
  /** Torre ACTIVE/bendición/descanso sin batalla ACTIVE. */
  towerContinue?: boolean;
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

  // La batalla es viewport-locked: sin scroll de documento detrás.
  useEffect(() => {
    if (!battle) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [battle]);

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
            className="game-cta game-cta--red"
          >
            {t("continueChallenge")}
          </Link>
        </div>
      );
    }
    if (towerContinue) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-margin-mobile py-10">
          <p className="text-center text-body-md text-on-surface-variant">
            {t("towerContinuePrompt")}
          </p>
          <Link
            href="/tower"
            className="game-cta game-cta--red"
          >
            {t("backToTower")}
          </Link>
        </div>
      );
    }
    return null;
  }

  // Altura hasta el tope del dock (`--bottom-sheet-inset`) menos un
  // respiro mínimo (0.375rem) para que comandos/log no peguen al dock.
  // El `-mb` anula todo el `.pb-bottom-nav` del shell.
  return (
    <div className="flex min-h-0 flex-col overflow-hidden max-md:-mb-[calc(var(--bottom-nav-h,5.25rem)+env(safe-area-inset-bottom,0px)+1.75rem+var(--vv-gap,0px))] h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px)-var(--bottom-sheet-inset,var(--bottom-nav-h,5.25rem))-0.375rem)] xl:mb-0 xl:h-[calc(100dvh-3.5rem)]">
      <BattleArena key={battle.battleId} {...battle} />
    </div>
  );
}
