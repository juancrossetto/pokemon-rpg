"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { startGymRunBattle } from "@/actions/start-gym-run-battle";
import { GymRunExitButton } from "@/components/gym-run-exit-button";
import { showdownTrainerSpriteUrl } from "@/lib/avatars";
import { gymCorridorTheme } from "@/lib/gym-corridor-theme";
import { uiSpriteUrl } from "@/lib/sprites";

export type CorridorTeamMember = {
  name: string;
  level: number;
  spriteUrl: string;
  types: string[];
};

export type CorridorTrainer = {
  id: string;
  slot: number;
  name: string;
  trainerClass: string;
  spriteUrl: string;
  status: "cleared" | "active" | "locked";
  difficulty: number;
  rewardCoins: number;
  rewardXp: number;
  team: CorridorTeamMember[];
};

export type CorridorLabels = {
  title: string;
  target: string;
  progress: string;
  warning: string;
  specialty: string;
  team: string;
  reward: string;
  status: string;
  nextChallenge: string;
  completed: string;
  noLosses: string;
  bonus: string;
  accumulated: string;
  coins: string;
  xp: string;
  finalReward: string;
  badge: string;
  leader: string;
  leaderUnknown: string;
  teamUnknown: string;
  leaderQuote: string;
  difficulty: string;
  initiateCombat: string;
  statusCleared: string;
  statusPending: string;
  statusLocked: string;
  leaderLockedHint: string;
  room: string;
  lastBeforeLeader: string;
  leaderChamber: string;
  entry: string;
  subordinate: string;
  energyCostHint: string;
  noEnergy: string;
  faintedLead: string;
  typeLabels: Record<string, string>;
  exit: {
    emergencyExit: string;
    warningTitle: string;
    warningBody: string;
    confirmExit: string;
    returnToChallenge: string;
  };
};

export type GymChallengeCorridorProps = {
  gymRunId: string;
  locale: string;
  gymName: string;
  leaderName: string;
  badgeName: string;
  gymType: string;
  badgeUrl: string;
  coinReward: number;
  tmRewardName: string | null;
  portraitUrl: string | null;
  leaderSpriteUrl: string | null;
  leaderTeam: CorridorTeamMember[];
  leaderDifficulty: number;
  trainers: CorridorTrainer[];
  clearedSlots: number;
  progressPct: number;
  energy: number;
  energyCost: number;
  canAffordBattle: boolean;
  energyError: boolean;
  leadError: boolean;
  labels: CorridorLabels;
};

const NODE = 48; // px — nodos alineados al mismo eje

function fmt(template: string, n: number) {
  return template.replace("{n}", String(n));
}

function DifficultyPips({ value, accent }: { value: number; accent?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full"
          style={{
            background: i < value ? (accent ?? "var(--color-pokeball-red)") : "rgba(255,255,255,0.15)",
            boxShadow: i < value && accent ? `0 0 4px ${accent}` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function TeamIcons({ team, reveal }: { team: CorridorTeamMember[]; reveal: boolean }) {
  const count = Math.min(Math.max(team.length, 1), 4);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }, (_, i) => {
        const m = team[i];
        if (!reveal || !m) {
          return (
            <span
              key={i}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/40 text-[10px] text-white/35"
            >
              ?
            </span>
          );
        }
        return (
          <span
            key={`${m.name}-${m.level}`}
            className="relative h-7 w-7 overflow-hidden rounded-full border border-white/10 bg-black/40"
            title={`${m.name} Lv.${m.level}`}
          >
            <Image
              src={uiSpriteUrl(m.spriteUrl)}
              alt={m.name}
              width={28}
              height={28}
              className="object-contain p-0.5"
              unoptimized
            />
          </span>
        );
      })}
    </div>
  );
}

function AmbienceLayer({
  particle,
  accent,
  fogOpacity,
}: {
  particle: string;
  accent: string;
  fogOpacity: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 45% at 50% -5%, ${accent}22, transparent 55%)`,
        }}
      />
      <div className="absolute inset-0 gym-corridor-vignette opacity-80" />
      <div
        className="absolute inset-x-0 top-0 h-40 gym-corridor-fog"
        style={{
          opacity: fogOpacity * 0.7,
          background: `linear-gradient(180deg, ${accent}18, transparent)`,
        }}
      />
      <div className={`gym-corridor-particles gym-corridor-particles--${particle} opacity-40`} />
    </div>
  );
}

function ProgressBar({ pct, accent }: { pct: number; accent: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const key = "gym-corridor-progress";
    const prev = Number(sessionStorage.getItem(key) ?? "0");
    const start = Number.isFinite(prev) ? Math.min(100, Math.max(0, prev)) : 0;
    setDisplay(start);
    const frame = requestAnimationFrame(() => setDisplay(pct));
    sessionStorage.setItem(key, String(pct));
    return () => cancelAnimationFrame(frame);
  }, [pct]);

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full gym-corridor-progress-fill"
          style={{
            width: `${display}%`,
            background: `linear-gradient(90deg, ${accent}, var(--color-pokeball-red))`,
            boxShadow: `0 0 10px ${accent}66`,
          }}
        />
      </div>
      <span className="text-label-sm tabular-nums text-on-surface-variant w-9 text-right">
        {Math.round(display)}%
      </span>
    </div>
  );
}

function CombatButton({
  label,
  costHint,
  disabled,
}: {
  label: string;
  costHint: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <button
        type="submit"
        disabled={disabled}
        className="gym-corridor-combat-btn game-cta game-cta--red group relative !mb-0 w-full overflow-hidden disabled:pointer-events-none"
      >
        <span className="absolute inset-0 gym-corridor-combat-sheen opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="relative z-10 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[18px]!">swords</span>
          {label}
        </span>
      </button>
      <p className="text-center text-label-sm text-on-surface-variant flex items-center justify-center gap-1">
        <span className="material-symbols-outlined text-[14px]! text-sky-400">bolt</span>
        {costHint}
      </p>
    </div>
  );
}

function PathNode({
  children,
  status,
  accent,
  size = NODE,
}: {
  children: ReactNode;
  status: "entry" | "cleared" | "active" | "locked" | "leader";
  accent: string;
  size?: number;
}) {
  const isActive = status === "active";
  const isLit = status === "entry" || status === "cleared" || status === "active" || status === "leader";

  let border = "rgba(255,255,255,0.12)";
  let boxShadow: string | undefined;
  if (isActive) {
    border = accent;
    boxShadow = `0 0 16px ${accent}99, 0 0 28px ${accent}44`;
  } else if (isLit) {
    border = `${accent}77`;
    boxShadow = `0 0 10px ${accent}40`;
  }

  return (
    <div
      className={`relative z-10 flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-surface-container-highest ${
        isActive ? "gym-corridor-node-pulse" : ""
      }`}
      style={{ width: size, height: size, borderColor: border, boxShadow }}
    >
      {children}
    </div>
  );
}

function PathRail({ accent, fillPct }: { accent: string; fillPct: number }) {
  const pct = Math.min(100, Math.max(0, fillPct));
  return (
    <div
      className="pointer-events-none absolute top-3 bottom-6"
      style={{ left: NODE / 2 - 1.5, width: 3 }}
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full" style={{ background: `${accent}1f` }} />
      <div
        className="absolute inset-x-0 top-0 overflow-hidden rounded-full gym-corridor-path-fill"
        style={{
          height: `${pct}%`,
          background: `linear-gradient(180deg, ${accent}, #ffffffcc 42%, ${accent})`,
          boxShadow: `0 0 6px ${accent}, 0 0 16px ${accent}bb, 0 0 32px ${accent}77`,
        }}
      >
        <div className="gym-corridor-path-sheen absolute inset-0" />
      </div>
      {pct > 2 && (
        <div
          className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full"
          style={{
            top: `calc(${pct}% - 5px)`,
            background: "#fff",
            boxShadow: `0 0 8px #fff, 0 0 18px ${accent}, 0 0 30px ${accent}`,
          }}
        />
      )}
    </div>
  );
}

export function GymChallengeCorridor({
  gymRunId,
  locale,
  gymName,
  leaderName,
  badgeName,
  gymType,
  badgeUrl,
  coinReward,
  tmRewardName,
  portraitUrl,
  leaderSpriteUrl,
  leaderTeam,
  trainers,
  clearedSlots,
  progressPct,
  canAffordBattle,
  energyError,
  leadError,
  labels,
}: GymChallengeCorridorProps) {
  const theme = useMemo(() => gymCorridorTheme(gymType), [gymType]);
  const typeLabel = labels.typeLabels[gymType] ?? gymType;
  const leaderUnlocked = clearedSlots >= trainers.length;
  const totalRooms = trainers.length + 1;
  const roomIndex = Math.min(clearedSlots + 1, totalRooms);
  // Nodos: entrada + trainers + líder. La línea llega hasta el desafío actual.
  const totalPathNodes = trainers.length + 1; // tramos desde entrada → líder
  const pathFillPct = (Math.min(clearedSlots + 1, totalPathNodes) / totalPathNodes) * 100;
  const battleAction = startGymRunBattle.bind(null, gymRunId, locale);

  const accumulated = useMemo(() => {
    let coins = 0;
    let xp = 0;
    for (const t of trainers) {
      if (t.status === "cleared") {
        coins += t.rewardCoins;
        xp += t.rewardXp;
      }
    }
    return { coins, xp };
  }, [trainers]);

  const roomLabel =
    roomIndex > trainers.length
      ? labels.leaderChamber
      : roomIndex === trainers.length
        ? labels.lastBeforeLeader
        : labels.room.replace("{n}", String(roomIndex)).replace("{total}", String(totalRooms));

  return (
    <div className="relative flex-1 overflow-hidden">
      <AmbienceLayer
        particle={theme.particle}
        accent={theme.accent}
        fogOpacity={theme.fogOpacity}
      />

      <div className="relative z-10 px-margin-mobile md:px-margin-desktop py-6">
        <div className="mx-auto max-w-xl">
          {/* Header compacto */}
          <header className="mb-4">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="min-w-0">
                <p className="text-label-sm tracking-[0.12em] uppercase text-on-surface-variant">
                  {labels.title}
                </p>
                <h1 className="page-title truncate text-headline-lg text-white">{gymName}</h1>
              </div>
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                <Image src={badgeUrl} alt={badgeName} width={44} height={44} className="object-contain p-1" />
              </div>
            </div>
            <p className="text-label-sm text-on-surface-variant mb-3">
              {roomLabel}
              <span className="text-white/25 mx-1.5">·</span>
              <span style={{ color: theme.accent }}>{typeLabel}</span>
              <span className="text-white/25 mx-1.5">·</span>
              {leaderName}
            </p>
            <ProgressBar pct={progressPct} accent={theme.accent} />
          </header>

          {/* Una sola franja de info */}
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5 text-label-sm text-on-surface-variant">
            <span>
              {labels.finalReward}:{" "}
              <span className="text-on-surface">{fmt(labels.coins, coinReward)}</span>
              {tmRewardName ? (
                <>
                  <span className="text-white/25 mx-1">·</span>
                  <span className="text-on-surface">{tmRewardName}</span>
                </>
              ) : null}
            </span>
            {(accumulated.coins > 0 || accumulated.xp > 0) && (
              <span>
                {labels.accumulated}:{" "}
                <span className="text-on-surface">{fmt(labels.coins, accumulated.coins)}</span>
                <span className="text-white/25 mx-1">·</span>
                <span className="text-on-surface">{fmt(labels.xp, accumulated.xp)}</span>
              </span>
            )}
          </div>

          <p className="mb-5 text-label-sm text-on-surface-variant/80 flex items-start gap-1.5">
            <span className="material-symbols-outlined text-[16px]! text-error/70 shrink-0 mt-px">
              info
            </span>
            {labels.warning}
          </p>

          {energyError && (
            <p className="mb-4 text-label-sm text-error flex items-center gap-1.5 rounded-lg border border-error/30 bg-error/10 px-3 py-2">
              <span className="material-symbols-outlined text-[16px]!">bolt</span>
              {labels.noEnergy}
            </p>
          )}
          {leadError && (
            <p className="mb-4 text-label-sm text-error flex items-center gap-1.5 rounded-lg border border-error/30 bg-error/10 px-3 py-2">
              <span className="material-symbols-outlined text-[16px]!">heart_broken</span>
              {labels.faintedLead}
            </p>
          )}

          {/* Camino alineado */}
          <div className="relative mb-8">
            <PathRail accent={theme.accent} fillPct={pathFillPct} />

            {/* Entrada */}
            <div className="relative mb-3 flex items-center gap-3" style={{ minHeight: NODE }}>
              <PathNode status="entry" accent={theme.accent}>
                <span
                  className="material-symbols-outlined text-[20px]!"
                  style={{ color: theme.accent }}
                >
                  login
                </span>
              </PathNode>
              <p className="text-label-sm uppercase tracking-[0.1em] text-on-surface-variant">
                {labels.entry}
              </p>
            </div>

            {trainers.map((trainer) => {
              const isActive = trainer.status === "active";
              const isCleared = trainer.status === "cleared";
              const isLocked = trainer.status === "locked";

              return (
                <div
                  key={trainer.id}
                  className="relative mb-3 flex items-stretch gap-3"
                >
                  <div className="flex flex-col items-center pt-2" style={{ width: NODE }}>
                    <PathNode status={trainer.status} accent={theme.accent}>
                      <Image
                        src={trainer.spriteUrl || showdownTrainerSpriteUrl("youngster")}
                        alt=""
                        width={40}
                        height={40}
                        className={`object-contain ${isLocked ? "opacity-40 grayscale" : ""} ${isCleared ? "opacity-75" : ""}`}
                        unoptimized
                      />
                    </PathNode>
                  </div>

                  <article
                    className={`flex-1 min-w-0 rounded-xl border px-3.5 py-3 transition-colors ${
                      isActive
                        ? "bg-white/[0.03]"
                        : isCleared
                          ? "border-white/8 bg-white/[0.02] opacity-70"
                          : "border-white/8 bg-white/[0.02] opacity-45"
                    }`}
                    style={
                      isActive
                        ? {
                            borderColor: `${theme.accent}88`,
                            boxShadow: `0 0 20px ${theme.accent}22`,
                          }
                        : isCleared
                          ? { borderColor: `${theme.accent}33` }
                          : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-label-sm text-on-surface-variant truncate">
                          {trainer.trainerClass}
                        </p>
                        <h2 className="text-base sm:text-lg text-on-surface truncate leading-tight">
                          {trainer.name}
                        </h2>
                      </div>
                      <span
                        className="shrink-0 text-label-sm"
                        style={{
                          color: isActive
                            ? theme.accent
                            : isCleared
                              ? "var(--color-on-surface-variant)"
                              : "rgba(255,255,255,0.35)",
                        }}
                      >
                        {isCleared
                          ? labels.statusCleared
                          : isActive
                            ? labels.statusPending
                            : labels.statusLocked}
                      </span>
                    </div>

                    {isCleared ? (
                      <p className="mt-1.5 text-label-sm text-on-surface-variant">
                        +{fmt(labels.coins, trainer.rewardCoins)}
                        <span className="text-white/20 mx-1">·</span>
                        +{fmt(labels.xp, trainer.rewardXp)}
                      </p>
                    ) : (
                      <div className="mt-2.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <TeamIcons team={trainer.team} reveal={!isLocked} />
                          {!isLocked && <DifficultyPips value={trainer.difficulty} accent={theme.accent} />}
                        </div>
                        {!isLocked && (
                          <p className="text-label-sm text-on-surface-variant">
                            {fmt(labels.coins, trainer.rewardCoins)}
                            <span className="text-white/20 mx-1">·</span>
                            {fmt(labels.xp, trainer.rewardXp)}
                          </p>
                        )}
                        {isActive && (
                          <form action={battleAction}>
                            <CombatButton
                              label={labels.initiateCombat}
                              costHint={labels.energyCostHint}
                              disabled={!canAffordBattle}
                            />
                          </form>
                        )}
                      </div>
                    )}
                  </article>
                </div>
              );
            })}

            {/* Líder */}
            <div className="relative flex items-stretch gap-3">
              <div className="flex flex-col items-center pt-2" style={{ width: NODE }}>
                <PathNode
                  status={leaderUnlocked ? "active" : "locked"}
                  accent={theme.accent}
                >
                  {leaderSpriteUrl || portraitUrl ? (
                    <Image
                      src={leaderSpriteUrl ?? portraitUrl!}
                      alt={leaderUnlocked ? leaderName : ""}
                      width={40}
                      height={40}
                      className={`object-contain ${leaderUnlocked ? "" : "gym-corridor-silhouette"}`}
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[22px]! text-white/30">
                      military_tech
                    </span>
                  )}
                </PathNode>
              </div>

              <article
                className={`flex-1 min-w-0 rounded-xl border px-3.5 py-3 ${
                  leaderUnlocked ? "bg-white/[0.03]" : "border-white/8 bg-black/30"
                }`}
                style={
                  leaderUnlocked
                    ? {
                        borderColor: `${theme.accent}99`,
                        boxShadow: `0 0 24px ${theme.accent}28`,
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-label-sm text-on-surface-variant">{labels.leader}</p>
                    <h2
                      className={`text-base sm:text-lg leading-tight truncate ${
                        leaderUnlocked ? "text-on-surface" : "text-on-surface/50"
                      }`}
                    >
                      {leaderUnlocked ? leaderName : labels.leaderUnknown}
                    </h2>
                  </div>
                  <span
                    className="shrink-0 text-label-sm"
                    style={{
                      color: leaderUnlocked ? theme.accent : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {leaderUnlocked ? labels.statusPending : labels.statusLocked}
                  </span>
                </div>

                <div className="mt-2.5 space-y-2.5">
                  {leaderUnlocked ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <TeamIcons team={leaderTeam} reveal />
                        <DifficultyPips value={5} accent={theme.accent} />
                      </div>
                      <p className="text-label-sm text-on-surface-variant">
                        {fmt(labels.coins, coinReward)}
                        {tmRewardName ? (
                          <>
                            <span className="text-white/20 mx-1">·</span>
                            {tmRewardName}
                          </>
                        ) : null}
                      </p>
                      <form action={battleAction}>
                        <CombatButton
                          label={labels.initiateCombat}
                          costHint={labels.energyCostHint}
                          disabled={!canAffordBattle}
                        />
                      </form>
                    </>
                  ) : (
                    <p className="text-label-sm text-on-surface-variant/70">
                      {labels.leaderLockedHint}
                    </p>
                  )}
                </div>
              </article>
            </div>
          </div>

          <GymRunExitButton gymRunId={gymRunId} locale={locale} labels={labels.exit} />
        </div>
      </div>
    </div>
  );
}
