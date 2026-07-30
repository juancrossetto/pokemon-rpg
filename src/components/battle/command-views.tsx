"use client";

// Sub-vistas del panel de comandos: elegir poder, mochila y cambio de Pokémon.
// Son puramente de presentación — los handlers (que disparan el timeline de
// animaciones) siguen viviendo en battle-arena.tsx y entran por props.

import Image from "next/image";
import { useTranslations } from "next-intl";
import { typeColor } from "@/lib/type-colors";
import { formatMoveName } from "@/lib/format-move-name";
import { itemSpriteUrl } from "@/lib/item-sprites";
import type {
  BattleMoveOption,
  MoveCategory,
  PokeballStack,
  PotionStack,
  RosterMember,
} from "@/components/battle/arena-types";
import type { DamageForecast } from "@/lib/damage-forecast";
import { isSpreadMove } from "@/lib/move-target";

type MatchupInfo = { label: string; className: string };

/** Ícono por categoría, como el indicador físico/especial de Gen IV+. */
const CATEGORY_ICON: Record<MoveCategory, string> = {
  PHYSICAL: "sports_mma",
  SPECIAL: "auto_awesome",
  STATUS: "tune",
};

const CATEGORY_TONE: Record<MoveCategory, string> = {
  PHYSICAL: "text-orange-300",
  SPECIAL: "text-sky-300",
  STATUS: "text-white/60",
};

/**
 * Quién pega primero por velocidad. Vive en el panel de comandos y no sobre la
 * arena: ahí se pisaba con la placa de HP del rival en pantallas angostas, y
 * además este es el momento en que la info sirve.
 */
export function TurnOrderChip({ playerFirst }: { playerFirst: boolean }) {
  const t = useTranslations("battle");
  return (
    <span
      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
        playerFirst
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
          : "border-amber-400/40 bg-amber-500/15 text-amber-200"
      }`}
      title={t("turnOrderHint")}
    >
      {playerFirst ? t("youMoveFirst") : t("foeMovesFirst")}
    </span>
  );
}

function BackButton({
  disabled,
  onBack,
  label,
  small,
}: {
  disabled: boolean;
  onBack: () => void;
  label: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onBack}
      className={`flex items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 hover:bg-black/60 disabled:opacity-40 shrink-0 ${
        small ? "h-7 w-7 md:h-7 md:w-7" : "h-7 w-7 md:h-8 md:w-8"
      }`}
      aria-label={label}
    >
      <span className={`material-symbols-outlined ${small ? "text-[16px]!" : "text-[16px]! md:text-[18px]!"}`}>
        arrow_back
      </span>
    </button>
  );
}

export function MovesView({
  activePlayerName,
  moves,
  choiceLockMoveId,
  isAnimating,
  effectivenessInfo,
  playerFirst,
  forecast,
  onSelect,
  onBack,
}: {
  activePlayerName: string;
  moves: BattleMoveOption[];
  choiceLockMoveId: number | null;
  isAnimating: boolean;
  effectivenessInfo: (moveType: string) => MatchupInfo;
  playerFirst: boolean;
  /** Daño estimado vs el rival actual. null en movimientos de estado. */
  forecast: (move: BattleMoveOption) => DamageForecast | null;
  onSelect: (moveId: number) => void;
  onBack: () => void;
}) {
  const t = useTranslations("battle");

  return (
    <div className="flex flex-col gap-1 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
        <div className="min-w-0 flex items-center gap-2">
          <p className="text-xs md:text-sm font-bold text-primary capitalize truncate">{activePlayerName}</p>
          <TurnOrderChip playerFirst={playerFirst} />
        </div>
        <BackButton disabled={isAnimating} onBack={onBack} label={t("back")} small />
      </div>
      <p className="text-[10px] uppercase text-on-surface-variant tracking-wider px-0.5 shrink-0">
        {t("selectCommand")}
      </p>
      <div className="grid grid-cols-2 grid-rows-2 gap-1 md:gap-1.5 flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto md:overflow-hidden content-stretch">
        {moves.every((m) => m.pp <= 0) && (
          <button
            type="button"
            disabled={isAnimating}
            onClick={() => onSelect(moves[0]?.moveId ?? 0)}
            className="col-span-2 battle-move-card border-error/40"
          >
            <p className="text-base font-bold text-error">{t("struggleName")}</p>
            <p className="text-label-sm text-on-surface-variant mt-1">{t("struggleHint")}</p>
          </button>
        )}
        {moves.map((m) => {
          const eff = effectivenessInfo(m.type);
          const color = typeColor(m.type);
          const lockedOut = choiceLockMoveId != null && choiceLockMoveId !== m.moveId;
          const category = m.category;
          const isStatus = category === "STATUS";
          // Sin accuracy = nunca falla (Swift). Se dice, no se deja vacío.
          const accuracyLabel = m.accuracy == null ? "—" : `${m.accuracy}%`;
          const damage = isStatus ? null : forecast(m);
          return (
            <button
              key={m.moveId}
              type="button"
              disabled={isAnimating || m.pp <= 0 || lockedOut}
              onClick={() => onSelect(m.moveId)}
              className="battle-move-card battle-move-card-compact battle-move-card-dense text-left disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: `${color}55` }}
            >
              <div className="flex justify-between items-start gap-1 min-w-0 shrink-0">
                <span className="flex min-w-0 items-center gap-1">
                  <span
                    className={`material-symbols-outlined text-[13px]! shrink-0 ${CATEGORY_TONE[category]}`}
                    title={t(`category.${category}`)}
                    aria-label={t(`category.${category}`)}
                  >
                    {CATEGORY_ICON[category]}
                  </span>
                  <span className="text-xs md:text-sm font-bold text-white leading-tight truncate">
                    {formatMoveName(m.name)}
                    {isSpreadMove(m.target, m.name) ? (
                      <span className="ml-1 text-[9px] font-bold uppercase text-amber-200/90">
                        {t("spreadMoveTag")}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] uppercase font-bold tracking-wide border"
                  style={{ backgroundColor: `${color}33`, color, borderColor: `${color}66` }}
                >
                  {m.type}
                </span>
              </div>
              {/* Stats en una sola línea: antes eran 2 renglones (label+valor) y
                  empujaban la efectividad contra el borde con overflow:hidden. */}
              <div className="mt-auto flex items-baseline justify-between gap-1 shrink-0 text-[10px] md:text-[11px] tabular-nums">
                <span className="text-white/90">
                  <span className="text-white/40 uppercase tracking-wider mr-0.5">{t("powerLabel")}</span>
                  <span className="font-bold text-white">{m.power ?? "—"}</span>
                </span>
                <span className="text-white/90">
                  <span className="text-white/40 uppercase tracking-wider mr-0.5">{t("accuracyLabel")}</span>
                  <span className="font-bold">{accuracyLabel}</span>
                </span>
                <span className="text-white/90 flex items-center gap-0.5">
                  {lockedOut && (
                    <span className="material-symbols-outlined text-[12px]! text-amber-300">lock</span>
                  )}
                  <span className="text-white/40 uppercase tracking-wider mr-0.5">{t("ppLabel")}</span>
                  <span className="font-bold">
                    {m.pp}/{m.maxPp ?? m.pp}
                  </span>
                </span>
              </div>
              {damage?.guaranteedKo ? (
                <p className="text-[9px] md:text-[10px] leading-snug truncate shrink-0 font-bold text-tertiary">
                  {t("forecastKo")}
                </p>
              ) : (
                <p
                  className={`text-[9px] md:text-[10px] leading-snug truncate shrink-0 ${
                    isStatus ? "text-white/45" : eff.className
                  }`}
                >
                  {isStatus ? t("category.STATUS") : eff.label}
                  {damage && (
                    <span className="text-white/55">
                      {" · "}
                      {t("forecastRange", { min: damage.minPct, max: damage.maxPct })}
                    </span>
                  )}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BagView({
  isAnimating,
  showBalls,
  ballStacks,
  potionStacks,
  potionsDisabled,
  onThrowBall,
  onUsePotion,
  onBack,
}: {
  isAnimating: boolean;
  /** Las balls se ocultan contra entrenadores/gym/pvp aunque haya stock. */
  showBalls: boolean;
  ballStacks: PokeballStack[];
  potionStacks: PotionStack[];
  /** True cuando el activo está a HP lleno. */
  potionsDisabled: boolean;
  onThrowBall: (itemId: string, name: string) => void;
  onUsePotion: (itemId: string) => void;
  onBack: () => void;
}) {
  const t = useTranslations("battle");
  const hasBalls = showBalls && ballStacks.length > 0;
  const hasPotions = potionStacks.length > 0;

  return (
    <div className="flex flex-col gap-1 md:gap-2 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
        <div>
          <p className="text-xs md:text-sm font-bold text-primary">{t("bagTitle")}</p>
          <p className="text-[10px] md:text-label-sm uppercase text-on-surface-variant tracking-wider">
            {t("selectCommand")}
          </p>
        </div>
        <BackButton disabled={isAnimating} onBack={onBack} label={t("back")} />
      </div>
      <div className="flex flex-col gap-1.5 md:gap-2 flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
        {!hasBalls && !hasPotions && (
          <p className="text-label-md text-on-surface-variant text-center py-6">{t("bagEmpty")}</p>
        )}
        {hasBalls && (
          <div className="flex flex-col gap-2">
            <span className="text-label-sm uppercase text-on-surface-variant">{t("pokeballsLabel")}</span>
            {ballStacks.map((b) => (
              <button
                key={b.itemId}
                type="button"
                disabled={isAnimating}
                onClick={() => onThrowBall(b.itemId, b.name)}
                className="battle-bag-card disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Image
                  src={itemSpriteUrl(b.name)}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="w-8 h-8 object-contain [image-rendering:pixelated] shrink-0"
                />
                <span className="flex-1 text-left text-label-md text-on-surface font-bold">{b.name}</span>
                <span className="text-label-sm text-on-surface-variant tabular-nums">×{b.quantity}</span>
              </button>
            ))}
          </div>
        )}
        {hasPotions && (
          <div className="flex flex-col gap-2">
            <span className="text-label-sm uppercase text-on-surface-variant">{t("potionsLabel")}</span>
            {potionStacks.map((p) => (
              <button
                key={p.itemId}
                type="button"
                disabled={isAnimating || potionsDisabled}
                onClick={() => onUsePotion(p.itemId)}
                className="battle-bag-card disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Image
                  src={itemSpriteUrl(p.name)}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="w-8 h-8 object-contain [image-rendering:pixelated] shrink-0"
                />
                <div className="flex-1 text-left">
                  <p className="text-label-md text-on-surface font-bold">{p.name}</p>
                  <p className="text-label-sm text-on-surface-variant">+{p.healAmount} HP</p>
                </div>
                <span className="text-label-sm text-on-surface-variant tabular-nums">×{p.quantity}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TeamView({
  isAnimating,
  mustSwitch,
  roster,
  foeName,
  foeTypes,
  matchupInfo,
  onSwitch,
  onBack,
}: {
  isAnimating: boolean;
  mustSwitch: boolean;
  roster: RosterMember[];
  foeName: string;
  foeTypes: string[];
  matchupInfo: (types: string[]) => MatchupInfo;
  onSwitch: (member: RosterMember) => void;
  onBack: () => void;
}) {
  const t = useTranslations("battle");

  return (
    <div className="flex flex-col gap-1 md:gap-2 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
        <p className="text-xs md:text-sm font-bold text-primary">{t("pokemonMenu")}</p>
        {!mustSwitch && <BackButton disabled={isAnimating} onBack={onBack} label={t("back")} />}
      </div>
      {mustSwitch && (
        <p className="text-label-sm text-error text-center shrink-0">{t("mustSwitchPrompt")}</p>
      )}
      {/* Elegir a ciegas era el problema: el rival y sus tipos quedan a la vista
          mientras se decide, no solo en la placa de arriba. */}
      <div className="flex flex-wrap items-center gap-1 px-0.5 shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
          {t("switchAgainst", { name: foeName })}
        </span>
        {foeTypes.map((type) => {
          const color = typeColor(type);
          return (
            <span
              key={type}
              className="rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: `${color}33`, color, borderColor: `${color}66` }}
            >
              {type}
            </span>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5 md:gap-2 flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
        {roster.map((m) => {
          const fainted = m.currentHp <= 0;
          const hpPct = Math.max(0, Math.min(100, (m.currentHp / m.maxHp) * 100));
          const matchup = matchupInfo(m.types);
          return (
            <button
              key={m.instanceId}
              type="button"
              disabled={isAnimating || fainted}
              onClick={() => onSwitch(m)}
              className="battle-bag-card disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {m.spriteUrl && (
                <Image
                  src={m.spriteUrl}
                  alt={m.name}
                  width={40}
                  height={40}
                  className="w-10 h-10 object-contain"
                />
              )}
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-label-md text-on-surface font-bold capitalize truncate">
                    {m.name}
                  </span>
                  <span className="text-label-sm text-on-surface-variant shrink-0">
                    {t("level", { level: m.level })}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full health-bar-fill ${hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red"}`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span
                    className={`text-label-sm ${
                      fainted
                        ? "rounded bg-error/25 px-1 font-bold uppercase text-error"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {fainted ? t("fainted") : `${m.currentHp}/${m.maxHp}`}
                  </span>
                  {!fainted && (
                    <span className={`text-[10px] font-bold leading-tight truncate ${matchup.className}`}>
                      {matchup.label}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TargetView({
  moveName,
  moveType,
  foes,
  isAnimating,
  onSelect,
  onBack,
}: {
  moveName: string;
  /** Tipo del move (para el chip del encabezado). */
  moveType?: string | null;
  foes: {
    lane: "A" | "B";
    name: string;
    spriteUrl: string;
    currentHp: number;
    maxHp: number;
    fainted: boolean;
    types: string[];
    matchup: MatchupInfo;
    forecast: DamageForecast | null;
    isStatus: boolean;
  }[];
  isAnimating: boolean;
  onSelect: (lane: "A" | "B") => void;
  onBack: () => void;
}) {
  const t = useTranslations("battle");
  const typeChipColor = moveType ? typeColor(moveType) : null;
  return (
    <div className="flex flex-col gap-1 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
        <div className="min-w-0 flex items-center gap-1.5">
          <p className="text-xs md:text-sm font-bold text-primary truncate">
            {t("chooseTarget", { move: formatMoveName(moveName) })}
          </p>
          {moveType && typeChipColor && (
            <span
              className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide border"
              style={{
                backgroundColor: `${typeChipColor}33`,
                color: typeChipColor,
                borderColor: `${typeChipColor}66`,
              }}
            >
              {moveType}
            </span>
          )}
        </div>
        <BackButton disabled={isAnimating} onBack={onBack} label={t("back")} small />
      </div>
      <p className="text-[10px] uppercase text-on-surface-variant tracking-wider px-0.5 shrink-0">
        {t("selectTarget")}
      </p>
      <div className="grid grid-cols-2 gap-1 md:gap-1.5 flex-1 min-h-0">
        {foes.map((f) => {
          const hpPct = f.maxHp > 0 ? Math.max(0, (f.currentHp / f.maxHp) * 100) : 0;
          return (
            <button
              key={f.lane}
              type="button"
              disabled={isAnimating || f.fainted}
              onClick={() => onSelect(f.lane)}
              className="battle-move-card text-left disabled:opacity-40 disabled:cursor-not-allowed flex flex-col gap-1 p-2 min-h-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.spriteUrl}
                  alt=""
                  className={`w-11 h-11 object-contain shrink-0 ${f.fainted ? "grayscale opacity-50" : ""}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{f.name}</p>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {f.types.map((ty) => {
                      const c = typeColor(ty);
                      return (
                        <span
                          key={ty}
                          className="px-1 py-px rounded text-[8px] uppercase font-bold tracking-wide border"
                          style={{
                            backgroundColor: `${c}33`,
                            color: c,
                            borderColor: `${c}66`,
                          }}
                        >
                          {ty}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                <div
                  className={`h-full ${hpPct > 50 ? "bg-emerald-400" : hpPct > 20 ? "bg-amber-400" : "bg-error"}`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
              <div className="flex items-baseline justify-between gap-1 text-[10px] tabular-nums">
                <span className="text-on-surface-variant">
                  {f.fainted ? t("fainted") : `${f.currentHp}/${f.maxHp}`}
                </span>
              </div>
              {!f.fainted &&
                (f.forecast?.guaranteedKo ? (
                  <p className="text-[9px] md:text-[10px] leading-snug truncate font-bold text-tertiary">
                    {t("forecastKo")}
                  </p>
                ) : (
                  <p
                    className={`text-[9px] md:text-[10px] leading-snug truncate ${
                      f.isStatus ? "text-white/45" : f.matchup.className
                    }`}
                  >
                    {f.isStatus ? t("category.STATUS") : f.matchup.label}
                    {f.forecast && (
                      <span className="text-white/55">
                        {" · "}
                        {t("forecastRange", {
                          min: f.forecast.minPct,
                          max: f.forecast.maxPct,
                        })}
                      </span>
                    )}
                  </p>
                ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
