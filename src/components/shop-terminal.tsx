"use client";

import { useState, useTransition } from "react";
import { buyItem } from "@/actions/buy-item";

export interface ShopEntry {
  id: string;
  name: string;
  type: "POTION" | "POKEBALL" | "HELD";
  buyPrice: number;
  effectText: string | null;
}

export interface ShopLabels {
  types: Record<ShopEntry["type"], string>;
  buy: string;
  buying: string;
  noCoins: string;
  coinsLabel: string;
}

export function ShopTerminal({
  entries,
  labels,
  locale,
  initialCoins,
}: {
  entries: ShopEntry[];
  labels: ShopLabels;
  locale: string;
  initialCoins: number;
}) {
  const [coins, setCoins] = useState(initialCoins);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = entries.reduce<Record<string, ShopEntry[]>>((acc, entry) => {
    (acc[entry.type] ??= []).push(entry);
    return acc;
  }, {});

  function buy(entry: ShopEntry) {
    if (pending || coins < entry.buyPrice) return;
    setError(null);
    setPendingId(entry.id);
    startTransition(async () => {
      const result = await buyItem(entry.id, locale);
      if (!result.ok) {
        setError(result.error === "no_coins" ? labels.noCoins : result.error);
      } else {
        setCoins(result.coinsLeft);
      }
      setPendingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-label-sm text-error">
          {error}
        </p>
      )}
      {Object.entries(groups).map(([type, items]) => (
        <section key={type}>
          <h2 className="mb-2 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
            {labels.types[type as ShopEntry["type"]]}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((entry) => {
              const canAfford = coins >= entry.buyPrice;
              return (
                <div
                  key={entry.id}
                  className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{entry.name}</p>
                    {entry.effectText && (
                      <p className="mt-0.5 text-[11px] text-on-surface-variant">{entry.effectText}</p>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 font-mono text-xs font-semibold text-tertiary">
                      <span className="material-symbols-outlined text-[14px]!">paid</span>
                      {entry.buyPrice}
                    </span>
                    <button
                      type="button"
                      disabled={pending || !canAfford}
                      onClick={() => buy(entry)}
                      className="rounded-full bg-pokeball-red px-3 py-1 text-[11px] font-bold text-white transition hover:bg-pokeball-red/90 disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
                    >
                      {pendingId === entry.id ? labels.buying : labels.buy}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
