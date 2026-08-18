"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PokemonImage } from "@/components/pokemon-image";
import { lockBodyScroll } from "@/lib/scroll-lock";
import type { FriendTradePokemon } from "@/lib/friends";

export type FriendTradePickerLabels = {
  title: string;
  subtitle: string;
  empty: string;
  confirm: string;
  cancel: string;
  level: string;
};

/**
 * Elige un Pokémon de la PC para ofertar o responder un trueque 1:1.
 */
export function FriendTradePicker({
  open,
  pokemon,
  loading,
  pending,
  labels,
  onClose,
  onPick,
}: {
  open: boolean;
  pokemon: FriendTradePokemon[];
  loading: boolean;
  pending: boolean;
  labels: FriendTradePickerLabels;
  onClose: () => void;
  onPick: (instanceId: string) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const release = lockBodyScroll();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => {
      setSelected(null);
      panelRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      release();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={labels.cancel}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(36rem,88vh)] w-full max-w-md flex-col rounded-t-3xl border border-white/12 bg-[#10141c] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.55)] sm:rounded-3xl"
      >
        <h2 id={titleId} className="text-[15px] font-semibold text-white">
          {labels.title}
        </h2>
        <p className="mt-1 text-[12px] text-white/60">{labels.subtitle}</p>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-8 text-center text-[12px] text-white/45">{labels.confirm}…</p>
          ) : pokemon.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-white/55">{labels.empty}</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2">
              {pokemon.map((mon) => {
                const active = selected === mon.instanceId;
                return (
                  <li key={mon.instanceId}>
                    <button
                      type="button"
                      data-autofocus={pokemon[0]?.instanceId === mon.instanceId ? true : undefined}
                      disabled={pending}
                      onClick={() => setSelected(mon.instanceId)}
                      className={`flex w-full flex-col items-center rounded-xl border px-1 py-2 transition ${
                        active
                          ? "border-pokeball-red/60 bg-pokeball-red/12"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20"
                      }`}
                    >
                      <PokemonImage
                        src={mon.spriteUrl}
                        speciesName={mon.speciesName}
                        isShiny={mon.isShiny}
                        alt={mon.name}
                        width={56}
                        height={56}
                        className="h-12 w-12 object-contain"
                      />
                      <span className="mt-1 w-full truncate text-center text-[10px] font-semibold text-white">
                        {mon.name}
                      </span>
                      <span className="text-[9px] text-white/45">
                        {labels.level} {mon.level}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/12 py-2 text-[11px] font-bold uppercase tracking-wider text-white/70"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            disabled={!selected || pending || loading}
            onClick={() => selected && onPick(selected)}
            className="ui-btn-primary flex-1 rounded-xl py-2 text-[11px] font-bold uppercase tracking-wider disabled:opacity-40"
          >
            {labels.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
