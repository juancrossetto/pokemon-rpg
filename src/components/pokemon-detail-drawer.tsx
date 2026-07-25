"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { typeColor } from "@/lib/type-colors";
import { teachMove } from "@/actions/teach-move";
import { equipHeldItem, unequipHeldItem } from "@/actions/equip-held-item";
import type { TeamMember, TeamRosterLabels } from "@/components/team-roster";

export function PokemonDetailDrawer({
  member,
  labels,
  onClose,
}: {
  member: TeamMember | null;
  labels: TeamRosterLabels;
  onClose: () => void;
}) {
  const locale = useLocale();
  const [teachingItemId, setTeachingItemId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [equipOpen, setEquipOpen] = useState(false);
  const [equipPending, startEquipTransition] = useTransition();
  const [equipError, setEquipError] = useState<string | null>(null);

  useEffect(() => {
    if (!member) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [member, onClose]);

  if (!member) return null;

  const displayName = member.nickname ?? member.speciesName;
  const primaryType = member.types[0] ?? "normal";
  const accent = typeColor(primaryType);
  const fainted = member.currentHp <= 0;
  const teachingItem = member.compatibleTms.find((tm) => tm.itemId === teachingItemId) ?? null;

  function pickSlot(slot: number) {
    if (!teachingItem || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await teachMove(member!.instanceId, teachingItem.itemId, slot, locale);
      if (!result.ok) {
        setError(labels.teachErrors[result.error] ?? result.error);
        return;
      }
      setTeachingItemId(null);
    });
  }

  function equip(itemId: string) {
    if (equipPending) return;
    setEquipError(null);
    startEquipTransition(async () => {
      const result = await equipHeldItem(member!.instanceId, itemId, locale);
      if (!result.ok) {
        setEquipError(labels.equipErrors[result.error] ?? result.error);
        return;
      }
      setEquipOpen(false);
    });
  }

  function unequip() {
    if (equipPending) return;
    setEquipError(null);
    startEquipTransition(async () => {
      const result = await unequipHeldItem(member!.instanceId, locale);
      if (!result.ok) {
        setEquipError(labels.equipErrors[result.error] ?? result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:justify-end sm:p-6">
      <button
        type="button"
        aria-label={labels.close}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-surface-container shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:w-[420px] sm:rounded-3xl sm:border">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: accent }}
        />

        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/15 sm:hidden" />

        <button
          type="button"
          aria-label={labels.close}
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-on-surface-variant transition hover:border-white/25 hover:text-white"
        >
          <span className="material-symbols-outlined text-[18px]!">close</span>
        </button>

        <div className="relative flex-1 overflow-y-auto px-5 pb-6 pt-4">
          <div className="mb-4 flex flex-col items-center text-center">
            <div className="relative flex h-28 w-28 items-center justify-center">
              <div
                className="absolute bottom-1 h-10 w-20 rounded-[100%] opacity-45 blur-lg"
                style={{ background: accent }}
              />
              {member.spriteUrl ? (
                <Image
                  src={member.spriteUrl}
                  alt={member.speciesName}
                  width={112}
                  height={112}
                  className={`relative z-[1] h-28 w-28 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)] ${
                    fainted ? "grayscale" : ""
                  }`}
                />
              ) : (
                <span className="material-symbols-outlined relative z-[1] text-[56px]! text-on-surface-variant/40">
                  sports_baseball
                </span>
              )}
            </div>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-white capitalize">{displayName}</h2>
            {member.nickname && (
              <p className="text-xs capitalize text-on-surface-variant">{member.speciesName}</p>
            )}
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-white">
                {member.levelLabel}
              </span>
              {member.types.map((type) => {
                const color = typeColor(type);
                return (
                  <span
                    key={type}
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{
                      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                      boxShadow: `0 2px 8px ${color}33`,
                    }}
                  >
                    {type}
                  </span>
                );
              })}
              {fainted && (
                <span className="rounded-full bg-error/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-error">
                  {labels.fainted}
                </span>
              )}
            </div>
          </div>

          <section className="mb-5">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              {labels.statsTitle}
            </h3>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
              <div className="mb-1 flex items-end justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {labels.hp}
                </span>
                <span className="font-mono text-xs font-semibold text-white">
                  {member.currentHp}
                  <span className="text-on-surface-variant">/{member.maxHp}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400"
                  style={{ width: `${Math.max(0, Math.min(100, (member.currentHp / member.maxHp) * 100))}%` }}
                />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <DrawerStat label={labels.atk} value={member.atk} />
              <DrawerStat label={labels.def} value={member.def} />
              <DrawerStat label={labels.spAtk} value={member.spAtk} />
              <DrawerStat label={labels.spDef} value={member.spDef} />
              <DrawerStat label={labels.speed} value={member.speed} />
            </div>
          </section>

          <section className="mb-5">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              {labels.movesTitle}
            </h3>
            <div className="flex flex-col gap-1.5">
              {member.moves.map((move, i) =>
                move ? (
                  <div
                    key={move.slot}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: typeColor(move.type), boxShadow: `0 0 6px ${typeColor(move.type)}88` }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium capitalize text-on-surface">
                      {move.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-on-surface-variant">
                      {labels.power}: {move.power ?? labels.noPower}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">
                      {labels.pp} {move.currentPp}/{move.maxPp}
                    </span>
                  </div>
                ) : (
                  <div
                    key={`empty-move-${i}`}
                    className="rounded-lg border border-dashed border-white/10 bg-transparent px-3 py-2 text-center text-[11px] text-on-surface-variant/60"
                  >
                    {labels.emptySlotMove}
                  </div>
                ),
              )}
            </div>
          </section>

          <section className="mb-5">
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              {labels.heldItemTitle}
            </h3>
            <p className="mb-2 text-[10px] text-on-surface-variant/70">{labels.heldItemHint}</p>

            {member.heldItem ? (
              <div className="rounded-lg border border-tertiary/25 bg-tertiary/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]! text-tertiary">
                    auto_awesome
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {member.heldItem.name}
                    </p>
                    {member.heldItem.effectText && (
                      <p className="truncate text-[9px] text-on-surface-variant">
                        {member.heldItem.effectText}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={equipPending}
                    onClick={unequip}
                    className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-on-surface-variant transition hover:border-white/25 disabled:opacity-40"
                  >
                    {equipPending ? labels.equipping : labels.unequip}
                  </button>
                </div>
              </div>
            ) : equipOpen ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                {member.ownedHeldItems.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-on-surface-variant/60">
                    {labels.noHeldItems}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {member.ownedHeldItems.map((item) => (
                      <button
                        key={item.itemId}
                        type="button"
                        disabled={equipPending}
                        onClick={() => equip(item.itemId)}
                        className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-left transition hover:border-tertiary/50 disabled:opacity-40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-medium text-on-surface">{item.name}</p>
                          {item.effectText && (
                            <p className="truncate text-[9px] text-on-surface-variant">
                              {item.effectText}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">
                          x{item.quantity}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setEquipOpen(false)}
                  className="mt-2 w-full rounded-md border border-white/10 py-1 text-[10px] font-semibold text-on-surface-variant transition hover:border-white/25"
                >
                  {labels.cancel}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEquipOpen(true)}
                className="w-full rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-[11px] text-on-surface-variant/60 transition hover:border-white/25 hover:text-on-surface-variant"
              >
                {labels.heldItemEmpty}
              </button>
            )}

            {equipError && <p className="mt-2 text-[11px] text-error">{equipError}</p>}
          </section>

          <section>
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              {labels.tmSectionTitle}
            </h3>
            <p className="mb-2 text-[10px] text-on-surface-variant/70">{labels.tmSectionHint}</p>

            {member.compatibleTms.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-[11px] text-on-surface-variant/60">
                {labels.tmNone}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {member.compatibleTms.map((tm) => {
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
                            {tm.moveName}
                          </p>
                          <p className="truncate text-[9px] text-on-surface-variant">
                            {tm.code} · {labels.power}: {tm.movePower ?? labels.noPower} · x{tm.quantity}
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
                          <p className="mb-1.5 text-[10px] text-on-surface-variant">{labels.pickSlot}</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {member.moves.map((move, i) => (
                              <button
                                key={`slot-${i}`}
                                type="button"
                                disabled={pending}
                                onClick={() => pickSlot(i + 1)}
                                className="truncate rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-left text-[11px] capitalize text-on-surface transition hover:border-tertiary/50 disabled:opacity-40"
                              >
                                {pending ? labels.teaching : move ? move.name : labels.emptySlotMove}
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
          </section>
        </div>
      </div>
    </div>
  );
}

function DrawerStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-1 py-1.5 text-center">
      <p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant leading-none">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xs font-semibold text-white leading-none">{value}</p>
    </div>
  );
}
