"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { hasSeen, markSeen, type FirstVisitKey } from "@/lib/journey-ux";

/** Panel colapsable "¿Qué puedo hacer acá?" para hubs densos. */
export function HubHelpPanel({
  storageKey,
  bullets,
  titleKey = "helpTitle",
}: {
  storageKey: FirstVisitKey;
  bullets: string[];
  titleKey?: string;
}) {
  const t = useTranslations("ux");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Primera visita: abierto. Después queda cerrado por defecto.
    if (!hasSeen(storageKey)) {
      setOpen(true);
      markSeen(storageKey);
    }
  }, [storageKey]);

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-label-sm font-semibold text-on-surface"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[18px]! text-electric-yellow">help</span>
        <span className="flex-1">{t(titleKey)}</span>
        <span
          className={`material-symbols-outlined text-[18px]! text-on-surface-variant transition ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <ul className="space-y-1.5 border-t border-white/10 px-3.5 py-3 text-label-sm text-on-surface-variant">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-0.5 text-pokeball-red">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Onboarding de 3 pasos (Viaje → Explorar → Gimnasio), una sola vez. */
export function JourneyOnboarding({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  const t = useTranslations("ux");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasSeen("journey-onboarding")) setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    markSeen("journey-onboarding");
    setVisible(false);
    onDismiss?.();
  }

  const steps = [
    { icon: "map", title: t("onboarding.step1Title"), body: t("onboarding.step1Body") },
    { icon: "explore", title: t("onboarding.step2Title"), body: t("onboarding.step2Body") },
    { icon: "military_tech", title: t("onboarding.step3Title"), body: t("onboarding.step3Body") },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="journey-onboarding-title"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.75rem)] sm:items-center sm:p-4 xl:pb-4"
    >
      <div className="flex w-full max-w-md max-h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-surface-container-high shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pokeball-red">
            {t("onboarding.eyebrow")}
          </p>
          <h2 id="journey-onboarding-title" className="mt-1 text-headline-md text-white">
            {t("onboarding.title")}
          </h2>
          <ol className="mt-4 flex flex-col gap-3">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pokeball-red/15 text-pokeball-red">
                  <span className="material-symbols-outlined text-[20px]!">{s.icon}</span>
                </span>
                <div className="min-w-0">
                  <p className="text-label-sm font-bold text-white">
                    <span className="mr-1.5 font-mono text-on-surface-variant">{i + 1}.</span>
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-label-sm text-on-surface-variant">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="shrink-0 border-t border-white/10 p-4 pt-3">
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-xl bg-pokeball-red px-4 py-3 text-label-md font-bold text-white transition hover:bg-pokeball-red/90"
          >
            {t("onboarding.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Coach mark puntual anclado a un hotspot. */
export function CoachMark({
  storageKey,
  message,
  children,
  align = "bottom",
  className = "",
}: {
  storageKey: FirstVisitKey;
  message: string;
  children: ReactNode;
  align?: "top" | "bottom";
  className?: string;
}) {
  const t = useTranslations("ux");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!hasSeen(storageKey)) setShow(true);
  }, [storageKey]);

  function dismiss() {
    markSeen(storageKey);
    setShow(false);
  }

  return (
    <div className={`relative ${className}`}>
      {children}
      {show && (
        <div
          className={`absolute left-1/2 z-30 w-[min(260px,80vw)] -translate-x-1/2 rounded-xl border border-electric-yellow/40 bg-surface-container-highest p-3 shadow-xl ${
            align === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
          }`}
          role="status"
        >
          <p className="text-label-sm text-on-surface">{message}</p>
          <button
            type="button"
            onClick={dismiss}
            className="mt-2 text-[11px] font-bold uppercase tracking-wider text-electric-yellow"
          >
            {t("coachGotIt")}
          </button>
        </div>
      )}
    </div>
  );
}
