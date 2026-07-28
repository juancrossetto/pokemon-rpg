"use client";

import { useEffect, useState } from "react";
import { APP_TOAST_EVENT, type AppToastDetail, type AppToastKind } from "@/lib/app-toast";

type Entry = AppToastDetail & { id: number };

const TOAST_MS = 2600;
const MAX_STACK = 3;

const KIND_STYLE: Record<AppToastKind, { border: string; icon: string; iconColor: string }> = {
  success: {
    border: "border-emerald-400/40",
    icon: "check_circle",
    iconColor: "text-emerald-400",
  },
  error: { border: "border-error/50", icon: "error", iconColor: "text-error" },
  info: { border: "border-white/15", icon: "info", iconColor: "text-on-surface-variant" },
};

let nextId = 1;

/**
 * Stack de toasts global (arriba en mobile para no pisar la bottom bar,
 * abajo a la derecha en desktop). Montado una sola vez en el layout.
 */
export function AppToastViewport() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<AppToastDetail>).detail;
      if (!detail?.message) return;
      const id = nextId++;
      setEntries((prev) => [...prev.slice(-(MAX_STACK - 1)), { ...detail, id }]);
      window.setTimeout(() => {
        setEntries((prev) => prev.filter((entry) => entry.id !== id));
      }, TOAST_MS);
    }
    window.addEventListener(APP_TOAST_EVENT, onToast);
    return () => window.removeEventListener(APP_TOAST_EVENT, onToast);
  }, []);

  if (entries.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:items-end"
    >
      {entries.map((entry) => {
        const style = KIND_STYLE[entry.kind];
        return (
          <div
            key={entry.id}
            className={`app-toast-in pointer-events-auto flex max-w-full items-center gap-2 rounded-xl border ${style.border} bg-[#0b0d13]/95 px-3.5 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:max-w-sm`}
          >
            <span
              aria-hidden
              className={`material-symbols-outlined shrink-0 text-[18px]! ${style.iconColor}`}
            >
              {style.icon}
            </span>
            <p className="min-w-0 text-label-sm leading-snug text-on-surface">{entry.message}</p>
          </div>
        );
      })}
    </div>
  );
}
