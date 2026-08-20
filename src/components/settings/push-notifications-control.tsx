"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type PushState = "checking" | "unsupported" | "blocked" | "off" | "on" | "saving";

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export function PushNotificationsControl() {
  const t = useTranslations("settings.notifications");
  const [state, setState] = useState<PushState>("checking");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    async function inspect() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const registration = await navigator.serviceWorker.ready;
      setState((await registration.pushManager.getSubscription()) ? "on" : "off");
    }
    void inspect();
  }, [publicKey]);

  async function toggle() {
    if (state !== "on" && state !== "off") return;
    setState("saving");
    try {
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (current) {
        await fetch("/api/push-subscriptions", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: current.endpoint }) });
        await current.unsubscribe();
        setState("off");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
      const response = await fetch("/api/push-subscriptions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      if (!response.ok) throw new Error("Unable to save push subscription");
      setState("on");
    } catch {
      setState("off");
    }
  }

  const detail = state === "blocked" ? t("blocked") : state === "unsupported" ? t("unavailable") : state === "on" ? t("enabled") : t("disabled");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 p-3">
      <span><span className="block text-sm font-semibold text-white">{t("push")}</span><span className="block text-[11px] text-white/45">{detail}</span></span>
      <button type="button" role="switch" aria-checked={state === "on"} onClick={toggle} disabled={!(["on", "off"] as PushState[]).includes(state)} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${state === "on" ? "border-primary/40 bg-primary/12 text-white" : "border-white/10 bg-white/4 text-white/55"}`}>
        {state === "saving" || state === "checking" ? t("saving") : state === "on" ? t("turnOff") : t("turnOn")}
      </button>
    </div>
  );
}
