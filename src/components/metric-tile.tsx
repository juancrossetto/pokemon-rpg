"use client";

import { useEffect, useState } from "react";
import { ProgressRail } from "@/components/trainer-profile-parts";

/**
 * Métrica con icono grande, número animado y barra opcional.
 */
export function MetricTile({
  icon,
  label,
  value,
  numericValue,
  suffix,
  barPct,
  hint,
  accent = "var(--color-pokeball-red)",
  delayMs = 0,
}: {
  icon: string;
  label: string;
  /** Texto estático (p. ej. "12-3"). Se usa si no hay `numericValue`. */
  value?: string;
  numericValue?: number;
  suffix?: string;
  /** 0–1 */
  barPct?: number;
  hint?: string;
  accent?: string;
  delayMs?: number;
}) {
  const [shown, setShown] = useState(0);
  const target = numericValue ?? null;

  useEffect(() => {
    if (target == null) return;
    let raf = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const delay = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(raf);
    };
  }, [target, delayMs]);

  const display =
    target != null
      ? `${shown.toLocaleString()}${suffix ?? ""}`
      : (value ?? "");

  return (
    <div
      className="tp-rise group relative flex h-[104px] flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-3 backdrop-blur-md transition hover:border-white/20"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span
        aria-hidden
        className="absolute -right-5 -top-5 h-20 w-20 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-50"
        style={{ background: accent }}
      />

      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/65">
          {label}
        </p>
        <span
          className="material-symbols-outlined text-[22px]! leading-none opacity-90"
          style={{ color: accent }}
        >
          {icon}
        </span>
      </div>

      <p
        className="tp-count-in font-mono text-[26px] font-black leading-none tracking-tight text-white tabular-nums"
        style={{ animationDelay: `${delayMs + 80}ms` }}
      >
        {display}
      </p>

      <div className="space-y-1">
        {barPct != null ? (
          <ProgressRail pct={barPct} color={accent} height={4} delayMs={delayMs + 100} />
        ) : (
          <span
            aria-hidden
            className="block h-1 w-8 rounded-full opacity-50"
            style={{ background: accent }}
          />
        )}
        <p className="truncate text-[9px] text-on-surface-variant/50">{hint ?? "\u00a0"}</p>
      </div>
    </div>
  );
}
