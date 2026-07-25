"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { itemSpriteUrl } from "@/lib/item-sprites";
import { EMPTY_SQUAD_BAG, type SquadBagCounts } from "@/lib/squad-bag";
import {
  SquadItemFx,
  SquadLevelOffers,
  useSquadActions,
} from "@/components/use-squad-actions";

export type SquadCareLabels = {
  heal: string;
  restorePp: string;
  rareCandy: string;
  favoriteOn: string;
  favoriteOff: string;
  lockOn: string;
  lockOff: string;
};

/**
 * Mismas acciones que el menú contextual de la card, pero como panel dentro de
 * la ficha del Pokémon.
 */
export function SquadCareActions({
  instanceId,
  pokemonName,
  currentHp,
  maxHp,
  level,
  isFavorite,
  isTradeLocked,
  canHeal,
  canLevelUp = true,
  bagCounts = EMPTY_SQUAD_BAG,
  labels,
  onBagChange,
  onHealed,
  onLeveledUp,
  onPpRestored,
  onFlagsChange,
  deferServerRefresh = false,
}: {
  instanceId: string;
  pokemonName?: string;
  currentHp?: number;
  maxHp?: number;
  level?: number;
  isFavorite: boolean;
  isTradeLocked: boolean;
  canHeal: boolean;
  canLevelUp?: boolean;
  bagCounts?: SquadBagCounts;
  labels: SquadCareLabels;
  deferServerRefresh?: boolean;
  onBagChange?: (next: SquadBagCounts) => void;
  onHealed?: (next: { currentHp: number; maxHp: number }) => void;
  onLeveledUp?: (next: { level: number; currentHp: number; maxHp: number }) => void;
  onPpRestored?: (next: { moveName: string; restoredBy: number; allMoves: boolean }) => void;
  onFlagsChange?: (next: { isFavorite?: boolean; isTradeLocked?: boolean }) => void;
}) {
  const tMenu = useTranslations("home.squadMenu");
  const actions = useSquadActions({
    instanceId,
    pokemonName,
    currentHp,
    maxHp,
    level,
    isFavorite,
    isTradeLocked,
    canHeal,
    canLevelUp,
    bagCounts,
    deferServerRefresh,
    onBagChange,
    onHealed,
    onLeveledUp,
    onPpRestored,
    onFlagsChange,
  });
  const { counts, busy, candyPending, feedback, toast, fx, fxMeta } = actions;

  return (
    <div
      className={`relative rounded-xl ${fx ? "squad-fx-pulse" : ""}`}
      style={fxMeta ? ({ "--squad-fx-glow": fxMeta.glow } as CSSProperties) : undefined}
    >
      <div className="grid grid-cols-3 gap-1.5">
        <ConsumableTile
          itemName={counts.healItemName}
          label={labels.heal}
          count={counts.heal}
          disabled={busy}
          onSelect={actions.heal}
        />
        <ConsumableTile
          itemName={counts.ppItemName}
          label={labels.restorePp}
          count={counts.leppa}
          disabled={busy}
          onSelect={actions.restorePp}
        />
        <ConsumableTile
          itemName="Rare Candy"
          label={candyPending ? `${labels.rareCandy}…` : labels.rareCandy}
          count={counts.rareCandy}
          disabled={busy}
          pending={candyPending}
          onSelect={actions.giveRareCandy}
        />
      </div>

      {candyPending ? (
        <p className="mt-2 rounded-md bg-tertiary/10 px-2 py-1.5 text-center text-[11px] leading-snug text-tertiary">
          {tMenu("resolvingLevelUp")}
        </p>
      ) : null}

      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <FlagTile
          icon={isFavorite ? "star" : "star_outline"}
          label={isFavorite ? labels.favoriteOff : labels.favoriteOn}
          active={isFavorite}
          disabled={busy}
          onSelect={actions.toggleFavorite}
        />
        <FlagTile
          icon={isTradeLocked ? "lock_open" : "lock"}
          label={isTradeLocked ? labels.lockOff : labels.lockOn}
          active={isTradeLocked}
          disabled={busy}
          onSelect={actions.toggleTradeLock}
        />
      </div>

      {feedback || toast ? (
        <p
          className={[
            "mt-2 rounded-md px-2 py-1.5 text-[11px] leading-snug",
            (feedback ?? toast)?.kind === "error"
              ? "bg-error/15 text-error"
              : "bg-emerald-500/15 text-emerald-300",
          ].join(" ")}
          role="status"
        >
          {(feedback ?? toast)?.text}
        </p>
      ) : null}

      {fx && fxMeta ? (
        <SquadItemFx key={fx.key} kind={fx.kind} label={fx.label} meta={fxMeta} />
      ) : null}

      {actions.levelOffers && (
        <SquadLevelOffers
          entries={actions.levelOffers}
          onSettled={actions.dismissLevelOffers}
        />
      )}
    </div>
  );
}

function ConsumableTile({
  itemName,
  label,
  count,
  disabled,
  pending,
  onSelect,
}: {
  itemName: string;
  label: string;
  count: number;
  disabled?: boolean;
  pending?: boolean;
  onSelect: () => void;
}) {
  const empty = count <= 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      title={label}
      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition disabled:opacity-40 ${
        pending
          ? "border-tertiary/45 bg-tertiary/10"
          : empty
            ? "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
            : "border-white/[0.08] bg-white/[0.04] hover:border-tertiary/45 hover:bg-white/[0.07]"
      }`}
    >
      <span className="relative">
        <Image
          src={itemSpriteUrl(itemName)}
          alt=""
          width={28}
          height={28}
          unoptimized
          className={`h-7 w-7 object-contain [image-rendering:pixelated] ${
            empty || pending ? "grayscale" : ""
          } ${pending ? "animate-pulse" : ""}`}
        />
        <span
          className={`absolute -bottom-1 -right-2 rounded-md px-1 font-mono text-[9px] tabular-nums ${
            empty ? "bg-error/20 text-error/80" : "bg-black/60 text-on-surface-variant"
          }`}
        >
          ×{count}
        </span>
      </span>
      <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-on-surface">
        {label}
      </span>
    </button>
  );
}

function FlagTile({
  icon,
  label,
  active,
  disabled,
  onSelect,
}: {
  icon: string;
  label: string;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left transition disabled:opacity-40 ${
        active
          ? "border-tertiary/35 bg-tertiary/10 hover:border-tertiary/60"
          : "border-white/[0.08] bg-white/[0.03] hover:border-white/20"
      }`}
    >
      <span
        className={`material-symbols-outlined text-[16px]! ${
          active ? "text-tertiary" : "text-on-surface-variant"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-on-surface">
        {label}
      </span>
    </button>
  );
}
