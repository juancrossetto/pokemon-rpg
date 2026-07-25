"use client";

import { useRef } from "react";
import { Link } from "@/i18n/navigation";
import type { MarketCategory } from "@/lib/market-hub";

type Sort = "recent" | "price_asc" | "price_desc" | "level_desc";

const FIELD =
  "h-9 w-full rounded-md border border-white/12 bg-black/40 px-2.5 text-label-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/45 focus:border-pokeball-red/55 focus:ring-1 focus:ring-pokeball-red/30";

/**
 * Barra de filtros estilo Auction House / MMO.
 * Category vive en la sidebar (param `cat`); acá van search, precio y sort.
 */
export function MarketFilterForm({
  q,
  cat,
  sort,
  min,
  max,
  minPrice,
  maxPrice,
  hasFilters,
  labels,
  sorts,
}: {
  q: string;
  cat: MarketCategory;
  sort: Sort;
  min: number | null;
  max: number | null;
  minPrice: number;
  maxPrice: number;
  hasFilters: boolean;
  labels: {
    searchPlaceholder: string;
    searchLabel: string;
    apply: string;
    clear: string;
    sortLabel: string;
    minPrice: string;
    maxPrice: string;
    price: string;
    reset: string;
    sort: Record<Sort, string>;
  };
  sorts: readonly Sort[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const visibleSorts = cat !== "pokemon" && cat !== "all"
    ? sorts.filter((s) => s !== "level_desc")
    : cat === "pokemon"
      ? sorts
      : sorts;

  return (
    <form
      ref={formRef}
      method="get"
      className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/35 p-3 backdrop-blur-md sm:flex-row sm:flex-wrap sm:items-end"
    >
      <input type="hidden" name="tab" value="browse" />
      {cat !== "all" && <input type="hidden" name="cat" value={cat} />}

      <label className="relative min-w-0 flex-1 sm:min-w-[200px]">
        <span className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/70">
          {labels.searchLabel}
        </span>
        <span className="material-symbols-outlined pointer-events-none absolute bottom-2 left-2.5 text-[18px]! text-on-surface-variant/65">
          search
        </span>
        <input
          type="text"
          name="q"
          defaultValue={q}
          maxLength={50}
          placeholder={labels.searchPlaceholder}
          className={`${FIELD} pl-9`}
        />
      </label>

      <label className="w-full sm:w-28">
        <span className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/70">
          {labels.minPrice}
        </span>
        <input
          type="number"
          name="min"
          min={minPrice}
          max={maxPrice}
          defaultValue={min ?? ""}
          placeholder="—"
          className={FIELD}
        />
      </label>

      <label className="w-full sm:w-28">
        <span className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/70">
          {labels.maxPrice}
        </span>
        <input
          type="number"
          name="max"
          min={minPrice}
          max={maxPrice}
          defaultValue={max ?? ""}
          placeholder="—"
          className={FIELD}
        />
      </label>

      <label className="w-full sm:w-44">
        <span className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/70">
          {labels.sortLabel}
        </span>
        <select
          name="sort"
          defaultValue={
            cat !== "all" && cat !== "pokemon" && sort === "level_desc" ? "recent" : sort
          }
          className={FIELD}
          onChange={() => formRef.current?.requestSubmit()}
        >
          {visibleSorts.map((value) => (
            <option key={value} value={value}>
              {labels.sort[value]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
        <button
          type="submit"
          className="market-buy-btn h-9 flex-1 rounded-md bg-pokeball-red px-4 text-label-sm font-semibold uppercase tracking-wide text-white transition sm:flex-none"
        >
          {labels.apply}
        </button>
        {hasFilters && (
          <Link
            href="/market?tab=browse"
            className="inline-flex h-9 items-center rounded-md border border-white/12 px-3 text-label-sm text-on-surface-variant transition hover:border-white/25 hover:text-on-surface"
          >
            {labels.reset}
          </Link>
        )}
      </div>
    </form>
  );
}
