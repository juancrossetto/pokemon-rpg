"use client";

import { useRouter } from "next/navigation";

/** Cambia el país al instante (sin botón Ver). */
export function LeaderboardCountrySelect({
  view,
  country,
  options,
  allLabel,
  countryLabel,
}: {
  view: string;
  country: string;
  options: { code: string; name: string }[];
  allLabel: string;
  countryLabel: string;
}) {
  const router = useRouter();

  return (
    <label className="flex w-full flex-col gap-1">
      {/* En mobile el filtro va en una barra de una sola línea y el rótulo
          sobra: el `aria-label` del select cubre la accesibilidad. */}
      <span className="hidden text-[10px] font-mono uppercase tracking-[0.16em] text-on-surface-variant/70 lg:block">
        {countryLabel}
      </span>
      <select
        value={country}
        aria-label={countryLabel}
        onChange={(event) => {
          const next = event.target.value;
          const params = new URLSearchParams({ view });
          if (next) params.set("country", next);
          router.push(`/ranking?${params.toString()}`);
        }}
        className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-2 text-label-sm text-on-surface focus:border-white/40 focus:outline-none"
      >
        <option value="">{allLabel}</option>
        {options.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
