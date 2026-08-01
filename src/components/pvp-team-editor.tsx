"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { setPvpTeam } from "@/actions/set-pvp-team";

export type PvpTeamCandidate = {
  id: string;
  name: string;
  speciesName: string;
  level: number;
  spriteUrl: string;
  pvpSlot: number | null;
  teamSlot: number | null;
};

const SECTION_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45";

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
    <section className="game-float-card rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={SECTION_LABEL}>{t("teamTitle")}</p>
          <p className="mt-1 text-[12px] text-white/50">{t("teamBlurb")}</p>
          {usingAdventure ? (
            <p className="mt-1.5 text-[11px] font-semibold text-[#ffcb05]">
              {t("teamUsingAdventure")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => save(false)}
            className="game-cta game-cta--red min-h-9! w-auto! px-3.5 text-[0.8rem]"
          >
            {pending ? t("teamSaving") : t("teamSave")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true)}
            className="px-2 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white/45 hover:text-white disabled:opacity-60"
          >
            {t("teamClear")}
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {slots.map((id, i) => {
          const mon = id ? byId.get(id) : null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => clearSlot(i)}
              className={`relative flex min-h-[88px] flex-col items-center gap-1 rounded-xl p-2 transition ${
                mon
                  ? "bg-white/4 hover:bg-white/7"
                  : "border border-dashed border-white/12 hover:border-white/25"
              }`}
              title={t("teamSlot", { n: i + 1 })}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">
                {t("teamSlot", { n: i + 1 })}
              </span>
              {mon ? (
                <>
                  <Image
                    src={mon.spriteUrl}
                    alt={mon.name}
                    width={48}
                    height={48}
                    className="object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                    unoptimized
                  />
                  <span className="w-full truncate text-center text-[11px] capitalize text-white/85">
                    {mon.name}
                  </span>
                </>
              ) : (
                <span className="material-symbols-outlined text-[28px]! text-white/25">
                  add
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
        {candidates.map((c) => {
          const selected = assigned.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={selected}
              onClick={() => assignToFirstEmpty(c.id)}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                selected
                  ? "bg-white/4 opacity-45"
                  : "hover:bg-white/6"
              }`}
            >
              <Image
                src={c.spriteUrl}
                alt={c.name}
                width={32}
                height={32}
                className="object-contain"
                unoptimized
              />
              <span className="text-[12px] capitalize text-white/85">
                {c.name}{" "}
                <span className="font-mono text-white/40">Lv.{c.level}</span>
              </span>
            </button>
          );
        })}
      </div>

      {message && message !== "ok" ? (
        <p className="mt-2 text-[12px] text-error">{message}</p>
      ) : null}
    </section>
  );
}
