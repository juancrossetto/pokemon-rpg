"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { itemSpriteUrl } from "@/lib/item-sprites";
import { EMPTY_SQUAD_BAG, type SquadBagCounts } from "@/lib/squad-bag";
import {
  SquadItemFx,
  SquadLevelOffers,
  useSquadActions,
} from "@/components/use-squad-actions";

export type SquadContextLabels = {
  favoriteOn: string;
  favoriteOff: string;
  lockOn: string;
  lockOff: string;
  viewTeam: string;
  hint: string;
  heal: string;
  restorePp: string;
  rareCandy: string;
};

type MenuState = { x: number; y: number } | null;

/**
 * Click derecho (o botón ⋮) sobre una card del equipo / PC: curar, PP,
 * carameloraro, favorito, bloqueo. El click izquierdo en el hijo sigue libre.
 */
export function SquadCardContextMenu({
  instanceId,
  pokemonName,
  currentHp,
  maxHp,
  level,
  isFavorite,
  isTradeLocked,
  canHeal,
  canLevelUp = true,
  showFlags = true,
  showViewTeam = true,
  labels,
  bagCounts = EMPTY_SQUAD_BAG,
  onBagChange,
  onHealed,
  onLeveledUp,
  onPpRestored,
  onFlagsChange,
  children,
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
  showFlags?: boolean;
  showViewTeam?: boolean;
  labels: SquadContextLabels;
  bagCounts?: SquadBagCounts;
  onBagChange?: (next: SquadBagCounts) => void;
  onHealed?: (next: { currentHp: number; maxHp: number }) => void;
  onLeveledUp?: (next: { level: number; currentHp: number; maxHp: number }) => void;
  onPpRestored?: (next: {
    moveName: string;
    restoredBy: number;
    allMoves: boolean;
  }) => void;
  onFlagsChange?: (next: { isFavorite?: boolean; isTradeLocked?: boolean }) => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState>(null);

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
    onBeforeAction: () => setMenu(null),
    onBagChange,
    onHealed,
    onLeveledUp,
    onPpRestored,
    onFlagsChange,
  });
  const { counts, busy, feedback, toast, fx, fxMeta } = actions;

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    const onPointer = (e: MouseEvent | PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (rootRef.current?.contains(e.target as Node) && (e as MouseEvent).button === 2) return;
      setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [menu]);

  function openAt(clientX: number, clientY: number) {
    const pad = 8;
    const mw = 240;
    const mh = 320;
    const x = Math.min(clientX, window.innerWidth - mw - pad);
    const y = Math.min(clientY, window.innerHeight - mh - pad);
    actions.clearFeedback();
    setMenu({ x: Math.max(pad, x), y: Math.max(pad, y) });
  }

  return (
    <div
      ref={rootRef}
      className={`group relative h-full ${fx ? "squad-fx-pulse" : ""}`}
      style={
        fxMeta
          ? ({ "--squad-fx-glow": fxMeta.glow } as CSSProperties)
          : undefined
      }
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openAt(e.clientX, e.clientY);
      }}
    >
      {children}

      {fx && fxMeta ? (
        <SquadItemFx key={fx.key} kind={fx.kind} label={fx.label} meta={fxMeta} />
      ) : null}

      {toast ? (
        <p
          className={[
            "pointer-events-none absolute bottom-2 left-1/2 z-40 max-w-[90%] -translate-x-1/2 rounded-md px-2 py-1 text-center text-[10px] leading-snug shadow-lg",
            toast.kind === "error"
              ? "bg-error/90 text-white"
              : "bg-emerald-600/90 text-white",
          ].join(" ")}
          role="status"
        >
          {toast.text}
        </p>
      ) : null}

      <button
        type="button"
        aria-label={labels.hint}
        title={labels.hint}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
          openAt(rect.left, rect.bottom + 4);
        }}
        className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-on-surface-variant/80 opacity-90 backdrop-blur-md transition duration-200 hover:scale-105 hover:border-white/25 hover:bg-white/[0.12] hover:text-white hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-95"
      >
        <span className="material-symbols-outlined text-[17px]! leading-none">more_horiz</span>
      </button>

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 min-w-[220px] overflow-hidden rounded-lg border border-white/12 bg-[#12161f]/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
          style={{ left: menu.x, top: menu.y }}
        >
          <ConsumableMenuItem
            itemName={counts.healItemName}
            label={labels.heal}
            count={counts.heal}
            disabled={busy}
            onSelect={actions.heal}
          />
          <ConsumableMenuItem
            itemName={counts.ppItemName}
            label={labels.restorePp}
            count={counts.leppa}
            disabled={busy}
            onSelect={actions.restorePp}
          />
          <ConsumableMenuItem
            itemName="Rare Candy"
            label={labels.rareCandy}
            count={counts.rareCandy}
            disabled={busy}
            onSelect={actions.giveRareCandy}
          />
          {showFlags ? (
            <>
              <MenuItem
                icon={isFavorite ? "star" : "star_outline"}
                label={isFavorite ? labels.favoriteOff : labels.favoriteOn}
                disabled={busy}
                onSelect={actions.toggleFavorite}
              />
              <MenuItem
                icon={isTradeLocked ? "lock_open" : "lock"}
                label={isTradeLocked ? labels.lockOff : labels.lockOn}
                disabled={busy}
                onSelect={actions.toggleTradeLock}
              />
            </>
          ) : null}
          {showViewTeam ? (
            <>
              <div className="my-1 border-t border-white/8" />
              <Link
                href="/team"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-on-surface transition hover:bg-white/8"
                onClick={() => setMenu(null)}
              >
                <span className="material-symbols-outlined text-[18px]! text-on-surface-variant">
                  groups
                </span>
                {labels.viewTeam}
              </Link>
            </>
          ) : null}
          {feedback ? (
            <p
              className={[
                "mx-2 mb-1 mt-1 rounded-md px-2 py-1.5 text-[11px] leading-snug",
                feedback.kind === "error"
                  ? "bg-error/15 text-error"
                  : "bg-emerald-500/15 text-emerald-300",
              ].join(" ")}
              role="status"
            >
              {feedback.text}
            </p>
          ) : null}
        </div>
      )}
      {actions.levelOffers && (
        <SquadLevelOffers
          entries={actions.levelOffers}
          onSettled={actions.dismissLevelOffers}
        />
      )}
    </div>
  );
}

function ConsumableMenuItem({
  itemName,
  label,
  count,
  disabled,
  onSelect,
}: {
  itemName: string;
  label: string;
  count: number;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-on-surface transition hover:bg-white/8 disabled:opacity-50"
    >
      <Image
        src={itemSpriteUrl(itemName)}
        alt=""
        width={20}
        height={20}
        unoptimized
        className="h-5 w-5 shrink-0 object-contain [image-rendering:pixelated]"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={[
          "shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
          count > 0
            ? "bg-white/8 text-on-surface-variant"
            : "bg-error/15 text-error/80",
        ].join(" ")}
      >
        ×{count}
      </span>
    </button>
  );
}

function MenuItem({
  icon,
  label,
  disabled,
  onSelect,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-on-surface transition hover:bg-white/8 disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-[18px]! text-on-surface-variant">{icon}</span>
      {label}
    </button>
  );
}
