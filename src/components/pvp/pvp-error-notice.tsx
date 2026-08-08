"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { formatPvpCooldown } from "@/lib/pvp/cooldown";

const CLOCK_ICON = "/pvp/reloj.png";

/**
 * Aviso PvP centrado (cooldown, energía, etc.): más legible que el banner
 * del tope. Al cerrar limpia `?error=` de la URL.
 */
export function PvpErrorNotice({
  message,
  dismissLabel,
  cooldownMsLeft = 0,
}: {
  message: string;
  dismissLabel: string;
  /** Si > 0, muestra contador en vivo (cooldown de rival). */
  cooldownMsLeft?: number;
}) {
  const t = useTranslations("pvp");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [leftMs, setLeftMs] = useState(Math.max(0, cooldownMsLeft));

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (!cancelled) setLeftMs(Math.max(0, cooldownMsLeft));
    });
    if (cooldownMsLeft <= 0) {
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }
    const started = Date.now();
    const initial = Math.max(0, cooldownMsLeft);
    const interval = window.setInterval(() => {
      const next = Math.max(0, initial - (Date.now() - started));
      setLeftMs(next);
      if (next <= 0) window.clearInterval(interval);
    }, 250);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, [cooldownMsLeft]);

  function dismiss() {
    setOpen(false);
    router.replace(pathname);
  }

  if (!mounted || !open) return null;

  const timeLabel = leftMs > 0 ? formatPvpCooldown(leftMs) : null;

  return createPortal(
    <div
      className="friend-toast-layer fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="presentation"
      onClick={dismiss}
    >
      <div
        aria-hidden
        className="friend-toast-backdrop absolute inset-0 bg-black/60 backdrop-blur-[3px]"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pvp-error-title"
        onClick={(e) => e.stopPropagation()}
        className="friend-toast relative z-[1] flex w-full max-w-[min(94vw,28rem)] flex-col items-center gap-3 rounded-2xl border border-pokeball-red/40 bg-[#12080a]/96 px-5 pb-5 pt-4 text-center shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
      >
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={dismiss}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
        >
          <span className="material-symbols-outlined text-[18px]!">close</span>
        </button>

        <div className="relative mt-1">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pokeball-red/20 blur-2xl"
          />
          <Image
            src={CLOCK_ICON}
            alt=""
            width={88}
            height={88}
            className="relative h-[4.5rem] w-[4.5rem] object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
            unoptimized
          />
        </div>

        <p
          id="pvp-error-title"
          className="text-[14px] font-semibold leading-snug text-white sm:text-[15px]"
        >
          {message}
        </p>

        {timeLabel ? (
          <p
            className="text-[13px] font-semibold tracking-wide text-secondary"
            aria-live="polite"
          >
            {t("cooldownReadyIn", { time: timeLabel })}
          </p>
        ) : null}

        <button
          type="button"
          onClick={dismiss}
          className="page-title mt-1 w-full rounded-xl border border-white/15 bg-white/6 px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-white/90 transition hover:border-white/30 hover:bg-white/10"
        >
          {dismissLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
