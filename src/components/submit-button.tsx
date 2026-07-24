"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón de submit genérico para formularios con server action. Deshabilita
 * durante el envío (evita doble submit) y muestra un spinner. `confirmMessage`
 * agrega un paso de confirmación para acciones destructivas (disolver clan,
 * expulsar miembro, etc.).
 */
export function SubmitButton({
  label,
  pendingLabel,
  className,
  disabled = false,
  confirmMessage,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
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
