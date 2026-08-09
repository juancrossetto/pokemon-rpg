"use client";

import Image from "next/image";
import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { teachMove } from "@/actions/teach-move";
import { typeColor } from "@/lib/type-colors";
import { formatMoveName } from "@/lib/format-move-name";
import type { TeamCompatibleTm, TeamMoveDetail } from "@/components/team-roster";
import { SquadItemFx, fxMetaFromColor } from "@/components/use-squad-actions";
import { playUiSfx } from "@/lib/battle-sfx";
import { lockBodyScroll } from "@/lib/scroll-lock";

export type TeachTmLabels = {
  title: string;
  hint: string;
  none: string;
  teach: string;
  pickSlot: string;
  cancel: string;
  teaching: string;
  alreadyKnown: string;
  power: string;
  noPower: string;
  emptySlotMove: string;
  close: string;
  teachErrors: Record<string, string>;
};

/**
 * Modal para enseñar MTs: lista compatible → elegir slot.
 * Abierto desde el menú ⋮ (o deep-link del inventario).
 */
export function TeachTmPanel({
  instanceId,
  pokemonName,
  spriteUrl,
  moves,
  compatibleTms,
  labels,
  initialTeachItemId = null,
  onClose,
  onTaught,
}: {
  instanceId: string;
  pokemonName: string;
  spriteUrl?: string | null;
  moves: (TeamMoveDetail | null)[];
  compatibleTms: TeamCompatibleTm[];
  labels: TeachTmLabels;
  initialTeachItemId?: string | null;
  onClose: () => void;
  onTaught?: () => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [teachingItemId, setTeachingItemId] = useState<string | null>(initialTeachItemId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [teachFx, setTeachFx] = useState<{
    label: string;
    color: string;
    key: number;
  } | null>(null);

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

  useEffect(() => {
    if (!teachFx) return;
    const t = window.setTimeout(() => setTeachFx(null), 2100);
    return () => window.clearTimeout(t);
  }, [teachFx]);

  const teachingItem = compatibleTms.find((tm) => tm.itemId === teachingItemId) ?? null;

  function pickSlot(slot: number) {
    if (!teachingItem || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await teachMove(instanceId, teachingItem.itemId, slot, locale);
      if (!result.ok) {
        setError(labels.teachErrors[result.error] ?? result.error);
        return;
      }
      playUiSfx("restorePp");
      setTeachFx({
        label: formatMoveName(teachingItem.moveName, locale),
        color: typeColor(teachingItem.moveType),
        key: Date.now(),
      });
      setTeachingItemId(null);
      onTaught?.();
      router.refresh();
    });
  }

  const overlay = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 p-4 backdrop-blur-md sm:items-center">
      <button type="button" aria-label={labels.close} onClick={onClose} className="absolute inset-0" />
      <div className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0e16]/96 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3 pr-12">
          <div
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center ${
              teachFx ? "squad-fx-pulse" : ""
            }`}
            style={
              teachFx
                ? ({ "--squad-fx-glow": `${teachFx.color}88` } as CSSProperties)
                : undefined
            }
          >
            {teachFx && (
              <SquadItemFx
                key={teachFx.key}
                kind="machine"
                label={teachFx.label}
                meta={fxMetaFromColor(teachFx.color)}
              />
            )}
            {spriteUrl ? (
              <Image
                src={spriteUrl}
                alt=""
                width={48}
                height={48}
                className="relative z-[1] h-12 w-12 object-contain"
              />
            ) : (
              <span className="material-symbols-outlined text-[28px]! text-on-surface-variant/40">
                sports_baseball
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-white capitalize">{pokemonName}</h2>
            <p className="text-[11px] text-on-surface-variant">{labels.title}</p>
          </div>
          <button
            type="button"
            aria-label={labels.close}
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-on-surface-variant transition hover:border-white/25 hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]!">close</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <p className="mb-3 text-[10px] text-on-surface-variant/70">{labels.hint}</p>

          {compatibleTms.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-on-surface-variant/60">
              {labels.none}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {compatibleTms.map((tm) => {
                const color = typeColor(tm.moveType);
                const isOpen = teachingItemId === tm.itemId;
                return (
                  <div
                    key={tm.itemId}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium capitalize text-on-surface">
                          {formatMoveName(tm.moveName, locale)}
                        </p>
                        <p className="truncate text-[9px] text-on-surface-variant">
                          {tm.code} · {labels.power}: {tm.movePower ?? labels.noPower} · x
                          {tm.quantity}
                        </p>
                      </div>
                      {tm.alreadyKnown ? (
                        <span className="shrink-0 text-[10px] font-semibold text-on-surface-variant/60">
                          {labels.alreadyKnown}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setError(null);
                            setTeachingItemId(isOpen ? null : tm.itemId);
                          }}
                          className="shrink-0 rounded-full bg-tertiary px-3 py-1 text-[10px] font-bold text-surface transition hover:brightness-110 disabled:opacity-40"
                        >
                          {isOpen ? labels.cancel : labels.teach}
                        </button>
                      )}
                    </div>

                    {isOpen && (
                      <div className="mt-2 border-t border-white/[0.06] pt-2">
                        <p className="mb-1.5 text-[10px] text-on-surface-variant">
                          {labels.pickSlot}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {moves.map((move, i) => (
                            <button
                              key={`slot-${i}`}
                              type="button"
                              disabled={pending}
                              onClick={() => pickSlot(i + 1)}
                              className="truncate rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-left text-[11px] capitalize text-on-surface transition hover:border-tertiary/50 disabled:opacity-40"
                            >
                              {pending
                                ? labels.teaching
                                : move
                                  ? formatMoveName(move.name, locale)
                                  : labels.emptySlotMove}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="mt-2 text-[11px] text-error">{error}</p>}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
