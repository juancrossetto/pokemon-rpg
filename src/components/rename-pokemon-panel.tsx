"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { renamePokemonPaid } from "@/actions/rename-pokemon";
import { MAX_NICKNAME_LENGTH, RENAME_COST } from "@/lib/nickname";
import { lockBodyScroll } from "@/lib/scroll-lock";

export type RenameLabels = {
  title: string;
  hint: string;
  placeholder: string;
  save: string;
  clear: string;
  saving: string;
  close: string;
  costLabel: string;
  speciesFallback: string;
  errors: Record<string, string>;
};

/**
 * Modal Name Rater: cambiar / borrar mote pagando monedas.
 */
export function RenamePokemonPanel({
  instanceId,
  speciesName,
  nickname,
  coins,
  labels,
  onClose,
  onRenamed,
}: {
  instanceId: string;
  speciesName: string;
  nickname: string | null;
  coins: number;
  labels: RenameLabels;
  onClose: () => void;
  onRenamed?: (next: string | null) => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [value, setValue] = useState(nickname ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const releaseScroll = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
    };
  }, [onClose]);

  const trimmed = value.trim();
  const nextNickname = trimmed.length > 0 ? trimmed.slice(0, MAX_NICKNAME_LENGTH) : null;
  const unchanged = (nickname ?? null) === nextNickname;
  const canAfford = coins >= RENAME_COST;
  const canSubmit = !pending && !unchanged && canAfford;

  function submit(next: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await renamePokemonPaid(instanceId, next, locale);
      if (!result.ok) {
        setError(labels.errors[result.error] ?? result.error);
        return;
      }
      onRenamed?.(result.nickname);
      onClose();
      router.refresh();
    });
  }

  const overlay = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 p-4 backdrop-blur-md sm:items-center">
      <button type="button" aria-label={labels.close} onClick={onClose} className="absolute inset-0" />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0e16]/96 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        <header className="relative shrink-0 border-b border-white/[0.06] px-4 py-3 pr-12">
          <h2 className="truncate text-base font-semibold text-white">{labels.title}</h2>
          <p className="text-[11px] capitalize text-on-surface-variant">
            {nickname ?? speciesName}
          </p>
          <button
            type="button"
            aria-label={labels.close}
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-on-surface-variant transition hover:border-white/25 hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]!">close</span>
          </button>
        </header>

        <div className="px-4 py-3">
          <p className="mb-3 text-[10px] leading-relaxed text-on-surface-variant/70">
            {labels.hint}
          </p>

          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            {labels.placeholder}
          </label>
          <input
            type="text"
            value={value}
            maxLength={MAX_NICKNAME_LENGTH}
            autoFocus
            disabled={pending}
            placeholder={speciesName}
            onChange={(e) => {
              setError(null);
              setValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) submit(value);
            }}
            className="w-full rounded-lg border border-white/12 bg-black/30 px-3 py-2.5 text-sm capitalize text-white outline-none transition placeholder:normal-case placeholder:text-white/25 focus:border-tertiary/50 disabled:opacity-50"
          />
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-on-surface-variant/60">
            <span>
              {value.trim().length}/{MAX_NICKNAME_LENGTH}
            </span>
            <span className={canAfford ? "text-tertiary" : "text-error"}>
              {labels.costLabel}
            </span>
          </div>

          {error && <p className="mt-2 text-[11px] text-error">{error}</p>}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => submit(value)}
              className="flex-1 rounded-lg bg-tertiary px-3 py-2.5 text-[12px] font-bold text-surface transition hover:brightness-110 disabled:opacity-40"
            >
              {pending ? labels.saving : labels.save}
            </button>
            {nickname ? (
              <button
                type="button"
                disabled={pending || !canAfford}
                onClick={() => submit("")}
                className="rounded-lg border border-white/12 px-3 py-2.5 text-[12px] font-semibold text-on-surface-variant transition hover:border-white/25 hover:text-white disabled:opacity-40"
              >
                {labels.clear}
              </button>
            ) : null}
          </div>

          <p className="mt-2 text-center text-[9px] text-on-surface-variant/50">
            {labels.speciesFallback.replace("{species}", speciesName)}
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
