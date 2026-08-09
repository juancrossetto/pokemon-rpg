"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { updateHomeBanner } from "@/actions/update-home-banner";
import {
  HOME_BANNER_OPTIONS,
  homeBannerById,
} from "@/lib/home-banners";
import { lockBodyScroll } from "@/lib/scroll-lock";

export type BannerPickerLabels = {
  change: string;
  title: string;
  hint: string;
  save: string;
  saving: string;
  cancel: string;
  error: string;
};

/**
 * Selector de banner de home/perfil.
 * Mismo patrón que AvatarPicker: sheet portaleado, confirmación explícita.
 */
export function BannerPicker({
  currentBannerId,
  labels,
  children,
  showAffordance = true,
  onSaved,
}: {
  currentBannerId: string | null;
  labels: BannerPickerLabels;
  onSaved?: (bannerId: string) => void;
  children: React.ReactNode;
  showAffordance?: boolean;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const resolvedCurrentId = homeBannerById(currentBannerId).id;
  const [selected, setSelected] = useState(resolvedCurrentId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  function openPicker() {
    setSelected(homeBannerById(currentBannerId).id);
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
      const result = await updateHomeBanner(next, locale);
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
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                  {HOME_BANNER_OPTIONS.map((opt) => {
                    const active = selected === opt.id;
                    return (
                      <li key={opt.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelected(opt.id)}
                          className={`relative aspect-[2.2/1] w-full overflow-hidden rounded-xl border transition ${
                            active
                              ? "border-pokeball-red ring-1 ring-pokeball-red/40"
                              : "border-white/10 hover:border-white/25"
                          }`}
                        >
                          <Image
                            src={opt.src}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 45vw, 240px"
                            className="object-cover"
                            /* Mismo criterio que home/perfil: sin optimizador.
                               Si no, un JPG reemplazado in-place puede mostrar
                               un thumb viejo y al guardar aplicar el archivo real. */
                            unoptimized
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
            <span className="material-symbols-outlined text-[12px]!">wallpaper</span>
          </span>
        ) : null}
      </button>
      {sheet}
    </>
  );
}
