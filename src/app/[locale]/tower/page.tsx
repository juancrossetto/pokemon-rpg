import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCombatLock } from "@/lib/battle-lock";
import { lockUsers } from "@/lib/db-locks";
import {
  COMBAT_TOWER_CONFIG,
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_TOWER_ID,
  getNextTowerAction,
  getTowerFloor,
  isTowerUnlocked,
  parseTowerTeamSnapshot,
  resolveBlessings,
  getTowerFloors,
  resumeTowerRunInTx,
} from "@/lib/tower";
import { reconcileTowerPeriodAttempts } from "@/lib/tower/attempts";
import { nextTowerReset } from "@/lib/tower/week";
import { parsePendingLoot } from "@/lib/tower/settle";
import { TowerAbandonButton, TowerParkButton, TowerLockedState } from "@/components/tower/tower-ui";
import {
  TowerActionBar,
  TowerBlessingDraft,
  TowerClimbRail,
  TowerEndedSummary,
  TowerRestFork,
  TowerRunStatus,
  TowerSquad,
} from "@/components/tower/tower-climb";
import {
  averageHpRatio,
  coinsBlessingMultiplier,
  pickBlessingOffers,
} from "@/lib/tower/blessings";
import { climbLoot, nextFloorPayout } from "@/lib/tower/loot";
import { TowerDevPanel } from "@/components/tower/tower-dev-panel";

const TOWER_ERRORS = [
  "locked",
  "no_attempts",
  "no_team",
  "difficulty",
  "no_run",
  "rest_floor",
  "team_down",
  "no_enemy",
  "bad_blessing",
  "not_rest",
] as const;

export default async function TowerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [t, session] = await Promise.all([getTranslations("tower"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  const lock = await getCombatLock(userId);
  if (lock?.kind === "battle") {
    redirect({ href: "/battle", locale });
    return null;
  }
  if (lock?.kind === "gym") {
    redirect({ href: `/gyms/${lock.gymId}/run`, locale });
    return null;
  }

  const resetAt = nextTowerReset();
  /*
    Reconciliá antes de leer el hub: si un dayKey viejo dejó arrancar un
    segundo ascenso en el mismo período semanal, se cierra acá y el CTA
    vuelve a quedar bloqueado con timer.
  */
  const attemptState = await reconcileTowerPeriodAttempts(userId);
  let [badgeCount, progress, activeRun, lastEndedRun] = await Promise.all([
    prisma.badge.count({ where: { userId } }),
    prisma.towerProgress.findUnique({
      where: {
        userId_towerId_difficultyId: {
          userId,
          towerId: DEFAULT_TOWER_ID,
          difficultyId: DEFAULT_DIFFICULTY_ID,
        },
      },
    }),
    prisma.towerRun.findFirst({
      where: {
        userId,
        status: { in: ["ACTIVE", "AWAITING_BLESSING", "RESTING"] },
      },
    }),
    prisma.towerRun.findFirst({
      where: {
        userId,
        status: { in: ["FAILED", "COMPLETED", "ABANDONED"] },
      },
      orderBy: [{ currentFloor: "desc" }, { endedAt: "desc" }],
    }),
  ]);

  /*
    Auto-resume al abrir la Torre: mutar + redirect (no revalidatePath en
    render — Next lo rechaza). El siguiente request ve layout/navbar al día.
  */
  if (activeRun?.parkedAt) {
    const parkedId = activeRun.id;
    await prisma.$transaction(
      async (tx) => {
        await lockUsers(tx, userId);
        await resumeTowerRunInTx(tx, parkedId, userId);
      },
      { timeout: 20_000 },
    );
    redirect({ href: "/tower", locale });
    return null;
  }

  const unlocked = isTowerUnlocked(badgeCount);
  const attemptsMax = attemptState.attemptsMax;
  const attemptsRemaining = attemptState.attemptsRemaining;
  const team = activeRun ? parseTowerTeamSnapshot(activeRun.teamSnapshot) : null;

  /*
    Sin ascenso activo, el riel muestra el recorrido del último intento cerrado
    (no el piso 1 vacío): así se puede scrollear la torre y ver hasta dónde se llegó.
  */
  const pathFocusFloor =
    activeRun?.currentFloor ??
    (lastEndedRun && !activeRun ? lastEndedRun.currentFloor : 1);
  const currentFloor = activeRun?.currentFloor ?? pathFocusFloor;
  const floor = getTowerFloor(currentFloor);

  const primary = getNextTowerAction({
    unlocked,
    attemptsRemaining,
    runStatus: activeRun?.status ?? null,
    inBattle: false,
    currentFloor: activeRun?.currentFloor ?? 1,
    floor: activeRun ? floor : getTowerFloor(1),
    team,
  });

  const allFloors = getTowerFloors();
  /*
    Riel completo (piso 1 → total): el marco scrollea y auto-centra el actual.
    Una ventana corta impedía bajar al inicio o ver el tramo alto.
  */
  const pathFloors = allFloors;

  const err =
    query.err && (TOWER_ERRORS as readonly string[]).includes(query.err) ? query.err : null;

  const offered = activeRun
    ? resolveBlessings(activeRun.offeredBlessingIds)
    : [];

  const teamHpPct = team ? averageHpRatio(team) : 0;
  const canAttune = activeRun ? pickBlessingOffers(activeRun.blessingIds).length > 0 : false;
  const activeBlessingNames = activeRun
    ? resolveBlessings(activeRun.blessingIds).map((b) => t(b.nameKey))
    : [];

  const earnedLoot = activeRun
    ? parsePendingLoot(activeRun.pendingLoot).length > 0
      ? parsePendingLoot(activeRun.pendingLoot)
      : climbLoot(currentFloor, activeRun.towerId)
    : [];
  const payout = activeRun
    ? nextFloorPayout(
        currentFloor,
        coinsBlessingMultiplier(activeRun.blessingIds),
        progress?.claimedFirstClears ?? [],
        activeRun.towerId,
      )
    : { bundle: [], hasFirstClear: false };
  const rewardUnitLabels = {
    coins: t("loot.unitCoins"),
    energy: t("loot.unitEnergy"),
  };

  const endedPending =
    lastEndedRun && !activeRun ? parsePendingLoot(lastEndedRun.pendingLoot) : [];
  const endedSummary =
    !activeRun &&
    lastEndedRun &&
    (lastEndedRun.status === "FAILED" ||
      lastEndedRun.status === "COMPLETED" ||
      lastEndedRun.status === "ABANDONED")
      ? {
          kind: lastEndedRun.status as "FAILED" | "COMPLETED" | "ABANDONED",
          runId: lastEndedRun.id,
          floorReached: lastEndedRun.currentFloor,
          loot:
            endedPending.length > 0
              ? endedPending
              : climbLoot(lastEndedRun.currentFloor, lastEndedRun.towerId),
          /*
            Solo se puede reclamar lo que está en pendingLoot. Si el ascenso
            viejo ya acreditó piso a piso, pending queda vacío → sin botón.
          */
          canClaim: !lastEndedRun.lootClaimedAt && endedPending.length > 0,
          lootClaimed: Boolean(lastEndedRun.lootClaimedAt),
          alreadyGranted: !lastEndedRun.lootClaimedAt && endedPending.length === 0,
          team: parseTowerTeamSnapshot(lastEndedRun.teamSnapshot),
          runClearedThrough: Math.max(
            0,
            lastEndedRun.currentFloor - (lastEndedRun.status === "COMPLETED" ? 0 : 1),
          ),
        }
      : null;

  const railCurrentFloor = activeRun?.currentFloor ?? endedSummary?.floorReached ?? 1;
  const railHighestCleared = activeRun
    ? Math.max(0, activeRun.currentFloor - 1)
    : (endedSummary?.runClearedThrough ?? progress?.highestFloorAllTime ?? 0);
  const showResetTimer = attemptsRemaining <= 0 && !activeRun;

  const nextGuardian =
    allFloors.find(
      (f) => f.type === "boss" && f.floorNumber >= railCurrentFloor,
    )?.floorNumber ?? null;

  const showActionBar =
    unlocked &&
    activeRun?.status !== "AWAITING_BLESSING" &&
    activeRun?.status !== "RESTING";
  /*
    La action bar es fixed sobre el bottom nav (~timer + CTA + reason ≈ 9.5rem).
    El padding del main tiene que liberar esa franja; si no, stats/reglas quedan
    tapadas hasta scrollear “de más”.
  */
  const mainPadClass = showActionBar
    ? "pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+9.75rem+var(--vv-gap,0px))] xl:pb-36"
    : "pb-bottom-nav";

  return (
    <main className={`mx-auto flex w-full max-w-6xl flex-col gap-2.5 px-3 py-3 sm:gap-4 sm:py-4 xl:px-6 ${mainPadClass}`}>
      <header className="relative isolate rounded-xl border border-white/10 sm:rounded-2xl">
        <div className="absolute inset-0 overflow-hidden rounded-xl sm:rounded-2xl">
          <Image
            src="/tower/torre-prisma.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1152px"
            className="object-cover object-[center_35%]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#0b0d13] via-[#0b0d13]/75 to-[#0b0d13]/25"
            aria-hidden
          />
        </div>

        {unlocked ? (
          <details className="absolute right-2.5 top-2.5 z-20 sm:right-3.5 sm:top-3.5">
            <summary
              className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/80 backdrop-blur-sm transition hover:border-white/35 hover:bg-black/60 hover:text-white marker:content-none [&::-webkit-details-marker]:hidden"
              aria-label={t("rules.title")}
              title={t("rules.title")}
            >
              <span className="material-symbols-outlined text-[18px]!">info</span>
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.4rem)] w-[min(18.5rem,calc(100vw-2rem))] rounded-xl border border-white/12 bg-[#12141c]/96 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                {t("rules.title")}
              </p>
              <ul className="space-y-1.5 text-[12px] leading-snug text-white/65">
                <li>{t("rules.hp")}</li>
                <li>{t("rules.attempts", { n: attemptsMax })}</li>
                <li>{t("rules.boss")}</li>
                <li>{t("rules.blessings")}</li>
                <li>{t("rules.rest")}</li>
              </ul>
            </div>
          </details>
        ) : null}

        <div className="relative z-10 flex min-h-[8.5rem] flex-col justify-end gap-1 px-3.5 py-3 sm:min-h-[10rem] sm:px-5 sm:py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
            {t("eyebrow")}
          </p>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h1 className="page-title text-headline-sm text-white drop-shadow-sm sm:text-headline-md">
              {t(COMBAT_TOWER_CONFIG.nameKey)}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="rounded-full border border-white/25 bg-black/35 px-2.5 py-0.5 text-[10px] text-white/85 backdrop-blur-sm sm:px-3 sm:py-1 sm:text-label-sm">
                {t("difficulties.normal")}
              </span>
              {activeRun ? <TowerParkButton locale={locale} variant="header" /> : null}
            </div>
          </div>
          <p className="hidden max-w-xl text-label-md text-white/75 sm:block">{t("tagline")}</p>
        </div>
      </header>

      {err ? (
        <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-label-sm text-error">
          {t(`errors.${err}`)}
        </p>
      ) : null}

      {!unlocked ? (
        <TowerLockedState minBadges={COMBAT_TOWER_CONFIG.unlock.minBadges} />
      ) : (
        <div className="grid gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-stretch lg:gap-4">
          {/*
            Mobile: resumen compacto → camino (protagonista) → stats.
            Desktop: torre izquierda, panel derecho.
          */}
          {activeRun ? (
            <div className="order-1 flex flex-col gap-2 sm:gap-3 lg:col-start-2 lg:row-start-1">
              <TowerRunStatus
                earned={earnedLoot}
                next={payout.bundle}
                hasFirstClear={payout.hasFirstClear}
                unitLabels={rewardUnitLabels}
                attemptsRemaining={attemptsRemaining}
                attemptsMax={attemptsMax}
              />
              {activeRun.status === "RESTING" ? (
                <TowerRestFork
                  locale={locale}
                  recoveryPct={COMBAT_TOWER_CONFIG.rules.recoveryPercentage}
                  canAttune={canAttune}
                  teamHpPct={teamHpPct}
                />
              ) : null}
            </div>
          ) : endedSummary ? (
            <div className="order-1 lg:col-start-2 lg:row-start-1">
              <TowerEndedSummary
                kind={endedSummary.kind}
                runId={endedSummary.runId}
                locale={locale}
                floorReached={endedSummary.floorReached}
                loot={endedSummary.loot}
                canClaim={endedSummary.canClaim}
                lootClaimed={endedSummary.lootClaimed}
                alreadyGranted={endedSummary.alreadyGranted}
                team={endedSummary.team}
                unitLabels={rewardUnitLabels}
              />
            </div>
          ) : null}

          <section
            className={`relative order-2 isolate flex h-[min(46vh,22rem)] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0e1016] p-2 sm:h-[min(52vh,26rem)] sm:p-3 lg:col-start-1 lg:row-start-1 lg:h-auto lg:min-h-[min(68vh,34rem)] lg:max-h-[calc(100dvh-11rem)] ${
              activeRun || endedSummary ? "lg:row-span-2" : ""
            }`}
          >
            <Image
              src="/tower/torre-prisma.jpg"
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover object-top opacity-[0.12]"
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#0e1016]/30 via-[#0e1016]/85 to-[#0e1016]"
              aria-hidden
            />
            <p className="relative z-10 mb-1 shrink-0 px-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white/45 sm:mb-1.5 sm:text-[9px]">
              {endedSummary ? t("path.reviewTitle") : t("path.title")}
            </p>
            <div
              className="pointer-events-none absolute inset-x-2 top-7 z-20 h-4 bg-gradient-to-b from-[#0e1016] to-transparent sm:inset-x-3 sm:top-9 sm:h-5"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-2 bottom-2 z-20 h-5 rounded-b-xl bg-gradient-to-t from-[#0e1016] to-transparent sm:inset-x-3 sm:bottom-3 sm:h-7"
              aria-hidden
            />
            <div
              data-tower-rail-scroll
              className="no-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
            >
              <TowerClimbRail
                floors={pathFloors}
                currentFloor={railCurrentFloor}
                highestCleared={railHighestCleared}
                autoScroll
              />
            </div>
          </section>

          <aside
            className={`order-3 flex flex-col gap-2 sm:gap-3 lg:col-start-2 ${
              activeRun || endedSummary ? "lg:row-start-2" : "lg:row-start-1"
            }`}
          >
            {team ? <TowerSquad team={team} /> : null}

            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent px-3 py-2.5">
                <dt className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/40">
                  {t("summary.best")}
                </dt>
                <dd className="page-title mt-1 text-[1.35rem] leading-none tracking-[0.04em] text-electric-yellow sm:text-[1.5rem]">
                  {progress?.highestFloorAllTime ?? 0}
                </dd>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent px-3 py-2.5">
                <dt className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/40">
                  {t("summary.nextBoss")}
                </dt>
                <dd className="page-title mt-1 text-[1.35rem] leading-none tracking-[0.04em] text-pokeball-red sm:text-[1.5rem]">
                  {nextGuardian ?? "—"}
                </dd>
              </div>
            </dl>

            {activeRun ? (
              <div className="flex flex-col gap-2">
                <TowerParkButton locale={locale} variant="panel" />
                <TowerAbandonButton locale={locale} variant="panel" />
              </div>
            ) : null}
          </aside>
        </div>
      )}

      {unlocked && activeRun?.status === "AWAITING_BLESSING" && offered.length > 0 ? (
        <TowerBlessingDraft blessings={offered} locale={locale} />
      ) : null}

      {showActionBar ? (
        <TowerActionBar
          action={primary}
          locale={locale}
          activeBlessings={activeBlessingNames}
          resetAtMs={showResetTimer ? resetAt.getTime() : null}
          canAbandon={Boolean(activeRun)}
          canPark={Boolean(activeRun)}
        />
      ) : null}

      {process.env.NODE_ENV === "development" ? <TowerDevPanel locale={locale} /> : null}
    </main>
  );
}
