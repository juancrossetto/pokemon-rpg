"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import Image from "next/image";

const PIKACHU_LOADER = "/pvp/pikachu-loader.gif";

/**
 * CTA de combate rápido PvP: mientras corre la simulación server-side,
 * muestra un overlay con Pikachu para que el “instantáneo” se sienta.
 */
export function PvpQuickMatchSubmit({
  label,
  pendingLabel,
  className,
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <>
      <button
        type="submit"
        disabled={disabled || pending}
        className={`${className} inline-flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {pending ? pendingLabel : label}
      </button>
      {mounted && pending
        ? createPortal(
            <div
              className="pvp-quick-loader"
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label={pendingLabel}
            >
              <div className="pvp-quick-loader__scrim" aria-hidden />
              <div className="pvp-quick-loader__card">
                <Image
                  src={PIKACHU_LOADER}
                  alt=""
                  width={168}
                  height={168}
                  unoptimized
                  className="pvp-quick-loader__gif"
                  priority
                />
                <p className="page-title pvp-quick-loader__label">{pendingLabel}</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
