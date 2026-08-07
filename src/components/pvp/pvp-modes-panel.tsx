"use client";

import { findMatch } from "@/actions/pvp";
import { startPvpRanked } from "@/actions/start-pvp-battle";
import { SubmitButton } from "@/components/submit-button";
import { PvpChallengeSearch } from "@/components/pvp-challenge-search";
import { PvpQuickMatchSubmit } from "@/components/pvp/pvp-quick-match-submit";
import { PVP_BATTLE_ENERGY_COST } from "@/lib/energy";
import { announceEnergyDelta } from "@/lib/resource-fx";

/** Panel de modos PvP: ranked / quick / challenge con flash de energía. */
export function PvpModesPanel({
  locale,
  title,
  rankedLabel,
  quickLabel,
  starting,
  searching,
  canFight,
}: {
  locale: string;
  title: string;
  rankedLabel: string;
  quickLabel: string;
  starting: string;
  searching: string;
  canFight: boolean;
}) {
  return (
    <section className="pvp-mode-card game-float-card rounded-2xl p-3.5 sm:p-5">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <form
          action={startPvpRanked.bind(null, locale)}
          onSubmit={() => announceEnergyDelta(-PVP_BATTLE_ENERGY_COST)}
        >
          <SubmitButton
            label={rankedLabel}
            pendingLabel={starting}
            disabled={!canFight}
            className="game-cta game-cta--red pvp-mode-btn w-full"
          />
        </form>
        <form
          action={findMatch.bind(null, locale)}
          onSubmit={() => announceEnergyDelta(-PVP_BATTLE_ENERGY_COST)}
        >
          <PvpQuickMatchSubmit
            label={quickLabel}
            pendingLabel={searching}
            disabled={!canFight}
            className="game-cta pvp-mode-btn w-full"
          />
        </form>
        <div className="col-span-2 min-w-0">
          <PvpChallengeSearch locale={locale} canFight={canFight} />
        </div>
      </div>
    </section>
  );
}
