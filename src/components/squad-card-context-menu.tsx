"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  togglePokemonFavorite,
  togglePokemonTradeLock,
} from "@/actions/pokemon-flags";

export type SquadContextLabels = {
  favoriteOn: string;
  favoriteOff: string;
  lockOn: string;
  lockOff: string;
  viewTeam: string;
  hint: string;
};

type MenuState = { x: number; y: number } | null;

/**
 * Click derecho (o botón ⋮) sobre una card del equipo: favorito, bloqueo de
 * venta e ir a Mi equipo. El click izquierdo en el hijo sigue navegando.
 */
export function SquadCardContextMenu({
  instanceId,
  isFavorite,
  isTradeLocked,
  labels,
  children,
}: {
  instanceId: string;
  isFavorite: boolean;
  isTradeLocked: boolean;
  labels: SquadContextLabels;
  children: ReactNode;
}) {
  const locale = useLocale();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [pending, startTransition] = useTransition();

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
    const mw = 220;
    const mh = 160;
    const x = Math.min(clientX, window.innerWidth - mw - pad);
    const y = Math.min(clientY, window.innerHeight - mh - pad);
    setMenu({ x: Math.max(pad, x), y: Math.max(pad, y) });
  }

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      setMenu(null);
      router.refresh();
    });
  }

  return (
    <div
      ref={rootRef}
      className="group relative"
      onContextMenu={(e) => {
        e.preventDefault();
        openAt(e.clientX, e.clientY);
      }}
    >
      {children}

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
        className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black/45 text-on-surface-variant opacity-0 backdrop-blur-sm transition hover:border-white/25 hover:text-white group-hover:opacity-100 focus:opacity-100"
      >
        <span className="material-symbols-outlined text-[16px]!">more_vert</span>
      </button>

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 min-w-[200px] overflow-hidden rounded-lg border border-white/12 bg-[#12161f]/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
          style={{ left: menu.x, top: menu.y }}
        >
          <MenuItem
            icon={isFavorite ? "star" : "star_outline"}
            label={isFavorite ? labels.favoriteOff : labels.favoriteOn}
            disabled={pending}
            onSelect={() => run(() => togglePokemonFavorite(instanceId, locale))}
          />
          <MenuItem
            icon={isTradeLocked ? "lock_open" : "lock"}
            label={isTradeLocked ? labels.lockOff : labels.lockOn}
            disabled={pending}
            onSelect={() => run(() => togglePokemonTradeLock(instanceId, locale))}
          />
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
        </div>
      )}
    </div>
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
