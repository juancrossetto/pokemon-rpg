"use client";

import type { ReactNode } from "react";

export function PcAlert({
  kind,
  children,
  onDismiss,
}: {
  kind: "error" | "success" | "info";
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const tone =
    kind === "error"
      ? "border-pokeball-red/35 bg-pokeball-red/10 text-white"
      : kind === "success"
        ? "border-tertiary/35 bg-tertiary/10 text-tertiary"
        : "border-white/12 bg-white/[0.04] text-on-surface-variant";

  const icon =
    kind === "error" ? "error_outline" : kind === "success" ? "check_circle" : "info";

  return (
    <div
      className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px] leading-snug ${tone}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <span className="material-symbols-outlined mt-px shrink-0 text-[17px]!">{icon}</span>
      <p className="min-w-0 flex-1">{children}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-0.5 opacity-70 transition hover:opacity-100"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-[16px]!">close</span>
        </button>
      ) : null}
    </div>
  );
}
