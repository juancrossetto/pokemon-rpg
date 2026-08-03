"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { equipHeldItem, unequipHeldItem } from "@/actions/equip-held-item";

export type HeldItemInfo = {
  itemId: string;
  /** Nombre canónico del seed. */
  name: string;
  /** Etiqueta localizada (`Mineral Evolutivo`, …). */
  displayName: string;
  effectText: string | null;
};

export type OwnedHeldItem = HeldItemInfo & { quantity: number };

export type HeldItemLabels = {
  title: string;
  hint: string;
  change: string;
  noneOwned: string;
  unequip: string;
  equipping: string;
  cancel: string;
  close: string;
  equipErrors: Record<string, string>;
};

/**
 * Modal para equipar / quitar el objeto held. Abierto desde el menú ⋮.
 */
export function HeldItemPanel({
  instanceId,
  pokemonName,
  heldItem,
  ownedHeldItems,
  labels,
  onClose,
  onHeldChange,
}: {
  instanceId: string;
  pokemonName: string;
  heldItem: HeldItemInfo | null;
  ownedHeldItems: OwnedHeldItem[];
  labels: HeldItemLabels;
  onClose: () => void;
  onHeldChange?: (next: HeldItemInfo | null) => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [picking, setPicking] = useState(!heldItem);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localHeld, setLocalHeld] = useState(heldItem);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function equip(itemId: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await equipHeldItem(instanceId, itemId, locale);
      if (!result.ok) {
        setError(labels.equipErrors[result.error] ?? result.error);
        return;
      }
      const next = ownedHeldItems.find((i) => i.itemId === itemId) ?? null;
      const held = next
        ? {
            itemId: next.itemId,
            name: next.name,
            displayName: next.displayName,
            effectText: next.effectText,
          }
        : null;
      setLocalHeld(held);
      setPicking(false);
      onHeldChange?.(held);
      router.refresh();
    });
  }

  function unequip() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await unequipHeldItem(instanceId, locale);
      if (!result.ok) {
        setError(labels.equipErrors[result.error] ?? result.error);
        return;
      }
      setLocalHeld(null);
      setPicking(true);
      onHeldChange?.(null);
      router.refresh();
    });
  }

  const overlay = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 p-4 backdrop-blur-md sm:items-center">
      <button type="button" aria-label={labels.close} onClick={onClose} className="absolute inset-0" />
      <div className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0e16]/96 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        <header className="relative shrink-0 border-b border-white/[0.06] px-4 py-3 pr-12">
          <h2 className="truncate text-base font-semibold capitalize text-white">{pokemonName}</h2>
          <p className="text-[11px] text-on-surface-variant">{labels.title}</p>
          <button
            type="button"
            aria-label={labels.close}
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-on-surface-variant transition hover:border-white/25 hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]!">close</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <p className="mb-3 text-[10px] text-on-surface-variant/70">{labels.hint}</p>

          {localHeld && !picking ? (
            <div className="rounded-lg border border-tertiary/25 bg-tertiary/10 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]! text-tertiary">
                  auto_awesome
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-on-surface">
                    {localHeld.displayName}
                  </p>
                  {localHeld.effectText && (
                    <p className="mt-0.5 text-[11px] leading-snug text-on-surface-variant">
                      {localHeld.effectText}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={unequip}
                  className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-on-surface-variant transition hover:border-white/25 disabled:opacity-40"
                >
                  {pending ? labels.equipping : labels.unequip}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="mt-2 w-full rounded-md border border-dashed border-white/10 py-1.5 text-[10px] font-semibold text-on-surface-variant/70 transition hover:border-white/25 hover:text-on-surface-variant"
              >
                {labels.change}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              {ownedHeldItems.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-on-surface-variant/60">
                  {labels.noneOwned}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {ownedHeldItems.map((item) => (
                    <button
                      key={item.itemId}
                      type="button"
                      disabled={pending}
                      onClick={() => equip(item.itemId)}
                      className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-left transition hover:border-tertiary/50 disabled:opacity-40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium text-on-surface">
                          {item.displayName}
                        </p>
                        {item.effectText && (
                          <p className="truncate text-[9px] text-on-surface-variant">
                            {item.effectText}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">
                        x{item.quantity}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {localHeld && (
                <button
                  type="button"
                  onClick={() => setPicking(false)}
                  className="mt-2 w-full rounded-md border border-white/10 py-1 text-[10px] font-semibold text-on-surface-variant transition hover:border-white/25"
                >
                  {labels.cancel}
                </button>
              )}
            </div>
          )}

          {error && <p className="mt-2 text-[11px] text-error">{error}</p>}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
