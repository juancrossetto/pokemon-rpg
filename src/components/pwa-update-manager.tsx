"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function PwaUpdateManager() {
  const t = useTranslations("pwa");
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let active = true;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => {
      if (!active) return;
      if (registration.waiting) setWaiting(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
        });
      });
      window.setInterval(() => void registration.update(), 60 * 60 * 1000);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!waiting) return;
    const html = document.documentElement;
    html.dataset.pwaUpdatePending = "";
    return () => {
      delete html.dataset.pwaUpdatePending;
    };
  }, [waiting]);

  if (!waiting) return null;
  return <aside className="pwa-update-card fixed bottom-[calc(var(--bottom-sheet-inset,5rem)+.75rem)] left-1/2 z-[120] flex w-[min(92vw,430px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-primary/35 bg-[#12151c]/96 px-3 py-2.5 shadow-[0_18px_55px_rgba(0,0,0,.65)] backdrop-blur-xl md:bottom-5"><span className="material-symbols-outlined text-primary">system_update</span><p className="min-w-0 flex-1 text-xs font-semibold text-white/75">{t("updateAvailable")}</p><button type="button" onClick={() => waiting.postMessage("SKIP_WAITING")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-black text-white">{t("reload")}</button></aside>;
}
