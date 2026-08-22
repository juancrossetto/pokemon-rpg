"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pokerpg:pwa-install-dismissed";
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallPrompt() {
  const t = useTranslations("pwa");
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
    if (Date.now() - dismissedAt < DISMISS_FOR_MS) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setShowIosHint(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    let eligibilityTimer = 0;
    const revealWhenIdle = () => {
      const overlayOpen = document.documentElement.hasAttribute("data-overlay-open");
      const navigating = document.documentElement.hasAttribute("data-nav-pending");
      if (overlayOpen || navigating) {
        eligibilityTimer = window.setTimeout(revealWhenIdle, 4_000);
        return;
      }
      setEligible(true);
    };
    eligibilityTimer = window.setTimeout(revealWhenIdle, 12_000);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const hintTimer = isIos
      ? window.setTimeout(() => setShowIosHint(true), 12_000)
      : null;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (hintTimer !== null) window.clearTimeout(hintTimer);
      window.clearTimeout(eligibilityTimer);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setPromptEvent(null);
    setShowIosHint(false);
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "dismissed") {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    }
    setPromptEvent(null);
  }

  if ((!promptEvent && !showIosHint) || !eligible) return null;
  return (
    <aside className="pwa-install-card" aria-live="polite">
      <span className="material-symbols-outlined pwa-install-card__icon" aria-hidden>
        install_mobile
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm text-white">{t("installTitle")}</strong>
        <span className="mt-0.5 block text-xs leading-4 text-white/60">
          {showIosHint ? t("installIosHint") : t("installHint")}
        </span>
      </span>
      {promptEvent ? (
        <button type="button" className="pwa-install-card__action" onClick={install}>
          {t("install")}
        </button>
      ) : null}
      <button type="button" className="pwa-install-card__dismiss" onClick={dismiss} aria-label={t("later")}>
        <span className="material-symbols-outlined" aria-hidden>close</span>
      </button>
    </aside>
  );
}
