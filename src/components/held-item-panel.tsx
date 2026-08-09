"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { equipHeldItem, unequipHeldItem } from "@/actions/equip-held-item";
import { itemHdIconUrl, itemSpriteUrl } from "@/lib/item-sprites";
import { lockBodyScroll } from "@/lib/scroll-lock";

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
  equipped: string;
  equipErrors: Record<string, string>;
};

const ACTION_BTN =
  "ui-btn-primary w-full rounded-lg px-3 py-2.5 text-center text-label-sm disabled:opacity-40";
const GHOST_BTN =
  "w-full rounded-lg border border-white/12 px-3 py-2.5 text-center text-label-sm text-on-surface-variant transition hover:border-white/25 hover:text-white disabled:opacity-40";

function itemIconSrc(name: string) {
  return itemHdIconUrl(name) ?? itemSpriteUrl(name);
}

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
    const releaseScroll = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
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
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <button
        type="button"
        aria-label={labels.close}
        onClick={onClose}
        className="absolute inset-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="held-item-panel-title"
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0e16] shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
      >
        <header className="relative shrink-0 border-b border-white/[0.07] px-4 pb-3 pt-3.5 pr-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            {labels.title}
          </p>
          <h2
            id="held-item-panel-title"
            className="mt-0.5 truncate text-base font-semibold capitalize leading-tight text-white"
          >
            {pokemonName}
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-on-surface-variant/80">
            {labels.hint}
          </p>

          <button
            type="button"
            aria-label={labels.close}
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/35 text-on-surface-variant transition hover:border-white/25 hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]!">close</span>
          </button>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5">
          {localHeld && !picking ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/35">
                    <Image
                      src={itemIconSrc(localHeld.name)}
                      alt=""
                      width={36}
                      height={36}
                      className="h-9 w-9 object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                      {labels.equipped}
                    </p>
                    <p className="mt-0.5 text-[15px] font-semibold text-white">
                      {localHeld.displayName}
                    </p>
                    {localHeld.effectText ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-on-surface-variant">
                        {localHeld.effectText}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={pending}
                  onClick={unequip}
                  className={`${ACTION_BTN} sm:flex-1`}
                >
                  {pending ? labels.equipping : labels.unequip}
                </button>
                {ownedHeldItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    className={`${GHOST_BTN} sm:flex-1`}
                  >
                    {labels.change}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {ownedHeldItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-8 text-center">
                  <p className="text-[12px] leading-relaxed text-on-surface-variant">
                    {labels.noneOwned}
                  </p>
                </div>
              ) : (
                ownedHeldItems.map((item) => {
                  const isCurrent = localHeld?.itemId === item.itemId;
                  return (
                    <div
                      key={item.itemId}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/35">
                          <Image
                            src={itemIconSrc(item.name)}
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 object-contain"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[15px] font-semibold leading-snug text-white">
                              {item.displayName}
                            </p>
                            <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">
                              ×{item.quantity}
                            </span>
                          </div>
                          {item.effectText ? (
                            <p className="mt-1 text-[12px] leading-relaxed text-on-surface-variant">
                              {item.effectText}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3">
                        {isCurrent ? (
                          <p className="rounded-lg border border-white/10 py-2.5 text-center text-[11px] font-semibold text-on-surface-variant">
                            {labels.equipped}
                          </p>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => equip(item.itemId)}
                            className={ACTION_BTN}
                          >
                            {pending ? labels.equipping : labels.change}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {localHeld ? (
                <button
                  type="button"
                  onClick={() => setPicking(false)}
                  className={GHOST_BTN}
                >
                  {labels.cancel}
                </button>
              ) : null}
            </div>
          )}

          {error ? (
            <p className="mt-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-[11px] text-error">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
