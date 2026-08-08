"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { updateAvatar } from "@/actions/update-avatar";
import { AvatarImage } from "@/components/avatar-image";
import { useSetOptimisticAvatarId } from "@/components/optimistic-avatar";
import { avatarById, avatarDisplayName } from "@/lib/avatars";
import {
  avatarOptionsInStoryOrder,
  avatarUnlockRequirement,
} from "@/lib/avatar-unlocks";

export type AvatarPickerLabels = {
  change: string;
  title: string;
  hint: string;
  save: string;
  saving: string;
  cancel: string;
  error: string;
  errorLocked: string;
  locked: string;
  /** ICU: `{order}` = Gym.order que desbloquea. */
  lockedHint: string;
};

/**
 * Selector de retrato.
 *
 * Se abre desde el avatar del hero del perfil. Confirma con un botón en vez de
 * guardar al tocar. Los no desbloqueados se muestran atenuados y no se pueden
 * elegir (progreso de gimnasio → `unlockedIds`).
 */
export function AvatarPicker({
  currentAvatarId,
  unlockedIds,
  labels,
  children,
  showAffordance = true,
  onSaved,
}: {
  currentAvatarId: string | null;
  /** Ids/slugs ya liberados (starters + medallas). */
  unlockedIds: readonly string[];
  labels: AvatarPickerLabels;
  onSaved?: (avatarId: string | null) => void;
  children: React.ReactNode;
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

  const unlocked = useMemo(() => new Set(unlockedIds), [unlockedIds]);

  const storyOptions = useMemo(() => avatarOptionsInStoryOrder(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  function save() {
    if (!selected || pending) return;
    if (!unlocked.has(selected)) {
      setError(labels.errorLocked);
      return;
    }
    const next = selected;
    const previous = resolvedCurrentId;
    setError(null);
    onSaved?.(next);
    setOptimisticAvatarId(next, userKey);
    setOpen(false);

    start(async () => {
      const result = await updateAvatar(next, locale);
      if (!result.ok) {
        onSaved?.(previous);
        setOptimisticAvatarId(previous, userKey);
        setError(result.error === "locked" ? labels.errorLocked : labels.error);
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
              <div className="shrink-0 border-b border-white/8 px-5 py-3.5 sm:px-6">
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-label-lg font-bold text-white">{labels.title}</p>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant">{labels.hint}</p>
                  </div>
                  {selected ? (
                    <p
                      className="max-w-[45%] shrink-0 pt-0.5 text-right text-[17px] font-semibold leading-tight tracking-wide text-white sm:text-[18px]"
                      aria-live="polite"
                    >
                      {avatarDisplayName(selected)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {storyOptions.map((opt) => {
                    const active = selected === opt.id;
                    const isUnlocked = unlocked.has(opt.id);
                    const req = avatarUnlockRequirement(opt.slug);
                    const lockTitle =
                      !isUnlocked && req?.kind === "gym"
                        ? labels.lockedHint.replace("{order}", String(req.order))
                        : labels.locked;
                    return (
                      <li key={opt.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          aria-label={
                            isUnlocked
                              ? avatarDisplayName(opt.slug)
                              : `${avatarDisplayName(opt.slug)} — ${lockTitle}`
                          }
                          aria-disabled={!isUnlocked}
                          title={!isUnlocked ? lockTitle : undefined}
                          onClick={() => {
                            if (!isUnlocked) {
                              setError(labels.errorLocked);
                              return;
                            }
                            setError(null);
                            setSelected(opt.id);
                          }}
                          className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[22%] border transition ${
                            !isUnlocked
                              ? "border-white/6 bg-black/40 opacity-45"
                              : active
                                ? "border-pokeball-red bg-pokeball-red/12"
                                : "border-white/8 bg-black/25 hover:border-white/25"
                          }`}
                        >
                          <AvatarImage
                            src={opt.src}
                            alt={avatarDisplayName(opt.slug)}
                            className={`trainer-sprite-thumb absolute inset-0 h-full w-full${!isUnlocked ? " grayscale" : ""}`}
                          />
                          {!isUnlocked ? (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                              <span className="material-symbols-outlined text-[18px]! text-white/80">
                                lock
                              </span>
                            </span>
                          ) : null}
                          {active && isUnlocked ? (
                            <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-pokeball-red">
                              <span className="material-symbols-outlined text-[11px]! text-white">
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
                  disabled={
                    pending ||
                    !selected ||
                    selected === currentAvatarId ||
                    !unlocked.has(selected)
                  }
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
