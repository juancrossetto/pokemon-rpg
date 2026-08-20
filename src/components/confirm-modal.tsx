"use client";

import { useEffect, useEffectEvent, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll } from "@/lib/scroll-lock";

/**
 * Confirmación centrada (mobile: bottom sheet). Sustituye window.confirm
 * en flujos del juego donde el diálogo nativo se siente fuera de lugar.
 */
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = "neutral",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "neutral" | "danger";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCancelEvent = useEffectEvent(onCancel);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancelEvent();
    }

    const releaseScroll = lockBodyScroll();
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
    };
  }, [open, pending, onCancelEvent]);

  if (!open || typeof document === "undefined") return null;

  const confirmClass =
    tone === "danger"
      ? "ui-btn-primary !bg-error hover:!brightness-110"
      : "ui-btn-primary";

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label={cancelLabel}
        disabled={pending}
        onClick={() => !pending && onCancel()}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm rounded-t-2xl border-t border-white/12 bg-[#0b0d13]/98 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl sm:rounded-2xl sm:border sm:pb-4"
      >
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`material-symbols-outlined text-[22px]! ${
              tone === "danger" ? "text-error" : "text-tertiary"
            }`}
            aria-hidden
          >
            {tone === "danger" ? "warning" : "help"}
          </span>
          <h2 id={titleId} className="text-label-md font-bold text-white">
            {title}
          </h2>
        </div>
        <p className="mt-2 text-label-sm leading-relaxed text-on-surface-variant">{body}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            data-autofocus
            disabled={pending}
            onClick={onConfirm}
            className={`min-h-11 w-full rounded-lg px-4 py-2.5 text-label-md font-bold transition-colors disabled:opacity-40 ${confirmClass}`}
          >
            {pending ? "…" : confirmLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="ui-btn-ghost min-h-11 w-full px-4 py-2.5 text-label-md disabled:opacity-40"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
