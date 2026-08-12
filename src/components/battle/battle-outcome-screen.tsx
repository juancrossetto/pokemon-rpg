"use client";

// Pantalla de fin de batalla: resultado, rating PvP, popup de medalla y los
// CTAs de salida (seguir gym / volver a curar / explorar de nuevo). El estado
// del confirm de abandono de gym vive acá porque nadie más lo necesita.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SoftLeaveButton, BattleResult } from "@/components/battle-result";
import { GymBadgePopup } from "@/components/gym-badge-popup";
import { PvpHubAnimPersist } from "@/components/pvp/pvp-hub-anim-persist";
import { startEncounter } from "@/actions/start-encounter";
import { abandonGymRun } from "@/actions/abandon-gym-run";
import type { GymFirstWinReward, XpSummaryEntry } from "@/actions/battle-move";
import type { Outcome } from "@/components/battle/arena-types";
import type { BattleHighlight } from "@/lib/battle-highlights";

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
  heldRewardName,
  gymFirstWin,
  gymId,
  gymRunId,
  towerRunId,
  gymType,
  gymName,
  gymLeaderName,
  gymBadgeName,
  leaderPortrait,
  highlights = [],
  farmStreak = 0,
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
  heldRewardName: string | null;
  /** Botín de la primera medalla; `null` en revancha. */
  gymFirstWin: GymFirstWinReward | null;
  gymId: string | null;
  gymRunId: string | null;
  towerRunId: string | null;
  gymType: string | null;
  gymName: string | null;
  gymLeaderName: string | null;
  gymBadgeName: string | null;
  leaderPortrait: string | null;
  highlights?: BattleHighlight[];
  farmStreak?: number;
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
    "ui-btn-primary w-full max-w-sm px-4 py-2.5 text-[14px] font-semibold sm:py-2.5";
  const ctaSecondary =
    "inline-flex w-full max-w-sm items-center justify-center rounded-lg border border-white/18 bg-transparent px-4 py-2 text-[13px] font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/6 hover:text-white sm:py-2.5 sm:text-[14px]";
  const ctaLink =
    "text-[12px] font-semibold text-white/55 underline-offset-2 transition hover:text-white/85 hover:underline sm:text-[13px]";

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
      coinsGained={
        coinsGained > 0 ? coinsGained : (pvpResult?.coinsAwarded ?? 0)
      }
      pvpRating={
        pvpResult && pvpResult.ratingBefore !== pvpResult.ratingAfter
          ? {
              before: pvpResult.ratingBefore,
              after: pvpResult.ratingAfter,
            }
          : null
      }
      highlights={highlights}
      farmStreak={farmStreak}
    >
      {isPvpBattle && pvpResult ? (
        <PvpHubAnimPersist
          ratingBefore={pvpResult.ratingBefore}
          ratingAfter={pvpResult.ratingAfter}
        />
      ) : null}
      {showBadgePopup && badgeEarned && gymType && (
        <GymBadgePopup
          gymType={gymType}
          gymName={gymName}
          leaderName={gymLeaderName}
          badgeName={gymBadgeName}
          portraitUrl={leaderPortrait}
          rewards={gymFirstWin}
          labels={{
            badgeEarned: t("badgeEarned"),
            rewardsTitle: t("rewardsTitle"),
            coins: t("coins"),
            tmEarned: tmRewardName ? t("tmEarned", { code: tmRewardName }) : null,
            heldEarned: heldRewardName ? t("heldEarned", { name: heldRewardName }) : null,
            avatarsEarned: gymFirstWin?.avatarSlugs.length
              ? t("avatarsEarned", { count: gymFirstWin.avatarSlugs.length })
              : null,
            avatarsHint: t("avatarsHint"),
            skip: t("badgeSkip"),
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
        <div className="flex w-full max-w-sm flex-col items-center gap-1.5 sm:gap-2">
          <SoftLeaveButton
            className={ctaPrimary}
            onAction={async () => {
              await startEncounter(locale);
              router.refresh();
            }}
          >
            {tUx("postBattleContinue")}
          </SoftLeaveButton>
          {/* Mobile: Viaje + Inicio en una fila de texto para no sumar 2 botones. */}
          <div className="flex w-full items-center justify-center gap-3 pt-0.5 sm:hidden">
            <SoftLeaveButton href="/campaign" className={ctaLink}>
              {tUx("postBattleJourney")}
            </SoftLeaveButton>
            <span className="text-white/25" aria-hidden>
              ·
            </span>
            <SoftLeaveButton href="/" className={ctaLink}>
              {t("backHome")}
            </SoftLeaveButton>
          </div>
          <div className="hidden w-full flex-col items-center gap-2 sm:flex">
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
          {xpSummary?.some((e) => e.evolveOffer) ? (
            <SoftLeaveButton href="/team" className={`${ctaLink} sm:hidden`}>
              {tUx("postBattleEvolve")}
            </SoftLeaveButton>
          ) : null}
        </div>
      )}
    </BattleResult>
  );
}
