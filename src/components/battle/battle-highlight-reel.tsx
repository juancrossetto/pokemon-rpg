"use client";

import type { BattleHighlight } from "@/lib/battle-highlights";

/** Reel de momentos clave al ganar (crit / SE / KO / rachas). */

export function BattleHighlightReel({
  title,
  items,
  labels,
}: {
  title: string;
  items: BattleHighlight[];
  labels: {
    crit: string;
    superEffective: string;
    ko: string;
    ohko: string;
    multiHit: (count: number) => string;
    seStreak: (count: number) => string;
  };
}) {
  if (items.length === 0) return null;

  return (
    <section className="battle-highlight-reel mt-3 rounded-2xl border border-white/8 bg-black/40 p-3 md:p-4">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {title}
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => {
          const text =
            item.kind === "crit"
              ? labels.crit
              : item.kind === "superEffective"
                ? labels.superEffective
                : item.kind === "ko"
                  ? labels.ko
                  : item.kind === "ohko"
                    ? labels.ohko
                    : item.kind === "multiHit"
                      ? labels.multiHit(item.count ?? 2)
                      : labels.seStreak(item.count ?? 3);
          return (
            <li
              key={`${item.kind}-${i}`}
              className={`battle-highlight-reel__item battle-highlight-reel__item--${item.kind}`}
              style={{ animationDelay: `${0.08 + i * 0.07}s` }}
            >
              <span className="battle-highlight-reel__kind">{text}</span>
              {item.moveName ? (
                <span className="battle-highlight-reel__move">{item.moveName}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
