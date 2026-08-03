"use client";

import { useMemo, useState, useTransition } from "react";
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
    const next: (string | null)[] = [null, null, null, null, null, null];
    for (const c of candidates) {
      if (c.pvpSlot != null && c.pvpSlot >= 1 && c.pvpSlot <= 6) {
        next[c.pvpSlot - 1] = c.id;
      }
    }
    return next;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const assigned = new Set(slots.filter(Boolean) as string[]);
  const usingAdventure = slots.every((s) => s == null);

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
        setSlots([null, null, null, null, null, null]);
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

          return (
            <button
              key={i}
              type="button"
              onClick={() => (mon ? clearSlot(i) : setPickerOpen(true))}
              className="pvp-hex-slot group relative flex flex-col items-center"
              title={t("teamSlot", { n: i + 1 })}
            >
              <span
                className="relative flex h-[4.6rem] w-[4.6rem] items-center justify-center sm:h-[5.1rem] sm:w-[5.1rem]"
                style={{
                  clipPath: HEX,
                  background: "transparent",
                  boxShadow: mon
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
                      className="relative z-10 object-contain transition duration-300 group-hover:scale-105"
                      unoptimized
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
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-white/8 bg-black/25 p-2">
          {candidates.map((c) => {
            const selected = assigned.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={selected}
                onClick={() => assignToFirstEmpty(c.id)}
                className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition ${
                  selected ? "bg-white/4 opacity-40" : "hover:bg-white/8"
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
