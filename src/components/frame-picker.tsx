"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { updateHomeFrame } from "@/actions/update-home-frame";
import { HOME_FRAME_OPTIONS, homeFrameById } from "@/lib/home-frames";
import { lockBodyScroll } from "@/lib/scroll-lock";

/**
 * Grosor base del marco en la miniatura.
 *
 * Ya no es fijo: se multiplica por el `weight` del marco, igual que en el
 * banner. Era fijo cuando todos los marcos tenían slice 160, y ahí sí los
 * igualaba. Con los `gym-*` (slice 405–512) un borde de 20px comprimía el
 * ornamento 25×, y en la miniatura no se veía nada.
 */
const PREVIEW_BORDER = 22;

/**
 * El borde de la miniatura escala con el `slice`, no con un valor fijo: así
 * todos los marcos se dibujan a la misma compresión y se aprecian por igual.
 * El tope evita que un marco de slice 512 se coma la miniatura entera.
 */
const previewBorder = (slice: number) =>
  Math.min(Math.round(PREVIEW_BORDER * (slice / 160)), 52);

export type FramePickerLabels = {
  change: string;
  title: string;
  hint: string;
  save: string;
  saving: string;
  cancel: string;
  error: string;
};

/**
 * Selector de marco del banner de home.
 * Mismo patrón que BannerPicker: sheet portaleado, confirmación explícita.
 */
export function FramePicker({
  currentFrameId,
  labels,
  children,
  showAffordance = true,
  onSaved,
}: {
  currentFrameId: string | null;
  labels: FramePickerLabels;
  onSaved?: (frameId: string) => void;
  children: React.ReactNode;
  showAffordance?: boolean;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const resolvedCurrentId = homeFrameById(currentFrameId).id;
  const [selected, setSelected] = useState(resolvedCurrentId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function openPicker() {
    setSelected(homeFrameById(currentFrameId).id);
    setError(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const releaseScroll = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
    };
  }, [open]);

  function save() {
    if (!selected || pending) return;
    const next = selected;
    const previous = resolvedCurrentId;
    setError(null);
    onSaved?.(next);
    setOpen(false);

    start(async () => {
      const result = await updateHomeFrame(next, locale);
      if (!result.ok) {
        onSaved?.(previous);
        setError(labels.error);
        setOpen(true);
      }
    });
  }

  const sheet =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-200 flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-6">
            <button
              type="button"
              aria-label={labels.cancel}
              className="absolute inset-0"
              onClick={() => setOpen(false)}
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label={labels.title}
              className="relative flex h-[min(88dvh,100%)] w-full flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#12141a] shadow-2xl sm:h-auto sm:max-h-[min(85dvh,40rem)] sm:max-w-lg sm:rounded-2xl"
            >
              <div className="shrink-0 border-b border-white/8 px-4 py-3">
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
                <p className="text-label-lg font-bold text-white">{labels.title}</p>
                <p className="mt-0.5 text-[11px] text-on-surface-variant">{labels.hint}</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
                {/* Una columna: en dos, la miniatura quedaba en ~190px de ancho
                    y no hay borde que muestre un ornamento de 512px ahí adentro.
                    A ancho completo del sheet el marco se aprecia de verdad. */}
                <ul className="grid grid-cols-1 gap-2.5">
                  {HOME_FRAME_OPTIONS.map((opt) => {
                    const active = selected === opt.id;
                    const border = previewBorder(opt.slice);
                    return (
                      <li key={opt.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelected(opt.id)}
                          className={`relative aspect-[1.9/1] w-full overflow-hidden rounded-xl border bg-[#0a0b11] transition ${
                            active
                              ? "border-pokeball-red ring-1 ring-pokeball-red/40"
                              : "border-white/10 hover:border-white/25"
                          }`}
                        >
                          {/*
                            La miniatura se dibuja con el mismo `border-image`
                            que el banner real, no con la imagen entera.

                            Con `object-contain` cada marco se escalaba según su
                            relación de aspecto —van de 1.62 a 2.29, un 41% de
                            diferencia— así que dentro de una celda fija unos
                            llegaban al borde y otros quedaban chicos y
                            centrados. Recortando en nueve piezas, las esquinas
                            se dibujan siempre al mismo tamaño y sólo se estiran
                            los tramos rectos: todas las miniaturas salen
                            iguales, y además muestran el marco tal como se va a
                            ver aplicado.
                          */}
                          <span
                            aria-hidden
                            className="absolute rounded-sm bg-gradient-to-br from-white/10 to-white/5"
                            style={{
                              top: border * opt.rails.top,
                              bottom: border * opt.rails.bottom,
                              left: border * opt.rails.left,
                              right: border * opt.rails.right,
                            }}
                          />
                          <span
                            aria-hidden
                            className="absolute inset-0"
                            style={{
                              borderStyle: "solid",
                              borderColor: "transparent",
                              borderWidth: border,
                              borderImageSource: `url("${opt.src}")`,
                              borderImageSlice: String(opt.slice),
                              borderImageRepeat: "stretch",
                            }}
                          />
                          {active ? (
                            <span className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-pokeball-red shadow">
                              <span className="material-symbols-outlined text-[13px]! text-white">
                                check
                              </span>
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {error ? (
                <p className="shrink-0 border-t border-error/20 bg-error/10 px-4 py-2 text-[11px] text-error">
                  {error}
                </p>
              ) : null}

              <div className="flex shrink-0 gap-2 border-t border-white/8 bg-[#12141a] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="min-h-11 flex-1 rounded-xl border border-white/12 text-label-md text-on-surface-variant transition hover:bg-white/5 disabled:opacity-40"
                >
                  {labels.cancel}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={pending || selected === resolvedCurrentId}
                  className="ui-btn-primary min-h-11 flex-1 rounded-xl text-label-md font-bold"
                >
                  {pending ? labels.saving : labels.save}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-label={labels.change}
        title={labels.change}
        className="group relative block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pokeball-red/70"
      >
        {children}
        {showAffordance ? (
          <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-[#14161c] text-white shadow-md">
            <span className="material-symbols-outlined text-[12px]!">
              border_style
            </span>
          </span>
        ) : null}
      </button>
      {sheet}
    </>
  );
}
