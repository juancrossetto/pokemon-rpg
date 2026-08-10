"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { setPvpTeam } from "@/actions/set-pvp-team";
import type { DexRarity } from "@/lib/pokedex";

export type PvpTeamCandidate = {
  id: string;
  name: string;
  speciesName: string;
  level: number;
  spriteUrl: string;
  types: string[];
  rarity: DexRarity;
  isShiny: boolean;
  pvpSlot: number | null;
  teamSlot: number | null;
};

const HEX = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";
const EMPTY_SLOTS: (string | null)[] = [null, null, null, null, null, null];

export function PvpTeamEditor({
  locale,
  candidates,
}: {
  locale: string;
  candidates: PvpTeamCandidate[];
}) {
  const t = useTranslations("pvp");
  const [pending, startTransition] = useTransition();
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    const next = [...EMPTY_SLOTS];
    for (const c of candidates) {
      if (c.pvpSlot != null && c.pvpSlot >= 1 && c.pvpSlot <= 6) {
        next[c.pvpSlot - 1] = c.id;
      }
    }
    return next;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const skipClickRef = useRef(false);
  /** HTML5 DnD en touch captura el gesto y traba el scroll del hub en iOS. */
  const [canDrag, setCanDrag] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    function apply() {
      setCanDrag(mq.matches);
    }
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const assigned = new Set(slots.filter(Boolean) as string[]);
  const usingAdventure = slots.every((s) => s == null);

  function swapSlots(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from > 5 || to > 5) return;
    setSlots((prev) => {
      const next = [...prev];
      const a = next[from] ?? null;
      const b = next[to] ?? null;
      next[from] = b;
      next[to] = a;
      return next;
    });
  }

  function assignToFirstEmpty(id: string) {
    setSlots((prev) => {
      if (prev.includes(id)) return prev;
      const i = prev.findIndex((s) => s == null);
      if (i < 0) return prev;
      const next = [...prev];
      next[i] = id;
      return next;
    });
  }

  function clearSlot(index: number) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setSelected((s) => (s === index ? null : s));
  }

  function onSlotClick(index: number) {
    if (skipClickRef.current || pending) return;
    const mon = slots[index];

    if (selected == null) {
      if (mon) setSelected(index);
      else setPickerOpen(true);
      return;
    }

    if (selected === index) {
      setSelected(null);
      return;
    }

    swapSlots(selected, index);
    setSelected(null);
  }

  function save(clearAll = false) {
    startTransition(async () => {
      const payload = clearAll
        ? candidates.map((c) => ({ instanceId: c.id, pvpSlot: null as number | null }))
        : [
            ...candidates.map((c) => ({ instanceId: c.id, pvpSlot: null as number | null })),
            ...slots
              .map((id, i) => (id ? { instanceId: id, pvpSlot: i + 1 } : null))
              .filter((x): x is { instanceId: string; pvpSlot: number } => !!x),
          ];
      const map = new Map<string, number | null>();
      for (const p of payload) map.set(p.instanceId, p.pvpSlot);
      const result = await setPvpTeam(
        locale,
        [...map.entries()].map(([instanceId, pvpSlot]) => ({ instanceId, pvpSlot })),
      );
      setMessage(result.ok ? "ok" : result.error);
      if (clearAll && result.ok) {
        setSlots([...EMPTY_SLOTS]);
        setSelected(null);
      }
    });
  }

  return (
    <section className="game-float-card rounded-2xl p-3.5 sm:p-5">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-2 sm:mb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            {t("teamTitle")}
          </p>
          {usingAdventure ? (
            <p className="mt-1 text-[11px] font-semibold pvp-arena-accent-text">
              {t("teamUsingAdventure")}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-white/40">{t("teamBlurbShort")}</p>
          )}
          <p className="mt-0.5 text-[10px] text-white/35">{t("teamReorderHint")}</p>
        </div>
        {/* Desktop: acciones en el header. Mobile: van debajo del grid. */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <button
            type="button"
            disabled={pending}
            onClick={() => save(false)}
            className="rounded-lg border border-pokeball-red/45 bg-transparent px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition hover:border-pokeball-red/70 hover:bg-pokeball-red/10 disabled:opacity-60"
          >
            {pending ? t("teamSaving") : t("teamSave")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true)}
            className="rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/45 transition hover:text-white disabled:opacity-60"
          >
            {t("teamClear")}
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 justify-items-center gap-x-3 gap-y-4 sm:mb-4 sm:grid-cols-6 sm:gap-3">
        {slots.map((id, i) => {
          const mon = id ? byId.get(id) : null;
          const isSelected = selected === i;
          const isDragging = dragFrom === i;
          const isOver = dragOver === i && dragFrom != null && dragFrom !== i;

          return (
            <div key={i} className="group relative flex flex-col items-center">
              {mon ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSlot(i);
                  }}
                  className="absolute -right-0.5 -top-0.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white/70 transition hover:bg-error/80 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                  title={t("teamRemove")}
                  aria-label={t("teamRemove")}
                >
                  <span className="material-symbols-outlined text-[12px]! leading-none">close</span>
                </button>
              ) : null}
              <button
                type="button"
                draggable={canDrag && Boolean(mon) && !pending}
                disabled={pending}
                onClick={() => onSlotClick(i)}
                onDragStart={(e) => {
                  if (!mon) {
                    e.preventDefault();
                    return;
                  }
                  skipClickRef.current = true;
                  setDragFrom(i);
                  setSelected(null);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                  requestAnimationFrame(() => {
                    skipClickRef.current = false;
                  });
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOver(i);
                }}
                onDragLeave={() => setDragOver((v) => (v === i ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  const raw = e.dataTransfer.getData("text/plain");
                  const from = Number(raw);
                  if (Number.isInteger(from)) swapSlots(from, i);
                  setDragFrom(null);
                  setDragOver(null);
                  setSelected(null);
                }}
                className={`pvp-hex-slot group relative flex touch-manipulation flex-col items-center ${
                  isDragging ? "opacity-40" : ""
                } ${isSelected || isOver ? "scale-[1.03]" : ""}`}
                title={
                  isSelected
                    ? t("teamSwapTarget")
                    : selected != null
                      ? t("teamSwapTarget")
                      : t("teamSlot", { n: i + 1 })
                }
                aria-pressed={isSelected}
              >
                <span
                  className="relative flex h-[4.6rem] w-[4.6rem] items-center justify-center sm:h-[5.1rem] sm:w-[5.1rem]"
                  style={{
                    clipPath: HEX,
                    background: "transparent",
                    boxShadow: isSelected || isOver
                      ? "inset 0 0 0 2px color-mix(in srgb, var(--color-pokeball-red) 70%, white)"
                      : mon
                        ? "inset 0 0 0 1px rgba(255,255,255,0.22)"
                        : "inset 0 0 0 1px rgba(255,255,255,0.14)",
                  }}
                >
                  {mon ? (
                    <>
                      <Image
                        src={mon.spriteUrl}
                        alt={mon.name}
                        width={56}
                        height={56}
                        className="relative z-10 pointer-events-none object-contain transition duration-300 group-hover:scale-105"
                        unoptimized
                        draggable={false}
                      />
                      {mon.isShiny ? (
                        <span className="absolute right-2 top-2 z-10 text-[10px] leading-none">✨</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="material-symbols-outlined relative z-10 text-[26px]! text-white/30 transition group-hover:text-white/55">
                      add
                    </span>
                  )}
                </span>
                {mon ? (
                  <span className="mt-1.5 flex max-w-[5rem] flex-col items-center gap-0.5 text-center">
                    <span className="w-full truncate text-[10px] capitalize leading-tight text-white/80">
                      {mon.name}
                    </span>
                    <span className="rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums leading-none text-white ring-1 ring-white/15">
                      {t("levelShort", { level: mon.level })}
                    </span>
                  </span>
                ) : (
                  <span className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-white/30">
                    {t("teamSlot", { n: i + 1 })}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Mobile: Save / Clear debajo del equipo, compactos. */}
      <div className="mb-3 flex items-center justify-end gap-2 sm:hidden">
        <button
          type="button"
          disabled={pending}
          onClick={() => save(true)}
          className="rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/45 transition hover:text-white disabled:opacity-60"
        >
          {t("teamClear")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => save(false)}
          className="rounded-md border border-pokeball-red/45 bg-transparent px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition hover:border-pokeball-red/70 hover:bg-pokeball-red/10 disabled:opacity-60"
        >
          {pending ? t("teamSaving") : t("teamSave")}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45 hover:text-white"
      >
        <span className="material-symbols-outlined text-[14px]!">
          {pickerOpen ? "expand_less" : "expand_more"}
        </span>
        {t("teamPickerToggle")}
      </button>

      {pickerOpen ? (
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto overscroll-y-contain rounded-xl border border-white/8 bg-black/25 p-2 touch-pan-y">
          {candidates.map((c) => {
            const isAssigned = assigned.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={isAssigned || pending}
                onClick={() => assignToFirstEmpty(c.id)}
                className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition ${
                  isAssigned ? "bg-white/4 opacity-40" : "hover:bg-white/8"
                }`}
              >
                <Image
                  src={c.spriteUrl}
                  alt={c.name}
                  width={28}
                  height={28}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-[11px] capitalize text-white/85">
                  {c.name}{" "}
                  <span className="font-mono text-white/40">Lv.{c.level}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {message && message !== "ok" ? (
        <p className="mt-2 text-[12px] text-error">{message}</p>
      ) : null}
    </section>
  );
}
