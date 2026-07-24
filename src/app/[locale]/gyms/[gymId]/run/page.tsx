import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startGymRunBattle } from "@/actions/start-gym-run-battle";
import { GymRunExitButton } from "@/components/gym-run-exit-button";

export default async function GymRunPage({
  params,
}: {
  params: Promise<{ locale: string; gymId: string }>;
}) {
  const { locale, gymId } = await params;
  const [t, session] = await Promise.all([getTranslations("gyms"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  const run = await prisma.gymRun.findFirst({
    where: { userId, gymId, status: "ACTIVE" },
    include: { gym: { include: { trainers: { orderBy: { slot: "asc" } } } } },
  });
  if (!run) {
    redirect({ href: `/gyms/${gymId}`, locale });
    return null;
  }

  const activeBattle = await prisma.battleSession.findFirst({ where: { gymRunId: run.id, status: "ACTIVE" } });
  if (activeBattle) {
    redirect({ href: "/battle", locale });
    return null;
  }

  const { gym } = run;
  const totalSteps = gym.trainers.length + 1; // +1 = el líder
  const progressPct = Math.round((run.clearedTrainerSlots / totalSteps) * 100);
  const leaderUnlocked = run.clearedTrainerSlots >= gym.trainers.length;

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-headline-lg md:text-display-lg text-white mb-1">{t("corridorTitle")}</h1>
        <p className="text-label-md text-on-surface-variant mb-1">{t("corridorTarget", { name: gym.leaderName })}</p>
        <p className="text-label-sm text-on-surface-variant mb-4">{t("corridorProgress", { pct: progressPct })}</p>

        <div className="glass-panel border border-error/40 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-[22px] shrink-0">shield</span>
          <p className="text-label-md text-error">{t("corridorWarning")}</p>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          {gym.trainers.map((trainer) => {
            const cleared = trainer.slot <= run.clearedTrainerSlots;
            const current = trainer.slot === run.clearedTrainerSlots + 1;

            return (
              <div
                key={trainer.id}
                className={`glass-panel rounded-xl p-4 border ${
                  current ? "border-pokeball-red/60" : cleared ? "border-tertiary/40" : "border-white/10 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-label-sm text-on-surface-variant">{t("subordinate", { n: trainer.slot })}</p>
                    <h2 className="text-headline-md text-on-surface">{trainer.name}</h2>
                  </div>
                  <span
                    className={`flex items-center gap-1 text-label-sm ${
                      cleared ? "text-tertiary" : current ? "text-pokeball-red" : "text-on-surface-variant"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {cleared ? "check_circle" : current ? "swords" : "lock"}
                    </span>
                    {cleared ? t("statusCleared") : current ? t("statusPending") : t("statusLocked")}
                  </span>
                </div>

                {current && (
                  <form action={startGymRunBattle.bind(null, run.id, locale)} className="mt-3">
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-pokeball-red px-4 py-2.5 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">swords</span>
                      {t("initiateCombat")}
                    </button>
                  </form>
                )}
              </div>
            );
          })}

          <div
            className={`glass-panel rounded-xl p-4 border ${
              leaderUnlocked ? "border-tertiary/60" : "border-white/10 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-label-sm text-on-surface-variant">{t("leaderAnalysis")}</p>
                <h2 className="text-headline-md text-on-surface">{gym.leaderName}</h2>
              </div>
              <span
                className={`flex items-center gap-1 text-label-sm ${
                  leaderUnlocked ? "text-tertiary" : "text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{leaderUnlocked ? "military_tech" : "lock"}</span>
                {leaderUnlocked ? t("statusPending") : t("statusLocked")}
              </span>
            </div>

            {leaderUnlocked ? (
              <form action={startGymRunBattle.bind(null, run.id, locale)} className="mt-3">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-pokeball-red px-4 py-2.5 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">swords</span>
                  {t("initiateCombat")}
                </button>
              </form>
            ) : (
              <p className="text-label-sm text-on-surface-variant mt-2">{t("leaderLockedHint")}</p>
            )}
          </div>
        </div>

        <GymRunExitButton
          gymRunId={run.id}
          locale={locale}
          labels={{
            emergencyExit: t("emergencyExit"),
            warningTitle: t("warningTitle"),
            warningBody: t("warningBody"),
            confirmExit: t("confirmExit"),
            returnToChallenge: t("returnToChallenge"),
          }}
        />
      </div>
    </div>
  );
}
