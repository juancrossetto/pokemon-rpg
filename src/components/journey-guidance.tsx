"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
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

/**
 * Onboarding de 3 pasos (Viaje → Explorar → Gimnasio), una sola vez.
 * Popup guía compacto con íconos PNG del nav (misma visual que el menú).
 */
export function JourneyOnboarding({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  const t = useTranslations("ux");
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!hasSeen("journey-onboarding")) setVisible(true);
  }, []);

  if (!mounted || !visible) return null;

  function dismiss() {
    markSeen("journey-onboarding");
    setVisible(false);
    onDismiss?.();
  }

  const steps = [
    {
      iconSrc: "/nav/map-icon.png",
      title: t("onboarding.step1Title"),
      body: t("onboarding.step1Body"),
    },
    {
      iconSrc: "/nav/battle-wild-icon.png",
      title: t("onboarding.step2Title"),
      body: t("onboarding.step2Body"),
    },
    {
      iconSrc: "/nav/gym-icon.png",
      title: t("onboarding.step3Title"),
      body: t("onboarding.step3Body"),
    },
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="journey-onboarding-title"
      className="fixed inset-0 z-[100] flex items-end justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.75rem)] sm:items-center sm:p-4 xl:pb-4"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label={t("onboarding.cta")}
        onClick={dismiss}
      />

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-white/12 bg-[#0c1018]/96 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-pokeball-red">
              {t("onboarding.eyebrow")}
            </p>
            <h2
              id="journey-onboarding-title"
              className="mt-1 text-[15px] font-semibold leading-snug text-white"
            >
              {t("onboarding.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/[0.06] hover:text-white"
            aria-label={t("onboarding.cta")}
          >
            <span className="material-symbols-outlined text-[18px]!">close</span>
          </button>
        </div>

        <ol className="mt-4 flex flex-col gap-2.5">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                <span className="absolute inset-0 rounded-xl bg-white/[0.04]" />
                <Image
                  src={s.iconSrc}
                  alt=""
                  width={44}
                  height={44}
                  className="relative h-11 w-11 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
                  unoptimized
                />
                <span className="absolute -left-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-pokeball-red font-mono text-[9px] font-bold text-white">
                  {i + 1}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-tight text-white">{s.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/55">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={dismiss}
          className="mt-4 w-full rounded-xl bg-pokeball-red px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-pokeball-red/90"
        >
          {t("onboarding.cta")}
        </button>
      </div>
    </div>,
    document.body,
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
