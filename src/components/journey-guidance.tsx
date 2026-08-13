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

      <div className="heal-tutorial relative z-10 flex w-full max-w-md items-end justify-center">
        <Image
          src="/avatars/oak2.png"
          alt=""
          width={336}
          height={798}
          className="pointer-events-none relative z-20 -mb-1 h-[min(29vh,9.5rem)] w-auto max-w-[24%] shrink-0 object-contain object-bottom drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)] sm:h-[11rem] sm:max-w-none"
          unoptimized
        />

        <div className="relative z-10 -ml-5 mb-2 min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/12 bg-[#0c1018]/96 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:-ml-6">
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
      </div>
    </div>,
    document.body,
  );
}

/**
 * Guía de primera vez presentada por un NPC: retrato al costado de la card,
 * como el resto de las guías. Se muestra una sola vez por `storageKey`.
 *
 * La comparte la enfermera (KO en el equipo) y la agente del Comercio; el
 * bloque estaba escrito a mano para Joy y duplicarlo dejaba dos copias del
 * mismo layout, portal y bloqueo de scroll que después se desincronizan.
 */
type NpcGuideLabels = { eyebrow: string; title: string; body: string; cta: string };

/**
 * La card en sí, controlada desde afuera. Separada del disparador porque la
 * misma guía entra por dos lados: sola en la primera visita y a pedido desde
 * el botón `i` del hub. Antes eran dos popups distintos con el mismo contenido.
 */
function NpcGuideCard({
  titleId,
  imageSrc,
  labels,
  bullets,
  handbookChapter,
  onClose,
}: {
  titleId: string;
  imageSrc: string;
  labels: NpcGuideLabels;
  bullets?: string[];
  handbookChapter?: HandbookChapterId;
  onClose: () => void;
}) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[100] flex items-end justify-center px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.5rem)] sm:items-center sm:p-4 xl:pb-4"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label={labels.cta}
        onClick={onClose}
      />

      <div className="heal-tutorial relative z-10 flex w-full max-w-md items-end justify-center">
        <Image
          src={imageSrc}
          alt=""
          width={240}
          height={340}
          className="heal-tutorial__joy pointer-events-none relative z-20 -mb-1 h-[min(38vh,13.75rem)] w-auto max-w-[42%] shrink-0 object-contain object-bottom drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)] sm:h-[16rem] sm:max-w-none"
          unoptimized
        />
        <div className="relative z-10 -ml-7 mb-3 min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/12 bg-[#0c1018]/96 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:-ml-8">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-pokeball-red">
            {labels.eyebrow}
          </p>
          <h2 id={titleId} className="mt-1 text-[15px] font-semibold leading-snug text-white">
            {labels.title}
          </h2>
          <p className="mt-1.5 text-[13px] leading-snug text-white/60">{labels.body}</p>

          {bullets && bullets.length > 0 ? (
            <ul className="mt-2.5 space-y-1.5 text-[12px] leading-snug text-white/60">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex gap-1.5">
                  <span className="mt-px text-pokeball-red">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {handbookChapter ? (
            <div className="mt-3 border-t border-white/8 pt-3">
              <HandbookLink chapter={handbookChapter} />
            </div>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="ui-btn-primary mt-4 w-full px-4 py-2.5 text-[13px] font-bold"
          >
            {labels.cta}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NpcTutorial({
  active,
  storageKey,
  /** Guía que tiene que haberse visto antes (evita pisar el onboarding). */
  requires,
  imageSrc,
  titleId,
  labels,
  bullets,
  handbookChapter,
}: {
  active: boolean;
  storageKey: FirstVisitKey;
  requires?: FirstVisitKey;
  imageSrc: string;
  titleId: string;
  labels: NpcGuideLabels;
  bullets?: string[];
  handbookChapter?: HandbookChapterId;
}) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!active || !mounted) return;
    if (hasSeen(storageKey)) return;
    if (requires && !hasSeen(requires)) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [active, mounted, storageKey, requires]);

  useEffect(() => {
    if (!visible) return;
    const release = lockBodyScroll();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        markSeen(storageKey);
        setVisible(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      release();
    };
  }, [visible, storageKey]);

  function dismiss() {
    markSeen(storageKey);
    setVisible(false);
  }

  if (!mounted || !visible) return null;

  return (
    <NpcGuideCard
      titleId={titleId}
      imageSrc={imageSrc}
      labels={labels}
      bullets={bullets}
      handbookChapter={handbookChapter}
      onClose={dismiss}
    />
  );
}

/**
 * Botón `i` que reabre a pedido la misma guía del NPC. Comparte card con la de
 * primera visita: si el jugador la cerró y después quiere repasar cómo va la
 * cosa, ve exactamente lo mismo y no un popup distinto con otro tono.
 */
export function NpcGuideButton({
  imageSrc,
  labels,
  bullets,
  handbookChapter,
  className,
}: {
  imageSrc: string;
  labels: NpcGuideLabels;
  bullets?: string[];
  handbookChapter?: HandbookChapterId;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const release = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      release();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={labels.title}
        className={
          className ??
          "flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/85 backdrop-blur-md transition hover:border-white/35 hover:bg-black/60 hover:text-white"
        }
      >
        <span className="material-symbols-outlined text-[16px]!">info</span>
      </button>
      {open ? (
        <NpcGuideCard
          titleId={titleId}
          imageSrc={imageSrc}
          labels={labels}
          bullets={bullets}
          handbookChapter={handbookChapter}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Primera vez que hay un KO en el equipo: Joy al costado de la card,
 * igual que las otras guías, y apunta al Centro Pokémon del home.
 */
export function HealTutorial({ active }: { active: boolean }) {
  const t = useTranslations("ux");
  return (
    <NpcTutorial
      active={active}
      storageKey="coach-heal"
      requires="journey-onboarding"
      imageSrc="/tutorial/nurse-joy.png"
      titleId="heal-tutorial-title"
      labels={{
        eyebrow: t("healTutorial.eyebrow"),
        title: t("healTutorial.title"),
        body: t("healTutorial.body"),
        cta: t("healTutorial.cta"),
      }}
    />
  );
}

/**
 * Primera visita al Comercio: la agente explica que el hub tiene dos lados
 * —tienda oficial y mercado entre jugadores— antes de que el jugador se
 * encuentre con dos pestañas sin saber en qué se diferencian.
 */
export function MarketTutorial() {
  const guide = useMarketGuide();
  return (
    <NpcTutorial
      active
      storageKey="coach-market"
      titleId="market-tutorial-title"
      {...guide}
    />
  );
}

/** Contenido de la guía del Comercio — lo comparten la card y el botón `i`. */
export function useMarketGuide() {
  const t = useTranslations("ux");
  return {
    imageSrc: "/tutorial/agent-mara.png",
    labels: {
      eyebrow: t("marketTutorial.eyebrow"),
      title: t("marketTutorial.title"),
      body: t("marketTutorial.body"),
      cta: t("marketTutorial.cta"),
    },
    bullets: (t.raw("help.market") as string[]) ?? [],
    handbookChapter: "economy" as HandbookChapterId,
  };
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
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipStyle, setTipStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (hasSeen(storageKey)) return;
    if (oncePerSession && hasSeenThisSession(storageKey)) return;
    const raf = requestAnimationFrame(() => {
      setShow(true);
      if (oncePerSession) markSeenThisSession(storageKey);
    });
    return () => cancelAnimationFrame(raf);
  }, [storageKey, oncePerSession]);

  useEffect(() => {
    if (!show) return;

    function place() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const a = anchor.getBoundingClientRect();
      const pad = 12;
      const width = Math.min(260, Math.max(160, window.innerWidth - pad * 2));
      let left = a.left + a.width / 2 - width / 2;
      left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));

      // Preferimos debajo; si no entra, arriba.
      const tipH = tipRef.current?.offsetHeight || 96;
      const below = a.bottom + 8;
      const above = a.top - tipH - 8;
      const top =
        align === "top" || below + tipH > window.innerHeight - pad
          ? Math.max(pad, above)
          : below;

      setTipStyle({ top, left, width });
    }

    // Dos frames: el primero monta el tip, el segundo ya tiene su alto real.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      place();
      raf2 = requestAnimationFrame(place);
    });
    const main = document.querySelector(".app-main");
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    main?.addEventListener("scroll", place, { passive: true });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      main?.removeEventListener("scroll", place);
    };
  }, [show, align, message]);

  function dismiss() {
    markSeen(storageKey);
    markSeenThisSession(storageKey);
    setShow(false);
  }

  return (
    <div ref={anchorRef} className={`relative ${className}`}>
      {children}
      {show && mounted
        ? createPortal(
            <div
              ref={tipRef}
              className="fixed z-[60] rounded-xl border border-electric-yellow/40 bg-surface-container-highest p-3 shadow-xl"
              style={
                tipStyle
                  ? {
                      top: tipStyle.top,
                      left: tipStyle.left,
                      width: tipStyle.width,
                    }
                  : {
                      // Primer frame: fuera de pantalla hasta medir (evita flash cortado).
                      top: -9999,
                      left: -9999,
                      width: Math.min(260, window.innerWidth - 24),
                    }
              }
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
