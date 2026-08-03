"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { updateAvatar } from "@/actions/update-avatar";
import { AvatarImage } from "@/components/avatar-image";
import { useSetOptimisticAvatarId } from "@/components/optimistic-avatar";
import { AVATAR_OPTIONS, avatarById } from "@/lib/avatars";

export type AvatarPickerLabels = {
  change: string;
  title: string;
  hint: string;
  save: string;
  saving: string;
  cancel: string;
  error: string;
};

/**
 * Selector de retrato.
 *
 * Se abre desde el avatar del hero del perfil, que es donde el jugador lo
 * busca. Confirma con un botón en vez de guardar al tocar: la grilla tiene
 * decenas de opciones y en mobile es fácil rozar una mientras se scrollea.
 *
 * El sheet se porta a `document.body` para no pelear stacking/overflow con el
 * chrome móvil (bottom nav z-50, hero con overflow-hidden).
 */
export function AvatarPicker({
  currentAvatarId,
  labels,
  children,
  showAffordance = true,
  onSaved,
}: {
  currentAvatarId: string | null;
  labels: AvatarPickerLabels;
  /**
   * Se llama con el id elegido apenas se confirma, **antes** de que el servidor
   * responda, para que quien renderiza el retrato lo pinte ya. Si la escritura
   * falla se vuelve a llamar con el id anterior.
   */
  onSaved?: (avatarId: string | null) => void;
  /** Disparador — normalmente el propio retrato del hero. */
  children: React.ReactNode;
  /** Badge de lápiz sobre el disparador. Desactivar si el hijo ya es un botón de editar. */
  showAffordance?: boolean;
}) {
  const locale = useLocale();
  const { data: session } = useSession();
  const userKey = session?.user?.id ?? "";
  const setOptimisticAvatarId = useSetOptimisticAvatarId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const resolvedCurrentId = avatarById(currentAvatarId)?.id ?? currentAvatarId;
  const [selected, setSelected] = useState<string | null>(resolvedCurrentId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  /*
    La selección se reinicia al ABRIR, no con un efecto que observe el cierre.
    El resultado para el jugador es el mismo —descartar sin guardar y reabrir
    muestra lo que está puesto de verdad— pero sin encadenar un render extra
    cada vez que se cierra el panel.
  */
  function openPicker() {
    setSelected(avatarById(currentAvatarId)?.id ?? currentAvatarId);
    setError(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  /*
    Guardar cierra el panel en el acto y pinta el avatar nuevo; la escritura
    sigue en segundo plano.

    Antes esto esperaba a `updateAvatar` dentro de la transición, y esa promesa
    no resuelve cuando termina el UPDATE: resuelve cuando termina el
    `revalidatePath(..., "layout")` que dispara, o sea cuando el servidor
    volvió a renderizar el layout entero (header, con sus consultas) más la
    página de perfil (dieciocho consultas) contra una base remota. El panel se
    quedaba en "Guardando…" todo ese rato tapando la pantalla y después se
    cerraba de golpe, así que el cambio nunca se veía ocurrir.

    Revalidar sigue haciendo falta —el header vive en el layout y el próximo
    render tiene que traer el avatar nuevo—, pero ya no bloquea el feedback.
  */
  function save() {
    if (!selected || pending) return;
    const next = selected;
    const previous = resolvedCurrentId;
    setError(null);
    onSaved?.(next);
    setOptimisticAvatarId(next, userKey);
    setOpen(false);

    start(async () => {
      const result = await updateAvatar(next, locale);
      if (!result.ok) {
        // Volver atrás y reabrir con el motivo: es la única forma de contarlo
        // una vez que el panel ya se cerró.
        onSaved?.(previous);
        setOptimisticAvatarId(previous, userKey);
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

            {/*
              Altura explícita (no sólo max-h): sin ella el flex-1 de la grilla
              no se contrae en mobile y el footer con Guardar queda clippeado
              debajo del viewport / detrás del bottom nav.
            */}
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
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {AVATAR_OPTIONS.map((opt) => {
                    const active = selected === opt.id;
                    return (
                      <li key={opt.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelected(opt.id)}
                          className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[22%] border transition ${
                            active
                              ? "border-pokeball-red bg-pokeball-red/12"
                              : "border-white/8 bg-black/25 hover:border-white/25"
                          }`}
                        >
                          <AvatarImage
                            src={opt.src}
                            alt={opt.slug}
                            className="trainer-sprite-fill absolute inset-0 h-full w-full"
                          />
                          {active && (
                            <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-pokeball-red">
                              <span className="material-symbols-outlined text-[11px]! text-white">
                                check
                              </span>
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {error && (
                <p className="shrink-0 border-t border-error/20 bg-error/10 px-4 py-2 text-[11px] text-error">
                  {error}
                </p>
              )}

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
                  disabled={pending || !selected || selected === currentAvatarId}
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
        className="group relative block rounded-[28%] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pokeball-red/70"
      >
        {children}
        {showAffordance ? (
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#14161c] text-on-surface-variant shadow-lg transition group-hover:border-white/40 group-hover:text-white"
          >
            <span className="material-symbols-outlined text-[14px]!">edit</span>
          </span>
        ) : null}
      </button>

      {sheet}
    </>
  );
}
