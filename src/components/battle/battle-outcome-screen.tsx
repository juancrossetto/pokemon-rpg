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
  lossReason = null,
  caughtSentToPc,
  locale,
  player,
  foe,
  xpSummary,
  coinsGained,
  isPvpBattle,
  isGymBattle,
  isTowerBattle,
  pvpResult,
  showBadgePopup,
  onBadgeContinue,
  badgeEarned,
  tmRewardName,
  gymId,
  gymRunId,
  towerRunId,
  gymType,
  gymName,
  gymLeaderName,
  gymBadgeName,
  leaderPortrait,
}: {
  outcome: Exclude<Outcome, "ongoing">;
  /** Si la derrota fue por reloj, no por debilitación. */
  lossReason?: "faint" | "idle" | null;
  caughtSentToPc: boolean;
  locale: string;
  player: { instanceId: string; name: string; speciesName: string; level: number; spriteUrl: string };
  foe: { name: string; speciesName: string; level: number; spriteUrl: string };
  xpSummary: XpSummaryEntry[] | null;
  coinsGained: number;
  isPvpBattle: boolean;
  isGymBattle: boolean;
  isTowerBattle: boolean;
  pvpResult: PvpResultInfo | null;
  showBadgePopup: boolean;
  onBadgeContinue: () => void;
  badgeEarned: boolean;
  tmRewardName: string | null;
  gymId: string | null;
  gymRunId: string | null;
  towerRunId: string | null;
  gymType: string | null;
  gymName: string | null;
  gymLeaderName: string | null;
  gymBadgeName: string | null;
  leaderPortrait: string | null;
}) {
  const t = useTranslations("battle");
  const tUx = useTranslations("ux");
  const router = useRouter();
  const [confirmLeaveGym, setConfirmLeaveGym] = useState(false);
  void towerRunId;

  const idleLoss = outcome === "lost" && lossReason === "idle";

  const resultText =
    outcome === "won"
      ? t("resultWon")
      : outcome === "lost"
        ? idleLoss
          ? t("resultLostIdleTitle")
          : t("resultLostTitle")
        : outcome === "caught"
          ? t("caughtTitle")
          : outcome === "trainer_cleared"
            ? t("resultTrainerCleared")
            : t("resultFled");
  // Bajada en tipografía UI (no Grobold): detalles largos fuera del título display.
  const resultSubText =
    outcome === "lost"
      ? idleLoss
        ? t("resultLostIdle")
        : isTowerBattle
          ? t("resultLostTower")
          : t("resultLost")
      : outcome === "caught"
        ? caughtSentToPc
          ? t("resultCaughtPcDetail")
          : t("resultCaughtDetail")
        : null;
  const ctaPrimary =
    "ui-btn-primary w-full max-w-sm px-4 py-2.5 text-[14px] font-semibold";
  const ctaSecondary =
    "inline-flex w-full max-w-sm items-center justify-center rounded-lg border border-white/18 bg-transparent px-4 py-2.5 text-[14px] font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/6 hover:text-white";

  return (
    <BattleResult
      mode={outcome}
      lossReason={lossReason}
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
        <div className="mb-1 w-full max-w-sm rounded-xl border border-white/12 bg-white/4 px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            {t("pvpRating")}
          </p>
          <p className="font-mono text-headline-md text-electric-yellow">
            {pvpResult.ratingAfter}{" "}
            <span
              className={
                pvpResult.ratingAfter - pvpResult.ratingBefore >= 0
                  ? "text-emerald-400"
                  : "text-error"
              }
            >
              ({pvpResult.ratingAfter - pvpResult.ratingBefore >= 0 ? "+" : ""}
              {pvpResult.ratingAfter - pvpResult.ratingBefore})
            </span>
          </p>
          {pvpResult.coinsAwarded > 0 && (
            <p className="mt-1 text-[13px] text-white">
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
      {outcome === "lost" && isTowerBattle ? (
        <SoftLeaveButton href="/tower" className={ctaPrimary}>
          {t("backToTower")}
        </SoftLeaveButton>
      ) : outcome === "lost" && isPvpBattle ? (
        <SoftLeaveButton
          href={pvpResult ? `/pvp/${pvpResult.matchId}` : "/pvp"}
          className={ctaPrimary}
        >
          {t("backToPvp")}
        </SoftLeaveButton>
      ) : outcome === "lost" ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-2">
          <SoftLeaveButton href="/team" className={ctaPrimary}>
            {t("goHeal")}
          </SoftLeaveButton>
          <p className="text-center text-[12px] text-white/45">{tUx("postBattleHeal")}</p>
        </div>
      ) : outcome === "won" && isTowerBattle ? (
        <SoftLeaveButton href="/tower" className={ctaPrimary}>
          {t("backToTower")}
        </SoftLeaveButton>
      ) : outcome === "won" && isPvpBattle ? (
        <SoftLeaveButton
          href={pvpResult ? `/pvp/${pvpResult.matchId}` : "/pvp"}
          className={ctaPrimary}
        >
          {t("backToPvp")}
        </SoftLeaveButton>
      ) : outcome === "trainer_cleared" && gymId && gymRunId ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-2">
          <p className="text-center text-[13px] text-white/55">{t("advancePrompt")}</p>
          {!confirmLeaveGym ? (
            <>
              <SoftLeaveButton href={`/gyms/${gymId}/run`} className={ctaPrimary}>
                {t("continueChallenge")}
              </SoftLeaveButton>
              <button
                type="button"
                onClick={() => setConfirmLeaveGym(true)}
                className={ctaSecondary}
              >
                {t("leaveGym")}
              </button>
            </>
          ) : (
            <div className="flex w-full flex-col gap-2 rounded-2xl border border-error/35 bg-error/8 p-4 text-left">
              <p className="text-[13px] font-bold text-error">{t("leaveGymTitle")}</p>
              <p className="text-[12px] text-white/55">{t("leaveGymBody")}</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmLeaveGym(false)}
                  className={ctaPrimary}
                >
                  {t("continueChallenge")}
                </button>
                <SoftLeaveButton
                  className={ctaSecondary}
                  onAction={() => abandonGymRun(gymRunId, locale)}
                >
                  {t("confirmLeaveGym")}
                </SoftLeaveButton>
              </div>
            </div>
          )}
        </div>
      ) : isGymBattle ? (
        <SoftLeaveButton href="/gyms" className={ctaPrimary}>
          {t("backToGyms")}
        </SoftLeaveButton>
      ) : (
        <div className="flex w-full max-w-sm flex-col items-center gap-2">
          <SoftLeaveButton
            className={ctaPrimary}
            onAction={async () => {
              await startEncounter(locale);
              router.refresh();
            }}
          >
            {tUx("postBattleContinue")}
          </SoftLeaveButton>
          <SoftLeaveButton href="/campaign" className={ctaSecondary}>
            {tUx("postBattleJourney")}
          </SoftLeaveButton>
          {xpSummary?.some((e) => e.evolveOffer) ? (
            <SoftLeaveButton href="/team" className={ctaSecondary}>
              {tUx("postBattleEvolve")}
            </SoftLeaveButton>
          ) : null}
          <SoftLeaveButton href="/" className={ctaSecondary}>
            {t("backHome")}
          </SoftLeaveButton>
        </div>
      )}
    </BattleResult>
  );
}
