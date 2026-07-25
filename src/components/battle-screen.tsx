"use client";

import { useState } from "react";
import { BattleArena, type BattleArenaProps } from "@/components/battle-arena";
import { BattleLobby } from "@/components/battle-lobby";
import type { BattleLobbyData } from "@/lib/battle-lobby";

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
  lobby,
}: {
  initialBattle: BattleArenaProps | null;
  locale: string;
  hasHealthyTeam: boolean;
  lobby: BattleLobbyData | null;
}) {
  const [battle] = useState(initialBattle);

  if (!battle) {
    if (!lobby) return null;
    return (
      <BattleLobby locale={locale} hasHealthyTeam={hasHealthyTeam} lobby={lobby} />
    );
  }

  return <BattleArena key={battle.battleId} {...battle} />;
}
