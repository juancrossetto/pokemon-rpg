"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón de submit para los formularios del mercado. Resuelve dos problemas que
 * tenían los `<button type="submit">` pelados: el doble click mandaba dos
 * compras (la segunda fallaba con "no disponible", confuso para el jugador) y
 * no había ninguna señal de que la operación estaba en curso.
 *
 * `confirmMessage` / `getConfirmMessage` agregan un paso de confirmación —
 * compras caras y publicaciones (fee no reembolsable).
 */
export function MarketSubmitButton({
  label,
  pendingLabel,
  className,
  disabled = false,
  confirmMessage,
  getConfirmMessage,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
  confirmMessage?: string;
  getConfirmMessage?: () => string | undefined;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      onClick={(event) => {
        const message = getConfirmMessage?.() ?? confirmMessage;
        if (message && !window.confirm(message)) event.preventDefault();
      }}
      className={`${className} inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {pending && (
        <span className="material-symbols-outlined text-[16px] animate-spin">
          progress_activity
        </span>
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}
