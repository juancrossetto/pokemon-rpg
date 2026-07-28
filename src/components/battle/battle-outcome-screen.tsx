"use client";

// Pantalla de fin de batalla: resultado, rating PvP, popup de medalla y los
// CTAs de salida (seguir gym / volver a curar / explorar de nuevo). El estado
// del confirm de abandono de gym vive acá porque nadie más lo necesita.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SoftLeaveButton, BattleResult } from "@/components/battle-result";
import { GymBadgePopup } from "@/components/gym-badge-popup";
import { startEncounter } from "@/actions/start-encounter";
import { abandonGymRun } from "@/actions/abandon-gym-run";
import type { XpSummaryEntry } from "@/actions/battle-move";
import type { Outcome } from "@/components/battle/arena-types";

export interface PvpResultInfo {
  matchId: string;
  ratingBefore: number;
  ratingAfter: number;
  coinsAwarded: number;
}

export function BattleOutcomeScreen({
  outcome,
  caughtSentToPc,
  locale,
  player,
  foe,
  xpSummary,
  coinsGained,
  isPvpBattle,
  isGymBattle,
  pvpResult,
  showBadgePopup,
  onBadgeContinue,
  badgeEarned,
  tmRewardName,
  gymId,
  gymRunId,
  gymType,
  gymName,
  gymLeaderName,
  gymBadgeName,
  leaderPortrait,
}: {
  outcome: Exclude<Outcome, "ongoing">;
  caughtSentToPc: boolean;
  locale: string;
  player: { instanceId: string; name: string; speciesName: string; level: number; spriteUrl: string };
  foe: { name: string; speciesName: string; level: number; spriteUrl: string };
  xpSummary: XpSummaryEntry[] | null;
  coinsGained: number;
  isPvpBattle: boolean;
  isGymBattle: boolean;
  pvpResult: PvpResultInfo | null;
  showBadgePopup: boolean;
  onBadgeContinue: () => void;
  badgeEarned: boolean;
  tmRewardName: string | null;
  gymId: string | null;
  gymRunId: string | null;
  gymType: string | null;
  gymName: string | null;
  gymLeaderName: string | null;
  gymBadgeName: string | null;
  leaderPortrait: string | null;
}) {
  const t = useTranslations("battle");
  const router = useRouter();
  const [confirmLeaveGym, setConfirmLeaveGym] = useState(false);

  const resultText =
    outcome === "won"
      ? t("resultWon")
      : outcome === "lost"
        ? t("resultLostTitle")
        : outcome === "caught"
          ? caughtSentToPc
            ? t("resultCaughtPc")
            : t("resultCaught")
          : outcome === "trainer_cleared"
            ? t("resultTrainerCleared")
            : t("resultFled");
  // El texto largo de derrota explica el próximo paso — va como bajada.
  const resultSubText = outcome === "lost" ? t("resultLost") : null;
  const ctaClass =
    "w-full max-w-sm rounded-lg bg-pokeball-red px-6 py-3 text-center text-label-md font-bold text-white hover:bg-pokeball-red/80 transition-colors";

  return (
    <BattleResult
      mode={outcome}
      resultText={resultText}
      subText={resultSubText}
      player={{
        name: player.name,
        speciesName: player.speciesName,
        level:
          xpSummary?.find((e) => e.instanceId === player.instanceId)?.leveledUpTo ?? player.level,
        spriteUrl: player.spriteUrl,
      }}
      foe={{
        name: foe.name,
        speciesName: foe.speciesName,
        level: foe.level,
        spriteUrl: foe.spriteUrl,
      }}
      xpSummary={xpSummary}
      coinsGained={coinsGained}
    >
      {isPvpBattle && pvpResult && (
        <div className="w-full max-w-sm rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center mb-1">
          <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
            {t("pvpRating")}
          </p>
          <p className="text-headline-md font-mono text-electric-yellow">
            {pvpResult.ratingAfter}{" "}
            <span
              className={
                pvpResult.ratingAfter - pvpResult.ratingBefore >= 0
                  ? "text-tertiary"
                  : "text-error"
              }
            >
              ({pvpResult.ratingAfter - pvpResult.ratingBefore >= 0 ? "+" : ""}
              {pvpResult.ratingAfter - pvpResult.ratingBefore})
            </span>
          </p>
          {pvpResult.coinsAwarded > 0 && (
            <p className="text-label-md text-tertiary mt-1">
              +{pvpResult.coinsAwarded} {t("coins")}
            </p>
          )}
        </div>
      )}
      {showBadgePopup && badgeEarned && gymType && (
        <GymBadgePopup
          gymType={gymType}
          gymName={gymName}
          leaderName={gymLeaderName}
          badgeName={gymBadgeName}
          portraitUrl={leaderPortrait}
          labels={{
            badgeEarned: t("badgeEarned"),
            tmEarned: tmRewardName ? t("tmEarned", { code: tmRewardName }) : null,
            continue: t("badgeContinue"),
          }}
          onContinue={onBadgeContinue}
        />
      )}
      {outcome === "lost" && isPvpBattle ? (
        <SoftLeaveButton
          href={pvpResult ? `/pvp/${pvpResult.matchId}` : "/pvp"}
          className={ctaClass}
        >
          {t("backToPvp")}
        </SoftLeaveButton>
      ) : outcome === "lost" ? (
        <SoftLeaveButton href="/team" className={ctaClass}>
          {t("goHeal")}
        </SoftLeaveButton>
      ) : outcome === "won" && isPvpBattle ? (
        <SoftLeaveButton
          href={pvpResult ? `/pvp/${pvpResult.matchId}` : "/pvp"}
          className={ctaClass}
        >
          {t("backToPvp")}
        </SoftLeaveButton>
      ) : outcome === "trainer_cleared" && gymId && gymRunId ? (
        <div className="w-full max-w-sm flex flex-col gap-3">
          <p className="text-label-md text-on-surface-variant">{t("advancePrompt")}</p>
          {!confirmLeaveGym ? (
            <>
              <SoftLeaveButton
                href={`/gyms/${gymId}/run`}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-pokeball-red px-6 py-3 text-label-md text-white font-bold hover:bg-pokeball-red/80 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]!">arrow_forward</span>
                {t("continueChallenge")}
              </SoftLeaveButton>
              <button
                type="button"
                onClick={() => setConfirmLeaveGym(true)}
                className="w-full rounded-lg border border-white/20 px-6 py-2.5 text-label-md text-on-surface-variant hover:text-error hover:border-error/40 transition-colors"
              >
                {t("leaveGym")}
              </button>
            </>
          ) : (
            <div className="glass-panel rounded-xl border border-error/40 p-4 text-left flex flex-col gap-3">
              <p className="text-label-md text-error font-bold">{t("leaveGymTitle")}</p>
              <p className="text-label-sm text-on-surface-variant">{t("leaveGymBody")}</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmLeaveGym(false)}
                  className="w-full rounded-lg bg-pokeball-red px-4 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
                >
                  {t("continueChallenge")}
                </button>
                <SoftLeaveButton
                  className="w-full rounded-lg border border-error/40 px-4 py-2 text-label-md text-error hover:bg-error/10 transition-colors"
                  onAction={() => abandonGymRun(gymRunId, locale)}
                >
                  {t("confirmLeaveGym")}
                </SoftLeaveButton>
              </div>
            </div>
          )}
        </div>
      ) : isGymBattle ? (
        <SoftLeaveButton href="/gyms" className={ctaClass}>
          {t("backToGyms")}
        </SoftLeaveButton>
      ) : (
        <div className="w-full max-w-sm">
          <SoftLeaveButton
            className={ctaClass}
            onAction={async () => {
              await startEncounter(locale);
              router.refresh();
            }}
          >
            {t("explore")}
          </SoftLeaveButton>
          <SoftLeaveButton
            href="/"
            className="mt-2 block w-full text-center text-label-sm text-on-surface-variant transition-colors hover:text-white"
          >
            {t("backHome")}
          </SoftLeaveButton>
        </div>
      )}
    </BattleResult>
  );
}
