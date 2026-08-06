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
import {
  TeachTmPanel,
  type TeachTmLabels,
} from "@/components/teach-tm-panel";
import {
  HeldItemPanel,
  type HeldItemInfo,
  type HeldItemLabels,
  type OwnedHeldItem,
} from "@/components/held-item-panel";
import {
  RenamePokemonPanel,
  type RenameLabels,
} from "@/components/rename-pokemon-panel";
import type { TeamCompatibleTm, TeamMoveDetail } from "@/components/team-roster";

export type SquadContextLabels = {
  favoriteOn: string;
  favoriteOff: string;
  lockOn: string;
  lockOff: string;
  viewTeam: string;
  hint: string;
  heal: string;
  revive: string;
  restorePp: string;
  rareCandy: string;
  /** Depositar del equipo al PC. */
  depositToPc?: string;
  /** Tooltip / aviso: no se puede dejar el último del equipo. */
  depositLastBlocked?: string;
  /** Aviso: bloqueado con candado. */
  depositLockedBlocked?: string;
  teachTm?: string;
  heldItem?: string;
  rename?: string;
};

type MenuState = { x: number; y: number } | null;
type ManagePanel = "teach" | "held" | "rename" | null;

/**
 * Click derecho (o botón ⋮) sobre una card del equipo / PC: curar, PP,
 * carameloraro, favorito, bloqueo; en Mi equipo también MT y held item.
 * El click izquierdo en el hijo sigue libre.
 */
export function SquadCardContextMenu({
  instanceId,
  pokemonName,
  spriteUrl,
  speciesName,
  nickname,
  currentHp,
  maxHp,
  level,
  isFavorite,
  isTradeLocked,
  canHeal,
  canRevive = false,
  canLevelUp = true,
  showFlags = true,
  showViewTeam = true,
  triggerVariant = "default",
  triggerPosition,
  labels,
  bagCounts = EMPTY_SQUAD_BAG,
  moves,
  compatibleTms,
  heldItem,
  ownedHeldItems,
  teachLabels,
  heldLabels,
  renameLabels,
  coins = 0,
  initialTeachItemId = null,
  autoOpenTeach = false,
  onBagChange,
  onHealed,
  onLeveledUp,
  onPpRestored,
  onFlagsChange,
  onHeldChange,
  onNicknameChange,
  /** Si se pasa, muestra "Dejar en el PC". `canDepositToPc` deshabilita el último. */
  onDepositToPc,
  canDepositToPc = true,
  children,
}: {
  instanceId: string;
  pokemonName?: string;
  spriteUrl?: string | null;
  speciesName?: string;
  nickname?: string | null;
  currentHp?: number;
  maxHp?: number;
  level?: number;
  isFavorite: boolean;
  isTradeLocked: boolean;
  canHeal: boolean;
  canRevive?: boolean;
  canLevelUp?: boolean;
  showFlags?: boolean;
  showViewTeam?: boolean;
  /** `ghost` = ícono discreto (home strip); `default` = botón más visible. */
  triggerVariant?: "default" | "ghost";
  /**
   * Dónde se ancla el disparador. Se corre cuando la esquina ya está ocupada
   * —en la ficha de Home vive ahí el botón de cerrar, y los dos botones se
   * pisaban.
   */
  triggerPosition?: string;
  labels: SquadContextLabels;
  bagCounts?: SquadBagCounts;
  moves?: (TeamMoveDetail | null)[];
  compatibleTms?: TeamCompatibleTm[];
  heldItem?: HeldItemInfo | null;
  ownedHeldItems?: OwnedHeldItem[];
  teachLabels?: TeachTmLabels;
  heldLabels?: HeldItemLabels;
  renameLabels?: RenameLabels;
  coins?: number;
  initialTeachItemId?: string | null;
  /** Deep-link inventario → abrir panel de MT al montar. */
  autoOpenTeach?: boolean;
  onBagChange?: (next: SquadBagCounts) => void;
  onHealed?: (next: { currentHp: number; maxHp: number }) => void;
  onLeveledUp?: (next: { level: number; currentHp: number; maxHp: number }) => void;
  onPpRestored?: (next: {
    moveName: string;
    restoredBy: number;
    allMoves: boolean;
  }) => void;
  onFlagsChange?: (next: { isFavorite?: boolean; isTradeLocked?: boolean }) => void;
  onHeldChange?: (next: HeldItemInfo | null) => void;
  onNicknameChange?: (next: string | null) => void;
  onDepositToPc?: () => void;
  canDepositToPc?: boolean;
  children: ReactNode;
}) {
  const triggerAnchor =
    triggerPosition ?? (triggerVariant === "ghost" ? "right-0.5 top-0.5" : "right-1.5 top-1.5");
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [panel, setPanel] = useState<ManagePanel>(autoOpenTeach ? "teach" : null);
  const [depositNotice, setDepositNotice] = useState<string | null>(null);
  const canTeach = Boolean(moves && compatibleTms && teachLabels && labels.teachTm);
  const canHold = Boolean(ownedHeldItems && heldLabels && labels.heldItem);
  const canRename = Boolean(speciesName && renameLabels && labels.rename);

  const actions = useSquadActions({
    instanceId,
    pokemonName,
    currentHp,
    maxHp,
    level,
    isFavorite,
    isTradeLocked,
    canHeal,
    canRevive,
    canLevelUp,
    bagCounts,
    onBeforeAction: () => setMenu(null),
    onBagChange,
    onHealed,
    onLeveledUp,
    onPpRestored,
    onFlagsChange,
  });
  const { counts, busy, candyPending, feedback, toast, fx, fxMeta, levelOffers } =
    actions;

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (levelOffers) return;
        setMenu(null);
      }
    };
    const onPointer = (e: MouseEvent | PointerEvent) => {
      // Mientras el modal de level-up está arriba, un click en "Continuar"
      // no debe cerrar el ⋮ — hace falta para encadenar carameloraros.
      if (levelOffers) return;
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
  }, [menu, levelOffers]);

  function openAt(clientX: number, clientY: number) {
    const pad = 8;
    const mw = 240;
    const mh = 360;
    const x = Math.min(clientX, window.innerWidth - mw - pad);
    const y = Math.min(clientY, window.innerHeight - mh - pad);
    actions.clearFeedback();
    setDepositNotice(null);
    setMenu({ x: Math.max(pad, x), y: Math.max(pad, y) });
  }

  return (
    <div
      ref={rootRef}
      className={`group relative h-full shrink-0 ${fx ? "squad-fx-pulse" : ""}`}
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
        className={
          triggerVariant === "ghost"
            ? `absolute ${triggerAnchor} z-20 flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition duration-150 hover:bg-white/8 hover:text-white/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25 active:bg-white/12 active:text-white`
            : `absolute ${triggerAnchor} z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-[0_4px_12px_rgba(0,0,0,0.45)] backdrop-blur-md transition duration-200 hover:scale-105 hover:border-white/30 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 active:scale-95`
        }
      >
        <span
          className={`material-symbols-outlined leading-none ${
            triggerVariant === "ghost" ? "text-[15px]!" : "text-[17px]!"
          }`}
        >
          more_vert
        </span>
      </button>

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[90] min-w-[220px] overflow-hidden rounded-lg border border-white/12 bg-[#12161f]/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
          style={{ left: menu.x, top: menu.y }}
        >
          <ConsumableMenuItem
            itemName={counts.healItemName}
            label={labels.heal}
            count={counts.heal}
            disabled={busy || Boolean(levelOffers)}
            onSelect={actions.heal}
          />
          <ConsumableMenuItem
            itemName={counts.reviveItemName}
            label={labels.revive}
            count={counts.revive}
            disabled={busy || Boolean(levelOffers)}
            onSelect={actions.revive}
          />
          <ConsumableMenuItem
            itemName={counts.ppItemName}
            label={labels.restorePp}
            count={counts.leppa}
            disabled={busy || Boolean(levelOffers)}
            onSelect={actions.restorePp}
          />
          <ConsumableMenuItem
            itemName="Rare Candy"
            label={labels.rareCandy}
            count={counts.rareCandy}
            disabled={busy || candyPending || Boolean(levelOffers)}
            onSelect={actions.giveRareCandy}
          />
          {canTeach || canHold || canRename ? (
            <>
              <div className="my-1 border-t border-white/8" />
              {canRename ? (
                <MenuItem
                  icon="edit"
                  label={labels.rename!}
                  disabled={busy}
                  onSelect={() => {
                    setMenu(null);
                    setPanel("rename");
                  }}
                />
              ) : null}
              {canTeach ? (
                <MenuItem
                  icon="school"
                  label={labels.teachTm!}
                  disabled={busy}
                  onSelect={() => {
                    setMenu(null);
                    setPanel("teach");
                  }}
                />
              ) : null}
              {canHold ? (
                <MenuItem
                  icon="auto_awesome"
                  label={labels.heldItem!}
                  disabled={busy}
                  onSelect={() => {
                    setMenu(null);
                    setPanel("held");
                  }}
                />
              ) : null}
            </>
          ) : null}
          {showFlags ? (
            <>
              <div className="my-1 border-t border-white/8" />
              <MenuItem
                icon={isFavorite ? "star" : "star_outline"}
                iconClassName={
                  isFavorite
                    ? "ms-fill text-electric-yellow"
                    : "text-on-surface-variant"
                }
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
          {onDepositToPc && labels.depositToPc ? (
            <>
              <div className="my-1 border-t border-white/8" />
              <MenuItem
                imageSrc="/nav/pc-icon.png"
                label={labels.depositToPc}
                disabled={busy}
                onSelect={() => {
                  if (isTradeLocked) {
                    setDepositNotice(
                      labels.depositLockedBlocked ?? labels.depositToPc ?? null,
                    );
                    return;
                  }
                  if (!canDepositToPc) {
                    setDepositNotice(
                      labels.depositLastBlocked ?? labels.depositToPc ?? null,
                    );
                    return;
                  }
                  setMenu(null);
                  onDepositToPc();
                }}
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
          {depositNotice || feedback ? (
            <p
              className={[
                "mx-2 mb-1 mt-1 rounded-md px-2 py-1.5 text-[11px] leading-snug",
                depositNotice || feedback?.kind === "error"
                  ? "bg-error/15 text-error"
                  : "bg-emerald-500/15 text-emerald-300",
              ].join(" ")}
              role="status"
            >
              {depositNotice ?? feedback?.text}
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
      {panel === "teach" && canTeach && moves && compatibleTms && teachLabels ? (
        <TeachTmPanel
          instanceId={instanceId}
          pokemonName={pokemonName ?? ""}
          spriteUrl={spriteUrl}
          moves={moves}
          compatibleTms={compatibleTms}
          labels={teachLabels}
          initialTeachItemId={initialTeachItemId}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {panel === "held" && canHold && ownedHeldItems && heldLabels ? (
        <HeldItemPanel
          instanceId={instanceId}
          pokemonName={pokemonName ?? ""}
          heldItem={heldItem ?? null}
          ownedHeldItems={ownedHeldItems}
          labels={heldLabels}
          onClose={() => setPanel(null)}
          onHeldChange={onHeldChange}
        />
      ) : null}
      {panel === "rename" && canRename && speciesName && renameLabels ? (
        <RenamePokemonPanel
          instanceId={instanceId}
          speciesName={speciesName}
          nickname={nickname ?? null}
          coins={coins}
          labels={renameLabels}
          onClose={() => setPanel(null)}
          onRenamed={onNicknameChange}
        />
      ) : null}
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
  imageSrc,
  iconClassName = "text-on-surface-variant",
  label,
  disabled,
  title,
  onSelect,
}: {
  icon?: string;
  imageSrc?: string;
  iconClassName?: string;
  label: string;
  disabled?: boolean;
  title?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      onClick={onSelect}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-on-surface transition hover:bg-white/8 disabled:opacity-50"
    >
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          width={18}
          height={18}
          unoptimized
          className="h-[18px] w-[18px] shrink-0 object-contain"
        />
      ) : (
        <span className={`material-symbols-outlined text-[18px]! ${iconClassName}`}>
          {icon}
        </span>
      )}
      {label}
    </button>
  );
}
