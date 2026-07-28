"use client";

// Sub-vistas del panel de comandos: elegir poder, mochila y cambio de Pokémon.
// Son puramente de presentación — los handlers (que disparan el timeline de
// animaciones) siguen viviendo en battle-arena.tsx y entran por props.

import Image from "next/image";
import { useTranslations } from "next-intl";
import { typeColor } from "@/lib/type-colors";
import { formatMoveName } from "@/lib/format-move-name";
import { itemSpriteUrl } from "@/lib/item-sprites";
import type { PokeballStack, PotionStack, RosterMember } from "@/components/battle/arena-types";

type MatchupInfo = { label: string; className: string };

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
  onSelect,
  onBack,
}: {
  activePlayerName: string;
  moves: { moveId: number; name: string; type: string; power?: number | null; pp: number; maxPp: number }[];
  choiceLockMoveId: number | null;
  isAnimating: boolean;
  effectivenessInfo: (moveType: string) => MatchupInfo;
  onSelect: (moveId: number) => void;
  onBack: () => void;
}) {
  const t = useTranslations("battle");

  return (
    <div className="flex flex-col gap-1 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
        <div className="min-w-0 flex items-baseline gap-2">
          <p className="text-xs md:text-sm font-bold text-primary capitalize truncate">{activePlayerName}</p>
          <p className="hidden md:block text-[10px] uppercase text-on-surface-variant tracking-wider shrink-0">
            {t("selectCommand")}
          </p>
        </div>
        <BackButton disabled={isAnimating} onBack={onBack} label={t("back")} small />
      </div>
      <p className="text-[10px] uppercase text-on-surface-variant tracking-wider px-0.5 shrink-0 md:hidden">
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
            <p className="text-base font-bold text-error">Struggle</p>
            <p className="text-label-sm text-on-surface-variant mt-1">PP 0 — recoil</p>
          </button>
        )}
        {moves.map((m) => {
          const eff = effectivenessInfo(m.type);
          const color = typeColor(m.type);
          const lockedOut = choiceLockMoveId != null && choiceLockMoveId !== m.moveId;
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
                <span className="text-xs md:text-sm font-bold text-white leading-tight truncate">{formatMoveName(m.name)}</span>
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] uppercase font-bold tracking-wide border"
                  style={{ backgroundColor: `${color}33`, color, borderColor: `${color}66` }}
                >
                  {m.type}
                </span>
              </div>
              <div className="mt-auto pt-1 flex justify-between items-end gap-1 shrink-0">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/45">{t("powerLabel")}</p>
                  <p className="text-[11px] md:text-xs text-white font-bold tabular-nums">
                    {m.power ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-wider text-white/45">{t("ppLabel")}</p>
                  <p className="text-[11px] md:text-xs text-white/90 font-bold tabular-nums flex items-center justify-end gap-1">
                    {lockedOut && (
                      <span className="material-symbols-outlined text-[14px]! text-amber-300">lock</span>
                    )}
                    {m.pp}/{m.maxPp ?? m.pp}
                  </p>
                </div>
              </div>
              <p className={`text-[9px] md:text-[10px] mt-0.5 leading-tight truncate shrink-0 ${eff.className}`}>
                {eff.label}
              </p>
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
  matchupInfo,
  onSwitch,
  onBack,
}: {
  isAnimating: boolean;
  mustSwitch: boolean;
  roster: RosterMember[];
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
                  <span className="text-label-sm text-on-surface-variant">
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
