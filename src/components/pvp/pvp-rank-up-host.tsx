"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PvpRankUpPopup } from "@/components/pvp/pvp-rank-up-popup";
import {
  clearPvpRankUpPending,
  peekPvpRankUpPending,
} from "@/lib/pvp/rating-anim";
import {
  divisionRoman,
  rankForRating,
  type PvpTier,
} from "@/lib/pvp/tiers";

const TIER_MSG = {
  beginner: "tiers.beginner",
  rising: "tiers.rising",
  advanced: "tiers.advanced",
  elite: "tiers.elite",
  bronzeMaster: "tiers.bronzeMaster",
  crystalMaster: "tiers.crystalMaster",
  champion: "tiers.champion",
  legendary: "tiers.legendary",
} as const satisfies Record<PvpTier, string>;

type Standing = ReturnType<typeof rankForRating>;

/**
 * Muestra el ascenso al entrar a PvP o al home (después del outcome).
 * La animación no se puede cancelar; al terminar limpia el pending.
 *
 * El host no llama `useTranslations` en el primer render (SSR): el popup
 * sólo existe tras peek client-side. Si no, un fallo de RSC/HMR puede
 * montar este client component sin `NextIntlClientProvider` y tumbar el home.
 */
export function PvpRankUpHost() {
  const [open, setOpen] = useState(false);
  const [standing, setStanding] = useState<Standing | null>(null);

  useEffect(() => {
    const pending = peekPvpRankUpPending();
    if (!pending) return;
    const next = rankForRating(pending.after);
    const id = requestAnimationFrame(() => {
      setStanding(next);
      setOpen(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const onFinished = useCallback(() => {
    clearPvpRankUpPending();
    setOpen(false);
    setStanding(null);
  }, []);

  if (!open || !standing) return null;

  return <PvpRankUpDialog standing={standing} onFinished={onFinished} />;
}

function PvpRankUpDialog({
  standing,
  onFinished,
}: {
  standing: Standing;
  onFinished: () => void;
}) {
  const t = useTranslations("pvp");

  return (
    <PvpRankUpPopup
      tier={standing.tier}
      division={standing.division}
      tierLabel={t(TIER_MSG[standing.tier])}
      title={t("rankUpTitle")}
      subtitle={t("rankUpSubtitle", {
        rank: t("rankStanding", {
          tier: t(TIER_MSG[standing.tier]),
          division: divisionRoman(standing.division),
        }),
      })}
      onFinished={onFinished}
    />
  );
}
