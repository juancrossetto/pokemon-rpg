"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { HandbookLink } from "@/components/handbook/handbook-trigger";

/**
 * Ayuda del comercio: sólo un botón `i` (sin fila).
 * Al tocarlo abre un popup con los tips del hub.
 */
export function TradeHelp() {
  const t = useTranslations("ux");
  const bullets = (t.raw("help.market") as string[]) ?? [];
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("helpTitle")}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/85 backdrop-blur-md transition hover:border-white/35 hover:bg-black/60 hover:text-white"
      >
        <span className="material-symbols-outlined text-[16px]!">info</span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4"
            role="presentation"
          >
            <button
              type="button"
              aria-label={t("coachGotIt")}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-10 w-full max-w-sm rounded-t-2xl border border-white/12 bg-[#0b0d13]/98 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_20px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:rounded-2xl sm:pb-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-electric-yellow">
                    {t("role.market")}
                  </p>
                  <h2
                    id={titleId}
                    className="mt-1 text-[15px] font-semibold leading-snug text-white"
                  >
                    {t("helpTitle")}
                  </h2>
                </div>
                <button
                  type="button"
                  data-autofocus
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/[0.06] hover:text-white"
                  aria-label={t("coachGotIt")}
                >
                  <span className="material-symbols-outlined text-[18px]!">close</span>
                </button>
              </div>

              <ul className="mt-3 space-y-2 text-label-sm text-on-surface-variant">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="mt-0.5 text-pokeball-red">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 border-t border-white/8 pt-3">
                <HandbookLink chapter="economy" />
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-4 w-full rounded-xl bg-pokeball-red px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-pokeball-red/90"
              >
                {t("coachGotIt")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
