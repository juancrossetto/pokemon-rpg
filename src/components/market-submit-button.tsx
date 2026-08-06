"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { ConfirmModal } from "@/components/confirm-modal";

/**
 * Botón de submit para los formularios del mercado. Resuelve dos problemas que
 * tenían los `<button type="submit">` pelados: el doble click mandaba dos
 * compras (la segunda fallaba con "no disponible", confuso para el jugador) y
 * no había ninguna señal de que la operación estaba en curso.
 *
 * `confirmMessage` / `getConfirmMessage` abren el ConfirmModal del juego —
 * compras caras y publicaciones (fee no reembolsable). Nunca `window.confirm`.
 */
export function MarketSubmitButton({
  label,
  pendingLabel,
  className,
  disabled = false,
  confirmMessage,
  getConfirmMessage,
  confirmTitle,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
  confirmMessage?: string;
  getConfirmMessage?: () => string | undefined;
  /** Título del modal; por defecto el mismo `label` de la acción. */
  confirmTitle?: string;
}) {
  const t = useTranslations("market");
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const skipConfirmRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");

  return (
    <>
      <button
        ref={buttonRef}
        type="submit"
        disabled={disabled || pending}
        onClick={(event) => {
          if (skipConfirmRef.current) {
            skipConfirmRef.current = false;
            return;
          }
          const message = getConfirmMessage?.() ?? confirmMessage;
          if (!message) return;
          event.preventDefault();
          setBody(message);
          setOpen(true);
        }}
        className={`${className} inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {pending && (
          <span className="material-symbols-outlined text-[16px]! animate-spin">
            progress_activity
          </span>
        )}
        {pending ? pendingLabel : label}
      </button>

      <ConfirmModal
        open={open}
        title={confirmTitle ?? label}
        body={body}
        confirmLabel={label}
        cancelLabel={t("cancel")}
        pending={pending}
        onCancel={() => {
          if (!pending) setOpen(false);
        }}
        onConfirm={() => {
          setOpen(false);
          skipConfirmRef.current = true;
          // requestSubmit re-dispara el click del submitter → el flag saltea el modal.
          buttonRef.current?.form?.requestSubmit(buttonRef.current);
        }}
      />
    </>
  );
}
