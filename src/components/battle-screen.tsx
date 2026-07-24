"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StartEncounterButton } from "@/components/start-encounter-button";
import { BattleArena, type BattleArenaProps } from "@/components/battle-arena";

// Toma la batalla ACTIVA inicial una sola vez, al montar, y nunca la vuelve a
// leer de props: cada Server Action re-renderiza el árbol del servidor como
// parte de su propia respuesta (así funciona el App Router, no depende de
// revalidatePath), y apenas la batalla deja de estar ACTIVE ese refresco
// devolvería null acá. Si reaccionáramos a ese refresco, BattleArena se
// desmontaría a mitad de la animación de la propia batalla que la terminó.
export function BattleScreen({
  initialBattle,
  locale,
  hasHealthyTeam,
}: {
  initialBattle: BattleArenaProps | null;
  locale: string;
  hasHealthyTeam: boolean;
}) {
  const [battle] = useState(initialBattle);
  const t = useTranslations("battle");

  const startErrors = {
    no_lead: t("errors.noLead"),
    fainted_lead: t("errors.faintedLead"),
    no_energy: t("errors.noEnergy"),
  };

  if (!battle) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-margin-mobile py-8 text-center">
        <h1 className="text-headline-lg md:text-display-lg text-white">{t("title")}</h1>
        <p className="max-w-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
        {hasHealthyTeam ? (
          <StartEncounterButton locale={locale} label={t("explore")} errors={startErrors} />
        ) : (
          <>
            <p className="text-label-md text-error">{t("errors.faintedLead")}</p>
            <Link
              href="/team"
              className="rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
            >
              {t("goHeal")}
            </Link>
          </>
        )}
      </div>
    );
  }

  return <BattleArena key={battle.battleId} {...battle} />;
}
