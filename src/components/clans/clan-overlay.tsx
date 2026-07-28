"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Overlay in-tree (no createPortal) to avoid Turbopack/React DOM
 * insertBefore/removeChild races when mounting/unmounting into document.body.
 */
export function ClanOverlay({
  open,
  onClose,
  title,
  closeLabel,
  children,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      closeRef.current?.focus();
    });

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthClass =
    size === "xl" ? "sm:max-w-5xl" : size === "lg" ? "sm:max-w-4xl" : "sm:max-w-2xl";

  return (
    <div
      className="fixed inset-0 z-70 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#0b0d13]/98 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:max-h-[88vh] sm:rounded-2xl ${widthClass}`}
      >
        <div className="relative flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <span
            aria-hidden
            className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-white/20 sm:hidden"
          />
          <h2 id={titleId} className="text-headline-md text-on-surface">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]!">close</span>
          </button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
