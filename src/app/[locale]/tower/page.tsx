import { CdnImage as Image } from "@/components/cdn-image";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCombatLock } from "@/lib/battle-lock";
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
} from "@/lib/tower";
import { reconcileTowerPeriodAttempts } from "@/lib/tower/attempts";
import { nextTowerReset } from "@/lib/tower/week";
import { parsePendingLoot } from "@/lib/tower/settle";
import {
  TowerAbandonButton,
  TowerParkButton,
  TowerLockedState,
  TowerResumePanel,
} from "@/components/tower/tower-ui";
import {
  TowerActionBar,
  TowerAttemptsChip,
  TowerBlessingArrival,
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
import {
  TowerAutoControl,
  TowerAutoFlow,
} from "@/components/tower/tower-auto-flow";

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
  "busy",
] as const;

export default async function TowerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ err?: string; difficulty?: string }>;
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
  const [badgeCount, progressRows, activeRun, lastEndedRuns] = await Promise.all([
    prisma.badge.count({ where: { userId } }),
    prisma.towerProgress.findMany({
      where: { userId, towerId: DEFAULT_TOWER_ID },
    }),
    prisma.towerRun.findFirst({
      where: {
        userId,
        status: { in: ["ACTIVE", "AWAITING_BLESSING", "RESTING"] },
      },
    }),
    prisma.towerRun.findMany({
      where: {
        userId,
        status: { in: ["FAILED", "COMPLETED", "ABANDONED"] },
      },
      orderBy: [{ currentFloor: "desc" }, { endedAt: "desc" }],
      take: 12,
    }),
  ]);

  const normalProgress = progressRows.find(
    (row) => row.difficultyId === DEFAULT_DIFFICULTY_ID,
  );
  const expertUnlocked =
    (normalProgress?.highestFloorAllTime ?? 0) >= COMBAT_TOWER_CONFIG.totalFloors;
  const requestedDifficulty = query.difficulty === "expert" ? "expert" : DEFAULT_DIFFICULTY_ID;
  const difficultyId = activeRun?.difficultyId ??
    (requestedDifficulty === "expert" && expertUnlocked ? "expert" : DEFAULT_DIFFICULTY_ID);
  const progress = progressRows.find((row) => row.difficultyId === difficultyId) ?? null;
  const lastEndedRun = lastEndedRuns.find((row) => row.difficultyId === difficultyId) ?? null;

  /*
    Ascenso pausado: NO auto-reanudar. Antes, al abrir /tower (p. ej. el tab
    Aventura recuerda la última ruta) se despausaba solo, el combat-lock
    volvía a activarse y cualquier ida a /gyms rebotaba a la Torre.
  */
  const isParked = Boolean(activeRun?.parkedAt);
  const liveRun = activeRun && !isParked ? activeRun : null;

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
    runStatus: liveRun?.status ?? null,
    inBattle: false,
    currentFloor: liveRun?.currentFloor ?? 1,
    floor: liveRun ? floor : getTowerFloor(1),
    team: liveRun ? team : null,
  });

  const allFloors = getTowerFloors();
  /*
    Riel completo (piso 1 → total): el marco scrollea y auto-centra el actual.
    Una ventana corta impedía bajar al inicio o ver el tramo alto.
  */
  const pathFloors = allFloors;

  const err =
    query.err && (TOWER_ERRORS as readonly string[]).includes(query.err) ? query.err : null;

  const offered = liveRun
    ? resolveBlessings(liveRun.offeredBlessingIds)
    : [];

  const teamHpPct = team ? averageHpRatio(team) : 0;
  const canAttune = liveRun ? pickBlessingOffers(liveRun.blessingIds).length > 0 : false;
  const activeBlessings = activeRun
    ? resolveBlessings(activeRun.blessingIds).map((b) => ({
        id: b.id,
        name: t(b.nameKey),
      }))
    : [];

  const earnedLoot = activeRun
    ? parsePendingLoot(activeRun.pendingLoot).length > 0
      ? parsePendingLoot(activeRun.pendingLoot)
      : climbLoot(currentFloor, activeRun.towerId, activeRun.difficultyId)
    : [];
  const payout = activeRun
    ? nextFloorPayout(
        currentFloor,
        coinsBlessingMultiplier(activeRun.blessingIds),
        progress?.claimedFirstClears ?? [],
        activeRun.towerId,
        activeRun.difficultyId,
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
              : climbLoot(lastEndedRun.currentFloor, lastEndedRun.towerId, lastEndedRun.difficultyId),
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

  /*
    Sin corrida activa (recién llegado, o después de que un intento termina)
    es justo cuando hace falta el CTA: arrancar de nuevo, o el botón
    bloqueado con el countdown de reset si no quedan intentos. Antes exigía
    `Boolean(liveRun)` y ese caso —el más común— nunca montaba la barra.
  */
  const showActionBar =
    unlocked &&
    !isParked &&
    liveRun?.status !== "AWAITING_BLESSING" &&
    liveRun?.status !== "RESTING";
  const showResumeBar = unlocked && isParked;

  return (
    <main
      data-tower-page
      className="mx-auto flex w-full max-w-6xl flex-col gap-2.5 px-3 pt-3 pb-0 sm:gap-4 sm:pt-4 xl:px-6"
    >
      <header className="relative isolate overflow-hidden rounded-2xl border border-white/10">
        <div className="absolute inset-0">
          <Image
            src="/tower/torre-prisma.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1152px"
            className="object-cover object-[center_22%] sm:object-[center_30%]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#0b0d13] via-[#0b0d13]/60 to-[#0b0d13]/20"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#0b0d13]/50 via-transparent to-transparent"
            aria-hidden
          />
        </div>

        {unlocked ? (
          <div className="absolute right-2.5 top-2.5 z-20 flex items-center gap-2 sm:right-3.5 sm:top-3.5">
            <TowerAttemptsChip
              remaining={attemptsRemaining}
              max={attemptsMax}
              inProgress={Boolean(activeRun)}
            />
            <details className="relative">
              <summary
                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center text-secondary transition hover:brightness-125 marker:content-none [&::-webkit-details-marker]:hidden"
                aria-label={t("rules.title")}
                title={t("rules.title")}
              >
                <span className="material-symbols-outlined text-[20px]!">help</span>
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.4rem)] w-[min(18.5rem,calc(100vw-2rem))] rounded-xl border border-secondary/25 bg-[#12141c]/96 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                <p className="page-title mb-2 text-[10px] tracking-[0.16em] text-secondary">
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
          </div>
        ) : null}

        <div className="relative z-10 flex min-h-[9.25rem] flex-col justify-end gap-1 px-3.5 pb-3 pt-10 sm:min-h-[9rem] sm:px-5 sm:py-3.5 sm:pt-3.5">
          <div className="flex items-center gap-2">
            <Image
              src="/nav/tower-icon.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] sm:h-8 sm:w-8"
              unoptimized
            />
            <div className="min-w-0">
              <p className="page-title text-[10px] tracking-[0.18em] text-secondary">
                {t("eyebrow")}
                <span className="text-white/30"> · </span>
                <span className="text-white/55">{t(`difficulties.${difficultyId}`)}</span>
              </p>
              <h1 className="page-title mt-0.5 text-[1.35rem] leading-none tracking-tight text-white drop-shadow-sm sm:text-headline-md">
                {t(COMBAT_TOWER_CONFIG.nameKey)}
              </h1>
            </div>
          </div>
          <p className="hidden max-w-xl text-[13px] text-white/70 sm:block">{t("tagline")}</p>
          <nav className="mt-1 flex items-center gap-1.5" aria-label={t("difficulties.label")}>
            {activeRun ? (
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${difficultyId === "normal" ? "border-secondary/45 bg-secondary/15 text-secondary" : "border-white/10 bg-black/20 text-white/35"}`}>
                {t("difficulties.normal")}
              </span>
            ) : (
              <Link href="/tower?difficulty=normal" className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] transition ${difficultyId === "normal" ? "border-secondary/45 bg-secondary/15 text-secondary" : "border-white/15 bg-black/20 text-white/55 hover:text-white"}`}>
                {t("difficulties.normal")}
              </Link>
            )}
            {expertUnlocked && !activeRun ? (
              <Link href="/tower?difficulty=expert" className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] transition ${difficultyId === "expert" ? "border-fuchsia-300/45 bg-fuchsia-300/15 text-fuchsia-200" : "border-white/15 bg-black/20 text-white/55 hover:text-white"}`}>
                {t("difficulties.expert")}
              </Link>
            ) : (
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${difficultyId === "expert" ? "border-fuchsia-300/45 bg-fuchsia-300/15 text-fuchsia-200" : "border-white/10 bg-black/20 text-white/25"}`} title={expertUnlocked ? undefined : t("difficulties.expertLocked")}>
                {t("difficulties.expert")}
              </span>
            )}
            {difficultyId === "expert" ? <span className="ml-1 text-[9px] font-semibold text-fuchsia-200/70">{t("difficulties.expertRule")}</span> : null}
          </nav>
        </div>
      </header>

      {unlocked ? (
        <TowerAutoFlow
          runId={liveRun?.id ?? null}
          status={liveRun?.status ?? null}
          currentFloor={liveRun?.currentFloor ?? currentFloor}
          locale={locale}
          offeredBlessings={offered}
          teamHpPct={teamHpPct}
          canAttune={canAttune}
        />
      ) : null}

      {process.env.NODE_ENV === "development" ? <TowerDevPanel locale={locale} /> : null}

      {err ? (
        <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-label-sm text-error">
          {t(`errors.${err}`)}
        </p>
      ) : null}

      {!unlocked ? (
        <TowerLockedState
          minBadges={COMBAT_TOWER_CONFIG.unlock.minBadges}
          currentBadges={badgeCount}
        />
      ) : (
        <div className="grid gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-4">
          {/*
            Mobile: resumen → camino → squad/stats/acciones (+ descanso al final).
            Desktop: columna derecha única (status + panel) para no dejar hueco
            cuando no hay piso de descanso. `contents` aplana los hijos en el
            grid padre en mobile; en lg vuelve a ser un flex column.
          */}
          <div className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-3">
            {activeRun ? (
              <div className="order-1">
                <TowerRunStatus
                  earned={earnedLoot}
                  next={payout.bundle}
                  hasFirstClear={payout.hasFirstClear}
                  unitLabels={rewardUnitLabels}
                />
              </div>
            ) : endedSummary ? (
              <div className="order-1">
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

            {showResumeBar ? (
              <div className="order-2">
                <TowerResumePanel locale={locale} />
              </div>
            ) : null}

            {showActionBar ? (
              <div className="order-2 flex items-start gap-2 sm:gap-2.5">
                <div className="min-w-0 flex-1">
                  <TowerActionBar
                    action={primary}
                    locale={locale}
                    difficultyId={difficultyId}
                    resetAtMs={showResetTimer ? resetAt.getTime() : null}
                    canAbandon={Boolean(liveRun)}
                    canPark={Boolean(liveRun)}
                  />
                </div>
                <TowerAutoControl />
              </div>
            ) : null}

            <aside className="order-4 flex flex-col gap-2 sm:gap-3 lg:order-3">
              {team ? <TowerSquad team={team} blessings={activeBlessings} /> : null}

              <dl className="grid grid-cols-2 gap-3 px-0.5">
                <div>
                  <dt className="page-title text-[9px] tracking-[0.14em] text-white/40">
                    {t("summary.best")}
                  </dt>
                  <dd className="page-title mt-1 text-[1.45rem] leading-none tracking-[0.04em] text-secondary sm:text-[1.5rem]">
                    {progress?.highestFloorAllTime ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="page-title text-[9px] tracking-[0.14em] text-white/40">
                    {t("summary.nextBoss")}
                  </dt>
                  <dd className="page-title mt-1 text-[1.45rem] leading-none tracking-[0.04em] text-pokeball-red sm:text-[1.5rem]">
                    {nextGuardian ?? "—"}
                  </dd>
                </div>
              </dl>

              {liveRun && !showActionBar ? (
                <div className="flex flex-col gap-2">
                  <TowerParkButton locale={locale} variant="panel" />
                  <TowerAbandonButton locale={locale} variant="panel" />
                </div>
              ) : null}
            </aside>
          </div>

          <section className="relative order-3 isolate flex h-[min(46vh,22rem)] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0e1016] p-2 sm:h-[min(52vh,26rem)] sm:p-3 lg:col-start-1 lg:row-start-1 lg:order-none lg:h-auto lg:min-h-[min(68vh,34rem)] lg:max-h-[calc(100dvh-11rem)]">
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
            <p className="page-title relative z-10 mb-1 shrink-0 px-0.5 text-[9px] tracking-[0.16em] text-secondary sm:mb-1.5 sm:text-[10px]">
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
        </div>
      )}

      {unlocked && liveRun?.status === "RESTING" ? (
        <TowerRestFork
          locale={locale}
          recoveryPct={COMBAT_TOWER_CONFIG.rules.recoveryPercentage}
          canAttune={canAttune}
          teamHpPct={teamHpPct}
        />
      ) : null}

      {unlocked && liveRun?.status === "AWAITING_BLESSING" && offered.length > 0 ? (
        <TowerBlessingDraft blessings={offered} locale={locale} />
      ) : null}

      {liveRun && activeBlessings.length > 0 ? (
        <TowerBlessingArrival blessingIds={activeBlessings.map((b) => b.id)} />
      ) : null}
    </main>
  );
}
