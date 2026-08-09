"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { hasSeen, markSeen, hasSeenThisSession, markSeenThisSession, type FirstVisitKey } from "@/lib/journey-ux";
import type { HandbookChapterId } from "@/lib/handbook/chapters";
import { HandbookLink } from "@/components/handbook/handbook-trigger";
import { lockBodyScroll } from "@/lib/scroll-lock";

/**
 * Botón `i` que abre un popup con tips del hub + link al manual.
 * Misma UX que el comercio: no ocupa una fila entera.
 */
export function HubHelpButton({
  bullets,
  handbookChapter,
  roleKey,
  className,
}: {
  bullets: string[];
  handbookChapter?: HandbookChapterId;
  /** Clave bajo `ux.role.*` para el eyebrow del popup. */
  roleKey?: string;
  className?: string;
}) {
  const t = useTranslations("ux");
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    const releaseScroll = lockBodyScroll();
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
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
        className={
          className ??
          "flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/85 backdrop-blur-md transition hover:border-white/35 hover:bg-black/60 hover:text-white"
        }
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
                  {roleKey ? (
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-electric-yellow">
                      {t(`role.${roleKey}`)}
                    </p>
                  ) : null}
                  <h2
                    id={titleId}
                    className={`text-[15px] font-semibold leading-snug text-white ${roleKey ? "mt-1" : ""}`}
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

              {handbookChapter ? (
                <div className="mt-3 border-t border-white/8 pt-3">
                  <HandbookLink chapter={handbookChapter} />
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ui-btn-primary mt-4 w-full px-4 py-2.5 text-[13px] font-bold"
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

/** Panel colapsable "¿Qué puedo hacer acá?" para hubs densos. */
export function HubHelpPanel({
  storageKey,
  bullets,
  titleKey = "helpTitle",
  handbookChapter,
}: {
  storageKey: FirstVisitKey;
  bullets: string[];
  titleKey?: string;
  /** Si se pasa, muestra enlace al capítulo del manual. */
  handbookChapter?: HandbookChapterId;
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
        <div className="border-t border-white/10 px-3.5 py-3">
          <ul className="space-y-1.5 text-label-sm text-on-surface-variant">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-0.5 text-pokeball-red">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {handbookChapter ? (
            <div className="mt-3 border-t border-white/8 pt-3">
              <HandbookLink chapter={handbookChapter} />
            </div>
          ) : null}
        </div>
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
      iconSrc: "/nav/map-icon.png?v=4",
      title: t("onboarding.step1Title"),
      body: t("onboarding.step1Body"),
    },
    {
      iconSrc: "/nav/battle-wild-icon.png?v=4",
      title: t("onboarding.step2Title"),
      body: t("onboarding.step2Body"),
    },
    {
      iconSrc: "/nav/gym-icon.png?v=4",
      title: t("onboarding.step3Title"),
      body: t("onboarding.step3Body"),
    },
    // La energía se explica acá y no cuando se agota: enterarse del límite
    // recién cuando frena la partida es lo que lo hace sentir un castigo.
    {
      iconSrc: "/nav/home-icon.png?v=4",
      title: t("onboarding.step4Title"),
      body: t("onboarding.step4Body"),
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
          className="ui-btn-primary mt-4 w-full px-4 py-2.5 text-[13px] font-bold"
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
  /** Si true: a lo sumo una vez por sesión de pestaña (no al reabrir el tip por un slot vacío nuevo). */
  oncePerSession = false,
}: {
  storageKey: FirstVisitKey;
  message: string;
  children: ReactNode;
  align?: "top" | "bottom";
  className?: string;
  oncePerSession?: boolean;
}) {
  const t = useTranslations("ux");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (hasSeen(storageKey)) return;
    if (oncePerSession && hasSeenThisSession(storageKey)) return;
    setShow(true);
    if (oncePerSession) markSeenThisSession(storageKey);
  }, [storageKey, oncePerSession]);

  function dismiss() {
    markSeen(storageKey);
    markSeenThisSession(storageKey);
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
