"use client";

import { useEffect } from "react";
import {
  BOOT_SPLASH_DESKTOP_MQ,
  clearBootSplashPending,
  isBootSplashDesktop,
  peekBootSplashPending,
} from "@/lib/boot-splash";

/**
 * Controla el splash estático del layout:
 * - Solo mobile
 * - Solo si hay flag post-login
 * - Barra 0→100% una sola vez, luego oculta (sin `.remove()`)
 */
export function BootSplashController() {
  useEffect(() => {
    const splash = document.getElementById("boot-splash");
    const fill = document.getElementById("boot-splash-fill");
    const pct = document.getElementById("boot-splash-pct");

    if (isBootSplashDesktop() || !peekBootSplashPending()) {
      clearBootSplashPending();
      document.documentElement.classList.remove("boot-splash-pending");
      splash?.classList.add("boot-splash--out");
      splash?.setAttribute("aria-hidden", "true");
      splash?.setAttribute("aria-busy", "false");
      return;
    }

    if (!splash || !fill || !pct) return;

    document.documentElement.classList.add("boot-splash-pending");
    splash.classList.remove("boot-splash--out");
    splash.setAttribute("aria-hidden", "false");
    splash.setAttribute("aria-busy", "true");

    let raf = 0;
    let hideTimer = 0;
    let done = false;
    const start = performance.now();
    const duration = 1400;

    function setProgress(value: number) {
      const v = Math.max(0, Math.min(100, Math.round(value)));
      fill!.style.width = `${v}%`;
      pct!.textContent = `${v}%`;
      splash!.setAttribute("aria-valuenow", String(v));
      splash!.setAttribute("aria-label", `Cargando ${v}%`);
    }

    function finish() {
      if (done) return;
      done = true;
      setProgress(100);
      clearBootSplashPending();
      hideTimer = window.setTimeout(() => {
        splash!.classList.add("boot-splash--out");
        splash!.setAttribute("aria-busy", "false");
        splash!.setAttribute("aria-hidden", "true");
        document.documentElement.classList.remove("boot-splash-pending");
      }, 220);
    }

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased * 100);

      const docReady = document.readyState === "complete";
      if (t >= 1 && docReady) {
        finish();
        return;
      }
      if (t >= 1 && !docReady) {
        setProgress(96);
        window.addEventListener("load", finish, { once: true });
        hideTimer = window.setTimeout(finish, 2500);
        return;
      }
      raf = window.requestAnimationFrame(tick);
    }

    setProgress(0);
    raf = window.requestAnimationFrame(tick);

    const mq = window.matchMedia(BOOT_SPLASH_DESKTOP_MQ);
    function onMq() {
      if (!mq.matches) return;
      clearBootSplashPending();
      document.documentElement.classList.remove("boot-splash-pending");
      splash!.classList.add("boot-splash--out");
      window.cancelAnimationFrame(raf);
      window.clearTimeout(hideTimer);
    }
    mq.addEventListener("change", onMq);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(hideTimer);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  return null;
}
