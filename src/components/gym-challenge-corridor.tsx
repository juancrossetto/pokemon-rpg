"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { startGymRunBattle } from "@/actions/start-gym-run-battle";
import { GymRunExitButton } from "@/components/gym-run-exit-button";
import { showdownTrainerSpriteUrl } from "@/lib/avatars";
import { gymCorridorTheme } from "@/lib/gym-corridor-theme";
import { itemDisplayUrl } from "@/lib/item-sprites";
import { announceEnergyDelta } from "@/lib/resource-fx";
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
  heldRewardName: string | null;
  portraitUrl: string | null;
  leaderSpriteUrl: string | null;
  leaderTeam: CorridorTeamMember[];
  leaderDifficulty: number;
  trainers: CorridorTrainer[];
  clearedSlots: number;
  progressPct: number;
  energy: number;
  /** Costo de pelear contra un subordinado del pasillo. */
  trainerEnergyCost: number;
  /** Costo de pelear contra el líder — más caro que un subordinado. */
  leaderEnergyCost: number;
  energyError: boolean;
  leadError: boolean;
  labels: CorridorLabels;
};

const NODE = 44;
const COIN_ICON = "/items/hd/poke-coin.png";
const XP_ICON = "/ui/exp.png";
const ENERGY_ICON = "/items/hd/energy.png";

function RewardBits({
  coins,
  xp,
  prefix = "",
  tmName,
  heldName,
  className = "",
}: {
  coins?: number;
  xp?: number;
  prefix?: "+" | "";
  tmName?: string | null;
  heldName?: string | null;
  className?: string;
}) {
  const showCoins = typeof coins === "number" && coins > 0;
  const showXp = typeof xp === "number" && xp > 0;
  if (!showCoins && !showXp && !tmName && !heldName) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-semibold tabular-nums text-white/80 ${className}`}
    >
      {showCoins ? (
        <span className="inline-flex items-center gap-1">
          {prefix ? <span className="text-white/55">{prefix}</span> : null}
          <Image
            src={COIN_ICON}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 object-contain"
            unoptimized
          />
          {coins}
        </span>
      ) : null}
      {showXp ? (
        <span className="inline-flex items-center gap-1">
          {prefix ? <span className="text-white/55">{prefix}</span> : null}
          <Image
            src={XP_ICON}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 object-contain"
            unoptimized
          />
          {xp}
        </span>
      ) : null}
      {tmName ? (
        <span className="inline-flex items-center gap-1">
          <Image
            src={itemDisplayUrl(tmName)}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 object-contain"
            unoptimized
          />
          <span className="text-white/70">{tmName}</span>
        </span>
      ) : null}
      {heldName ? (
        <span className="inline-flex items-center gap-1">
          <Image
            src={itemDisplayUrl(heldName)}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 object-contain"
            unoptimized
          />
          <span className="text-white/70">{heldName}</span>
        </span>
      ) : null}
    </div>
  );
}

function DifficultyPips({ value, accent }: { value: number; accent?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full"
          style={{
            background:
              i < value ? (accent ?? "var(--color-pokeball-red)") : "rgba(255,255,255,0.15)",
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
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-[10px] text-white/35 ring-1 ring-white/10"
            >
              ?
            </span>
          );
        }
        return (
          <span
            key={`${m.name}-${m.level}`}
            className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-white/10"
            title={`${m.name} Lv.${m.level}`}
          >
            <Image
              src={uiSpriteUrl(m.spriteUrl)}
              alt={m.name}
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
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
    // Primer tick post-montaje: evita setState síncrono en el efecto.
    const boot = requestAnimationFrame(() => {
      setDisplay(start);
      requestAnimationFrame(() => setDisplay(pct));
    });
    sessionStorage.setItem(key, String(pct));
    return () => cancelAnimationFrame(boot);
  }, [pct]);

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full gym-corridor-progress-fill transition-[width] duration-500"
          style={{
            width: `${display}%`,
            background: `linear-gradient(90deg, ${accent}, var(--color-pokeball-red))`,
            boxShadow: `0 0 10px ${accent}66`,
          }}
        />
      </div>
      <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-white/55">
        {Math.round(display)}%
      </span>
    </div>
  );
}

/**
 * Slot que se despejó en la navegación anterior, para el pop de "recién
 * vencido". El valor previo vive en sessionStorage por el mismo motivo que en
 * `ProgressBar`: la página es un RSC que se remonta entero al volver del
 * combate, así que el componente no tiene memoria propia entre peleas.
 *
 * La clave va scopeada por corrida — con una global, entrar a otro gimnasio
 * con menos progreso disparaba el pop en el nodo equivocado.
 */
function useJustClearedSlot(gymRunId: string, clearedSlots: number): number | null {
  const [justCleared, setJustCleared] = useState<number | null>(null);

  useEffect(() => {
    const key = `gym-corridor-cleared:${gymRunId}`;
    const raw = sessionStorage.getItem(key);
    sessionStorage.setItem(key, String(clearedSlots));
    if (raw === null) return;
    const prev = Number(raw);
    if (!Number.isFinite(prev) || clearedSlots <= prev) return;
    // Primer tick post-montaje: evita setState síncrono en el efecto.
    const boot = requestAnimationFrame(() => setJustCleared(clearedSlots));
    return () => cancelAnimationFrame(boot);
  }, [gymRunId, clearedSlots]);

  return justCleared;
}

function CombatButton({
  label,
  energyCost,
  disabled,
}: {
  label: string;
  energyCost: number;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        announceEnergyDelta(-energyCost);
      }}
      className="game-cta game-cta--red gym-corridor-combat-btn mb-0! gap-2 disabled:pointer-events-none sm:gap-2.5"
    >
      <span className="game-cta__label">{label}</span>
      <span
        aria-hidden
        className="h-4 w-px shrink-0 bg-white/25"
      />
      <span className="inline-flex items-center gap-1 font-sans text-[13px] font-semibold tabular-nums tracking-normal text-white normal-case">
        <Image
          src={ENERGY_ICON}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
          unoptimized
        />
        <span>−{energyCost}</span>
      </span>
    </button>
  );
}

function PathNode({
  children,
  status,
  accent,
  size = NODE,
  className = "",
}: {
  children: ReactNode;
  status: "entry" | "cleared" | "active" | "locked" | "leader";
  accent: string;
  size?: number;
  /** Efecto puntual del nodo (ej. el pop de recién despejado). */
  className?: string;
}) {
  const isActive = status === "active";
  const isLit =
    status === "entry" || status === "cleared" || status === "active" || status === "leader";

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
      className={`relative z-10 flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-[#12141c] ${
        isActive ? "gym-corridor-node-pulse" : ""
      } ${className}`.trim()}
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

function StatusChip({
  label,
  tone,
  accent,
}: {
  label: string;
  tone: "active" | "cleared" | "locked";
  accent: string;
}) {
  const color =
    tone === "active"
      ? accent
      : tone === "cleared"
        ? "rgba(255,255,255,0.45)"
        : "rgba(255,255,255,0.28)";
  return (
    <span
      className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em]"
      style={{ color }}
    >
      {label}
    </span>
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
  heldRewardName,
  portraitUrl,
  leaderSpriteUrl,
  leaderTeam,
  trainers,
  clearedSlots,
  progressPct,
  energy,
  trainerEnergyCost,
  leaderEnergyCost,
  energyError,
  leadError,
  labels,
}: GymChallengeCorridorProps) {
  const theme = useMemo(() => gymCorridorTheme(gymType), [gymType]);
  const typeLabel = labels.typeLabels[gymType] ?? gymType;
  const leaderUnlocked = clearedSlots >= trainers.length;
  const totalRooms = trainers.length + 1;
  const roomIndex = Math.min(clearedSlots + 1, totalRooms);
  const totalPathNodes = trainers.length + 1;
  const pathFillPct = (Math.min(clearedSlots + 1, totalPathNodes) / totalPathNodes) * 100;
  const battleAction = startGymRunBattle.bind(null, gymRunId, locale);
  // Cada botón se banca su propio costo: el del subordinado se puede pagar con
  // una barra a la que ya no le alcanza para el líder.
  const canAffordTrainer = energy >= trainerEnergyCost;
  const canAffordLeader = energy >= leaderEnergyCost;
  const justCleared = useJustClearedSlot(gymRunId, clearedSlots);
  // Vencer al último subordinado destapa al líder: ese paso merece la revelación
  // completa (card + sprite saliendo de la silueta), no sólo dejar de estar gris.
  const leaderJustUnlocked = leaderUnlocked && justCleared === trainers.length;

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
    <div className="relative flex-1 overflow-x-clip">
      <AmbienceLayer
        particle={theme.particle}
        accent={theme.accent}
        fogOpacity={theme.fogOpacity}
      />

      <div className="relative z-10 px-3 py-4 sm:px-6 sm:py-6 xl:px-8">
        <div className="mx-auto w-full max-w-xl lg:max-w-2xl">
          <header className="mb-4 sm:mb-5">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary">
                  {labels.title}
                </p>
                <h1 className="page-title mt-1 truncate text-[1.45rem] leading-none tracking-tight text-white sm:text-[1.75rem]">
                  {gymName}
                </h1>
              </div>
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#12141c] sm:h-14 sm:w-14">
                <Image
                  src={badgeUrl}
                  alt={badgeName}
                  width={48}
                  height={48}
                  className="h-9 w-9 object-contain sm:h-10 sm:w-10"
                />
              </div>
            </div>
            <p className="mb-3 text-[12px] leading-snug text-white/50 sm:text-[13px]">
              {roomLabel}
              <span className="mx-1.5 text-white/20">·</span>
              <span style={{ color: theme.accent }}>{typeLabel}</span>
              <span className="mx-1.5 text-white/20">·</span>
              {leaderName}
            </p>
            <ProgressBar pct={progressPct} accent={theme.accent} />
          </header>

          <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 sm:px-3.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              {labels.finalReward}
            </p>
            <RewardBits
              coins={coinReward}
              tmName={tmRewardName}
              heldName={heldRewardName}
              className="text-[13px] text-white/90"
            />
            {accumulated.coins > 0 || accumulated.xp > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
                  {labels.accumulated}
                </span>
                <RewardBits
                  coins={accumulated.coins}
                  xp={accumulated.xp}
                  className="text-[11px] text-white/55"
                />
              </div>
            ) : null}
          </div>

          <p className="mb-4 flex items-start gap-1.5 text-[11px] leading-snug text-white/45 sm:mb-5">
            <span className="material-symbols-outlined mt-px shrink-0 text-[15px]! text-white/35">
              info
            </span>
            {labels.warning}
          </p>

          {energyError ? (
            <p className="mb-3 flex items-center gap-1.5 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-[12px] text-error">
              <span className="material-symbols-outlined text-[16px]!">bolt</span>
              {labels.noEnergy}
            </p>
          ) : null}
          {leadError ? (
            <p className="mb-3 flex items-center gap-1.5 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-[12px] text-error">
              <span className="material-symbols-outlined text-[16px]!">heart_broken</span>
              {labels.faintedLead}
            </p>
          ) : null}

          <div className="relative mb-6 sm:mb-8">
            <PathRail accent={theme.accent} fillPct={pathFillPct} />

            <div className="relative mb-3 flex items-center gap-3" style={{ minHeight: NODE }}>
              <PathNode status="entry" accent={theme.accent}>
                <span
                  className="material-symbols-outlined text-[18px]!"
                  style={{ color: theme.accent }}
                >
                  login
                </span>
              </PathNode>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                {labels.entry}
              </p>
            </div>

            {trainers.map((trainer) => {
              const isActive = trainer.status === "active";
              const isCleared = trainer.status === "cleared";
              const isLocked = trainer.status === "locked";
              // El que se acaba de vencer: pop del nodo + destello de la sala.
              const isJustCleared = trainer.slot === justCleared;

              return (
                <div key={trainer.id} className="relative mb-3 flex items-stretch gap-3">
                  <div className="flex flex-col items-center pt-2" style={{ width: NODE }}>
                    <PathNode
                      status={trainer.status}
                      accent={theme.accent}
                      className={isJustCleared ? "gym-corridor-node-cleared" : ""}
                    >
                      <Image
                        src={trainer.spriteUrl || showdownTrainerSpriteUrl("youngster")}
                        alt=""
                        width={36}
                        height={36}
                        className={`object-contain ${isLocked ? "opacity-40 grayscale" : ""} ${
                          isCleared ? "opacity-75" : ""
                        }`}
                        unoptimized
                      />
                    </PathNode>
                  </div>

                  <article
                    className={`min-w-0 flex-1 rounded-2xl border px-3 py-3 sm:px-3.5 ${
                      isActive
                        ? "gym-corridor-card-active bg-[#12141c]/90"
                        : isCleared
                          ? "gym-corridor-card-cleared border-white/8 bg-white/[0.02] opacity-75"
                          : "border-white/8 bg-white/[0.02] opacity-45"
                    } ${isJustCleared ? "gym-corridor-room-flash" : ""}`}
                    style={
                      isActive
                        ? {
                            borderColor: `${theme.accent}88`,
                            boxShadow: `0 0 22px ${theme.accent}20`,
                          }
                        : isCleared
                          ? { borderColor: `${theme.accent}33` }
                          : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/40">
                          {trainer.trainerClass}
                        </p>
                        <h2 className="mt-0.5 truncate text-[15px] font-semibold leading-tight text-white sm:text-[16px]">
                          {trainer.name}
                        </h2>
                      </div>
                      <StatusChip
                        label={
                          isCleared
                            ? labels.statusCleared
                            : isActive
                              ? labels.statusPending
                              : labels.statusLocked
                        }
                        tone={isCleared ? "cleared" : isActive ? "active" : "locked"}
                        accent={theme.accent}
                      />
                    </div>

                    {isCleared ? (
                      <RewardBits
                        coins={trainer.rewardCoins}
                        xp={trainer.rewardXp}
                        prefix="+"
                        className="mt-2 text-white/55"
                      />
                    ) : (
                      <div className="mt-2.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <TeamIcons team={trainer.team} reveal={!isLocked} />
                          {!isLocked ? (
                            <DifficultyPips value={trainer.difficulty} accent={theme.accent} />
                          ) : null}
                        </div>
                        {!isLocked ? (
                          <RewardBits
                            coins={trainer.rewardCoins}
                            xp={trainer.rewardXp}
                            className="text-white/55"
                          />
                        ) : null}
                        {isActive ? (
                          <form action={battleAction}>
                            <CombatButton
                              label={labels.initiateCombat}
                              energyCost={trainerEnergyCost}
                              disabled={!canAffordTrainer}
                            />
                          </form>
                        ) : null}
                      </div>
                    )}
                  </article>
                </div>
              );
            })}

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
                      width={36}
                      height={36}
                      className={`object-contain ${
                        leaderUnlocked ? "" : "gym-corridor-silhouette"
                      }`}
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[20px]! text-white/30">
                      military_tech
                    </span>
                  )}
                </PathNode>
              </div>

              <article
                className={`min-w-0 flex-1 rounded-2xl border px-3 py-3 sm:px-3.5 ${
                  leaderUnlocked
                    ? "gym-corridor-card-active bg-[#12141c]/90"
                    : "border-white/8 bg-black/30"
                } ${leaderJustUnlocked ? "gym-corridor-leader-card" : ""}`}
                style={
                  leaderUnlocked
                    ? {
                        borderColor: `${theme.accent}99`,
                        boxShadow: `0 0 24px ${theme.accent}24`,
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/40">
                      {labels.leader}
                    </p>
                    <h2
                      className={`mt-0.5 truncate text-[15px] font-semibold leading-tight sm:text-[16px] ${
                        leaderUnlocked ? "text-white" : "text-white/45"
                      }`}
                    >
                      {leaderUnlocked ? leaderName : labels.leaderUnknown}
                    </h2>
                  </div>
                  <StatusChip
                    label={leaderUnlocked ? labels.statusPending : labels.statusLocked}
                    tone={leaderUnlocked ? "active" : "locked"}
                    accent={theme.accent}
                  />
                </div>

                <div className="mt-2.5 space-y-2.5">
                  {leaderUnlocked ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <TeamIcons team={leaderTeam} reveal />
                        <DifficultyPips value={5} accent={theme.accent} />
                      </div>
                      <RewardBits
                        coins={coinReward}
                        tmName={tmRewardName}
                        heldName={heldRewardName}
                        className="text-white/55"
                      />
                      <form action={battleAction}>
                        <CombatButton
                          label={labels.initiateCombat}
                          energyCost={leaderEnergyCost}
                          disabled={!canAffordLeader}
                        />
                      </form>
                    </>
                  ) : (
                    <p className="text-[12px] leading-snug text-white/40">
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
