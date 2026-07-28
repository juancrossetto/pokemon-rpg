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
      // Dedup by instanceId keeping last (non-null preferred)
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
    <div className="rounded-xl border border-white/10 bg-glass-surface p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-headline-md text-on-surface">{t("teamTitle")}</h2>
          <p className="text-label-sm text-on-surface-variant mt-0.5">{t("teamBlurb")}</p>
          {usingAdventure && (
            <p className="text-label-sm text-electric-yellow mt-1">{t("teamUsingAdventure")}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => save(false)}
            className="rounded-lg bg-pokeball-red px-3 py-1.5 text-label-md text-white hover:bg-pokeball-red/80 disabled:opacity-60"
          >
            {pending ? t("teamSaving") : t("teamSave")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true)}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-label-md text-on-surface-variant hover:text-on-surface disabled:opacity-60"
          >
            {t("teamClear")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {slots.map((id, i) => {
          const mon = id ? byId.get(id) : null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => clearSlot(i)}
              className="relative flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-2 min-h-[88px] hover:border-pokeball-red/40"
              title={t("teamSlot", { n: i + 1 })}
            >
              <span className="text-[10px] uppercase text-on-surface-variant">
                {t("teamSlot", { n: i + 1 })}
              </span>
              {mon ? (
                <>
                  <Image
                    src={mon.spriteUrl}
                    alt={mon.name}
                    width={48}
                    height={48}
                    className="object-contain"
                    unoptimized
                  />
                  <span className="text-[11px] truncate w-full text-center capitalize">
                    {mon.name}
                  </span>
                </>
              ) : (
                <span className="text-on-surface-variant/40 material-symbols-outlined text-[28px]!">
                  add
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
        {candidates.map((c) => {
          const selected = assigned.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={selected}
              onClick={() => assignToFirstEmpty(c.id)}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${
                selected
                  ? "border-tertiary/40 bg-tertiary/10 opacity-60"
                  : "border-white/10 bg-black/20 hover:border-pokeball-red/40"
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
              <span className="text-label-sm capitalize">
                {c.name}{" "}
                <span className="text-on-surface-variant">Lv.{c.level}</span>
              </span>
            </button>
          );
        })}
      </div>

      {message && message !== "ok" && (
        <p className="mt-2 text-label-sm text-error">{message}</p>
      )}
    </div>
  );
}
