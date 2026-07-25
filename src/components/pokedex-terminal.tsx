"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { typeColor } from "@/lib/type-colors";
import { spriteFor } from "@/lib/shiny";
import {
  POKEDEX_REGIONS,
  RARITY_ORDER,
  RARITY_STYLES,
  type DexQuickFilter,
  type DexSort,
  type DexView,
  type PokedexProgress,
  type PokedexRegionId,
  type PokedexSpeciesCard,
} from "@/lib/pokedex";

export type PokedexLabels = {
  eyebrow: string;
  title: string;
  researchDatabase: string;
  signInHint: string;
  comingSoon: string;
  noResults: string;
  completion: string;
  searchPlaceholder: string;
  regions: Record<PokedexRegionId, string>;
  progress: {
    seen: string;
    captured: string;
    completion: string;
    shiny: string;
    legendary: string;
  };
  filters: Record<DexQuickFilter, string>;
  sort: {
    label: string;
    number: string;
    name: string;
    rarity: string;
  };
  view: {
    grid: string;
    list: string;
  };
  typeFilter: string;
  allTypes: string;
  pokemonTypes: Record<string, string>;
  rarity: Record<string, string>;
  stats: {
    hp: string;
    atk: string;
    def: string;
    spa: string;
    spd: string;
    spe: string;
    capture: string;
    evolves: string;
  };
  unknown: string;
  statusCaught: string;
  statusSeen: string;
  research: string;
  icons: {
    favorite: string;
    shiny: string;
    legendary: string;
    mythical: string;
    starter: string;
    pseudo: string;
  };
};

const ALL_TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;

const QUICK_FILTERS: DexQuickFilter[] = [
  "all",
  "seen",
  "caught",
  "missing",
  "favorites",
  "shiny",
  "legendary",
  "mythical",
  "starter",
  "pseudo",
];

/**
 * Terminal de investigación Pokédex: progreso, regiones, filtros y grilla.
 * Client-side para filtrar sin round-trips; los datos ya vienen del server.
 */
export function PokedexTerminal({
  entries,
  progress,
  labels,
  signedIn,
  initialRegion = "kanto",
}: {
  entries: PokedexSpeciesCard[];
  progress: PokedexProgress;
  labels: PokedexLabels;
  signedIn: boolean;
  initialRegion?: PokedexRegionId;
}) {
  const [region, setRegion] = useState<PokedexRegionId>(initialRegion);
  const [quick, setQuick] = useState<DexQuickFilter>("all");
  const [type, setType] = useState<string>("");
  const [sort, setSort] = useState<DexSort>("number");
  const [view, setView] = useState<DexView>("grid");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const regionDef = POKEDEX_REGIONS.find((r) => r.id === region)!;
  const regionProg = progress.regions.find((r) => r.id === region);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = entries.filter((e) => e.generation === regionDef.generation);

    if (q) {
      list = list.filter((e) => {
        if (e.name.includes(q)) return true;
        if (String(e.id) === q || String(e.id).padStart(3, "0") === q) return true;
        if (e.types.some((t) => t.toLowerCase().includes(q))) return true;
        if (
          e.types.some((t) =>
            (labels.pokemonTypes[t.toLowerCase()] ?? t).toLowerCase().includes(q),
          )
        ) {
          return true;
        }
        if (labels.regions[region].toLowerCase().includes(q) && e.generation === regionDef.generation) {
          return true;
        }
        return false;
      });
    }

    if (type) {
      list = list.filter((e) => e.types.some((t) => t.toLowerCase() === type));
    }

    switch (quick) {
      case "seen":
        list = list.filter((e) => e.status === "seen" || e.status === "caught");
        break;
      case "caught":
        list = list.filter((e) => e.status === "caught");
        break;
      case "missing":
        list = list.filter((e) => e.status !== "caught");
        break;
      case "favorites":
        list = list.filter((e) => e.isFavorite);
        break;
      case "shiny":
        list = list.filter((e) => e.hasShiny);
        break;
      case "legendary":
        list = list.filter((e) => e.isLegendary && !e.isMythical);
        break;
      case "mythical":
        list = list.filter((e) => e.isMythical);
        break;
      case "starter":
        list = list.filter((e) => e.isStarter);
        break;
      case "pseudo":
        list = list.filter((e) => e.isPseudo);
        break;
      default:
        break;
    }

    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "rarity") {
      sorted.sort(
        (a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || a.id - b.id,
      );
    } else {
      sorted.sort((a, b) => a.id - b.id);
    }
    return sorted;
  }, [entries, regionDef.generation, query, type, quick, sort, labels.regions, region]);

  const completionPct = regionProg
    ? regionProg.total === 0
      ? 0
      : Math.round((regionProg.caught / regionProg.total) * 1000) / 10
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header progreso */}
      <header className="space-y-4">
        <div>
          <h1 className="text-headline-lg tracking-tight text-white md:text-display-sm">
            {labels.title}
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-on-surface-variant">
            {labels.researchDatabase}
          </p>
        </div>

        {signedIn ? (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-white/8 py-3">
            <ProgressStat
              label={labels.progress.seen}
              value={`${progress.seen}`}
              sub={`/ ${progress.total}`}
            />
            <ProgressStat
              label={labels.progress.captured}
              value={`${progress.caught}`}
              sub={`/ ${progress.total}`}
              accent
            />
            <div className="min-w-36 flex-1">
              <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                {labels.progress.completion}
              </p>
              <div className="h-1 overflow-hidden rounded-sm bg-white/10">
                <div
                  className="h-full bg-pokeball-red/80 transition-all duration-700"
                  style={{ width: `${progress.completion}%` }}
                />
              </div>
              <p className="mt-1 font-mono text-[11px] text-electric-yellow">
                {progress.completion.toFixed(1)}%
              </p>
            </div>
            <ProgressStat label={labels.progress.shiny} value={String(progress.shiny)} />
            <ProgressStat
              label={labels.progress.legendary}
              value={String(progress.legendary)}
            />
          </div>
        ) : (
          <p className="border-y border-white/8 py-3 text-label-sm text-on-surface-variant">
            {labels.signInHint}
          </p>
        )}
      </header>

      {/* Regiones */}
      <section className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {POKEDEX_REGIONS.map((r) => {
            const rp = progress.regions.find((x) => x.id === r.id);
            const active = region === r.id;
            const locked = !r.available || (rp && rp.total === 0);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRegion(r.id);
                  setExpandedId(null);
                }}
                className={[
                  "shrink-0 min-w-[5.5rem] rounded-md border px-3.5 py-2 text-left transition-all",
                  active
                    ? "border-pokeball-red/55 bg-pokeball-red/12 text-white shadow-[inset_0_-1px_0_rgba(220,38,38,0.35)]"
                    : "border-white/10 bg-black/25 text-on-surface-variant hover:border-white/22 hover:text-on-surface",
                ].join(" ")}
              >
                <span className="block text-label-sm font-medium tracking-wide">
                  {labels.regions[r.id]}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] tabular-nums opacity-70">
                  {locked ? labels.comingSoon : `${rp?.caught ?? 0}/${rp?.total ?? 0}`}
                </span>
              </button>
            );
          })}
        </div>

        {regionProg && regionProg.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                {labels.completion}
              </span>
              <span className="font-mono text-[11px] text-electric-yellow tabular-nums">
                {completionPct}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-sm bg-white/10">
              <div
                className="h-full bg-electric-yellow/70 transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Controles */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px]! text-on-surface-variant">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.searchPlaceholder}
              className="w-full rounded-md border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-label-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/50 focus:border-pokeball-red/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
              {labels.sort.label}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as DexSort)}
                className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-label-sm text-on-surface outline-none focus:border-pokeball-red/40"
              >
                <option value="number">{labels.sort.number}</option>
                <option value="name">{labels.sort.name}</option>
                <option value="rarity">{labels.sort.rarity}</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
              {labels.typeFilter}
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-label-sm capitalize text-on-surface outline-none focus:border-pokeball-red/40"
              >
                <option value="">{labels.allTypes}</option>
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {labels.pokemonTypes[t] ?? t}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex rounded-md border border-white/10 p-0.5">
              <ViewToggle
                active={view === "grid"}
                icon="grid_view"
                label={labels.view.grid}
                onClick={() => setView("grid")}
              />
              <ViewToggle
                active={view === "list"}
                icon="view_list"
                label={labels.view.list}
                onClick={() => setView("list")}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setQuick(f)}
              className={[
                "shrink-0 rounded-md border px-3 py-1.5 text-label-sm transition-colors",
                quick === f
                  ? "border-electric-yellow/45 bg-electric-yellow/10 text-electric-yellow"
                  : "border-white/10 bg-black/20 text-on-surface-variant hover:border-white/20 hover:text-on-surface",
              ].join(" ")}
            >
              {labels.filters[f]}
            </button>
          ))}
        </div>
      </section>

      {/* Colecciones por región (compacto) */}
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {progress.regions.slice(0, 4).map((r) => {
          const pct = r.total === 0 ? 0 : Math.round((r.caught / r.total) * 100);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRegion(r.id)}
              className="rounded-md border border-white/8 bg-black/20 px-3 py-2 text-left transition hover:border-white/15"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-label-sm text-on-surface">{labels.regions[r.id]}</span>
                <span className="font-mono text-[10px] text-on-surface-variant">
                  {r.total === 0 ? labels.comingSoon : `${pct}%`}
                </span>
              </div>
              <div className="mt-1.5 h-0.5 overflow-hidden rounded-sm bg-white/10">
                <div
                  className="h-full bg-pokeball-red/60"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </section>

      {/* Grid / list */}
      {!regionDef.available || (regionProg && regionProg.total === 0) ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 px-6 py-12 text-center">
          <span className="material-symbols-outlined text-[28px]! text-on-surface-variant/35">
            lock
          </span>
          <p className="font-mono text-label-sm uppercase tracking-[0.18em] text-on-surface-variant">
            {labels.comingSoon}
          </p>
          <p className="text-label-sm text-on-surface-variant/70">{labels.regions[region]}</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-body-md text-on-surface-variant">
          {labels.noResults}
        </p>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((entry) => (
            <DexCard
              key={entry.id}
              entry={entry}
              labels={labels}
              expanded={expandedId === entry.id}
              onToggle={() =>
                setExpandedId((id) => (id === entry.id ? null : entry.id))
              }
            />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1">
          {visible.map((entry) => (
            <DexListRow
              key={entry.id}
              entry={entry}
              labels={labels}
              expanded={expandedId === entry.id}
              onToggle={() =>
                setExpandedId((id) => (id === entry.id ? null : entry.id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProgressStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p
        className={[
          "font-mono text-headline-sm leading-none",
          accent ? "text-pokeball-red" : "text-white",
        ].join(" ")}
      >
        {value}
        {sub ? (
          <span className="ml-1 text-label-sm text-on-surface-variant">{sub}</span>
        ) : null}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
        {label}
      </p>
    </div>
  );
}

function ViewToggle({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={[
        "rounded px-2 py-1 transition-colors",
        active ? "bg-white/10 text-white" : "text-on-surface-variant hover:text-on-surface",
      ].join(" ")}
    >
      <span className="material-symbols-outlined text-[18px]!">{icon}</span>
    </button>
  );
}

/**
 * Aura sutil detrás del Pokémon: pinceladas / salpicaduras del color del tipo,
 * bien difuminadas. Casi no se notan; el sprite sigue siendo protagonista.
 */
function EnergyAura({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Halo central muy suave */}
      <div
        className="absolute left-1/2 top-[30%] h-[55%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.38]"
        style={{
          background: `radial-gradient(ellipse at center, ${color}70 0%, ${color}28 42%, transparent 72%)`,
          filter: "blur(18px)",
        }}
      />

      {/* Pincelada inferior irregular (no línea recta) */}
      <div
        className="absolute left-[-8%] bottom-[18%] h-[38%] w-[70%] -rotate-[8deg] opacity-[0.34]"
        style={{
          background: `radial-gradient(ellipse 90% 55% at 50% 60%, ${color}80 0%, ${color}30 40%, transparent 72%)`,
          filter: "blur(14px)",
          borderRadius: "60% 40% 55% 45% / 45% 55% 40% 60%",
        }}
      />
      <div
        className="absolute right-[-10%] bottom-[22%] h-[32%] w-[58%] rotate-[11deg] opacity-[0.3]"
        style={{
          background: `radial-gradient(ellipse 85% 50% at 45% 55%, ${color}75 0%, transparent 70%)`,
          filter: "blur(16px)",
          borderRadius: "40% 60% 50% 50% / 55% 40% 60% 45%",
        }}
      />

      {/* Pinceladas laterales / salpicaduras */}
      <div
        className="absolute left-[4%] top-[28%] h-[28%] w-[34%] -rotate-[18deg] opacity-[0.28]"
        style={{
          background: `radial-gradient(ellipse at 60% 50%, ${color}66 0%, transparent 68%)`,
          filter: "blur(12px)",
          borderRadius: "70% 30% 60% 40% / 40% 60% 30% 70%",
        }}
      />
      <div
        className="absolute right-[2%] top-[22%] h-[26%] w-[30%] rotate-[22deg] opacity-[0.25]"
        style={{
          background: `radial-gradient(ellipse at 40% 55%, ${color}55 0%, transparent 70%)`,
          filter: "blur(13px)",
          borderRadius: "30% 70% 40% 60% / 60% 30% 70% 40%",
        }}
      />

      {/* Salpicaduras puntuales muy tenues */}
      <div
        className="absolute left-[22%] top-[48%] h-3 w-3 rounded-full opacity-[0.32]"
        style={{ background: color, filter: "blur(3px)" }}
      />
      <div
        className="absolute right-[24%] top-[42%] h-2 w-2 rounded-full opacity-[0.28]"
        style={{ background: color, filter: "blur(2.5px)" }}
      />
      <div
        className="absolute left-[38%] bottom-[28%] h-2.5 w-4 rounded-full opacity-[0.26] -rotate-12"
        style={{ background: color, filter: "blur(3px)" }}
      />
      <div
        className="absolute right-[32%] bottom-[34%] h-2 w-2.5 rounded-full opacity-[0.24] rotate-6"
        style={{ background: color, filter: "blur(2.5px)" }}
      />
    </div>
  );
}

function DexCard({
  entry,
  labels,
  expanded,
  onToggle,
}: {
  entry: PokedexSpeciesCard;
  labels: PokedexLabels;
  expanded: boolean;
  onToggle: () => void;
}) {
  const primary = entry.types[0] ?? "normal";
  const glow = typeColor(primary);
  const unseen = entry.status === "unseen";
  const seenOnly = entry.status === "seen";
  const caught = entry.status === "caught";

  const tip = caught
    ? `${entry.name} · HP ${entry.baseHp} · Atk ${entry.baseAttack} · Spe ${entry.baseSpeed}`
    : seenOnly
      ? entry.name
      : labels.unknown;

  const statusLabel = unseen
    ? labels.unknown
    : seenOnly
      ? labels.statusSeen
      : labels.statusCaught;
  // Iconos del set cargado (evitar ligatures que no existen → texto crudo tipo CATCHING_POKEMON)
  const statusIcon = unseen ? "help" : seenOnly ? "visibility" : "check_circle";

  return (
    <li className="h-full">
      <button
        type="button"
        onClick={onToggle}
        title={tip}
        className={[
          "group relative flex h-full min-h-[17.5rem] w-full flex-col overflow-hidden rounded-xl border text-center transition-all duration-300",
          "hover:-translate-y-0.5",
          unseen
            ? "border-white/10 bg-[#0c0e12] hover:border-white/18"
            : "border-white/12 bg-[#080a0e] hover:border-white/22",
          expanded && caught ? "border-white/25" : "",
          caught ? "dex-caught-pulse" : "",
        ].join(" ")}
        style={{
          boxShadow: unseen
            ? undefined
            : `0 0 0 1px ${glow}14, 0 10px 24px -16px ${glow}40`,
        }}
      >
        {/* Acento inferior por tipo */}
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[2px]"
          style={{ backgroundColor: unseen ? "rgba(255,255,255,0.12)" : glow }}
        />

        {/* Header */}
        <div className="relative z-20 flex items-center justify-between px-3 pt-2.5">
          <span className="font-mono text-[11px] text-white/55">
            #{String(entry.id).padStart(3, "0")}
          </span>
          <span className="flex items-center gap-0.5">
            {entry.isFavorite ? (
              <span
                className="material-symbols-outlined text-[14px]! text-electric-yellow"
                title={labels.icons.favorite}
              >
                star
              </span>
            ) : null}
            {entry.hasShiny ? (
              <span
                className="material-symbols-outlined text-[14px]! text-pink-300"
                title={labels.icons.shiny}
              >
                auto_awesome
              </span>
            ) : null}
            {entry.isLegendary || entry.isMythical ? (
              <span
                className="material-symbols-outlined text-[14px]! text-violet-300"
                title={
                  entry.isMythical ? labels.icons.mythical : labels.icons.legendary
                }
              >
                workspace_premium
              </span>
            ) : null}
          </span>
        </div>

        {/* Artwork + aura sutil */}
        <div className="relative z-10 flex min-h-[8.5rem] flex-1 items-center justify-center px-2">
          {!unseen ? <EnergyAura color={glow} /> : null}

          {entry.spriteUrl ? (
            <Image
              src={spriteFor(entry.spriteUrl, entry.hasShiny)}
              alt={unseen ? labels.unknown : entry.name}
              width={112}
              height={112}
              className={[
                "relative z-10 h-24 w-24 object-contain transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.05] sm:h-28 sm:w-28",
                unseen
                  ? "brightness-0 invert opacity-[0.42] drop-shadow-[0_0_6px_rgba(255,255,255,0.12)]"
                  : "drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]",
                seenOnly && !unseen ? "opacity-90" : "",
              ].join(" ")}
            />
          ) : null}

          {/* Stats al hover/expand: solo sobre el arte */}
          {caught && (
            <div
              className={[
                "pointer-events-none absolute inset-x-1 bottom-0 z-20 rounded-md px-2 pb-1.5 pt-8 transition-opacity duration-300",
                expanded
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100",
              ].join(" ")}
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, rgba(6,8,12,0.88) 55%, rgba(6,8,12,0.96) 100%)",
              }}
            >
              <dl className="grid grid-cols-3 gap-x-1.5 gap-y-0.5 text-center">
                {(
                  [
                    [labels.stats.hp, entry.baseHp],
                    [labels.stats.atk, entry.baseAttack],
                    [labels.stats.def, entry.baseDefense],
                    [labels.stats.spa, entry.baseSpAtk],
                    [labels.stats.spd, entry.baseSpDef],
                    [labels.stats.spe, entry.baseSpeed],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[8px] uppercase tracking-wide text-white/55">{k}</dt>
                    <dd className="font-mono text-[11px] font-semibold leading-none text-white">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative z-20 mt-auto space-y-1.5 border-t border-white/[0.06] bg-black/45 px-3 pb-3 pt-2.5 backdrop-blur-[2px]">
          <p
            className={[
              "truncate text-[13px] font-semibold capitalize leading-tight",
              unseen ? "tracking-[0.2em] text-on-surface-variant/80" : "text-white",
            ].join(" ")}
          >
            {unseen ? labels.unknown : entry.name}
          </p>

          {!unseen ? (
            <div className="flex flex-wrap justify-center gap-1">
              {entry.types.map((t) => {
                const c = typeColor(t);
                const label = labels.pokemonTypes[t.toLowerCase()] ?? t;
                return (
                  <span
                    key={t}
                    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide"
                    style={{
                      backgroundColor: `${c}22`,
                      color: c,
                      border: `1px solid ${c}55`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: c }}
                    />
                    {label}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-on-surface-variant/50">—</p>
          )}

          <div
            className={[
              "flex items-center justify-center gap-1 text-[10px]",
              caught
                ? "text-emerald-300/90"
                : seenOnly
                  ? "text-sky-300/90"
                  : "text-on-surface-variant/70",
            ].join(" ")}
          >
            <span className="material-symbols-outlined text-[13px]!">{statusIcon}</span>
            <span>{statusLabel}</span>
          </div>
        </div>
      </button>
    </li>
  );
}

function DexListRow({
  entry,
  labels,
  expanded,
  onToggle,
}: {
  entry: PokedexSpeciesCard;
  labels: PokedexLabels;
  expanded: boolean;
  onToggle: () => void;
}) {
  const primary = entry.types[0] ?? "normal";
  const glow = typeColor(primary);
  const unseen = entry.status === "unseen";
  const rarityStyle = RARITY_STYLES[entry.rarity];

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="group relative flex w-full items-center gap-3 overflow-hidden rounded-md border border-white/10 bg-black/25 px-3 py-2.5 text-left transition hover:border-white/20 hover:bg-black/40"
        style={{ boxShadow: unseen ? undefined : `inset 3px 0 0 ${glow}66` }}
      >
        <span className="relative z-10 w-10 shrink-0 font-mono text-[11px] text-on-surface-variant">
          #{String(entry.id).padStart(3, "0")}
        </span>
        <div className="relative z-10 h-10 w-10 shrink-0">
          {entry.spriteUrl ? (
            <Image
              src={spriteFor(entry.spriteUrl, entry.hasShiny)}
              alt={unseen ? labels.unknown : entry.name}
              width={40}
              height={40}
              className={[
                "h-10 w-10 object-contain",
                unseen
                  ? "brightness-0 invert opacity-[0.5]"
                  : "",
              ].join(" ")}
            />
          ) : null}
        </div>
        <div className="relative z-10 min-w-0 flex-1">
          <p className="truncate text-label-md capitalize text-on-surface">
            {unseen ? labels.unknown : entry.name}
          </p>
          {!unseen && (
            <p className="truncate text-[10px] uppercase tracking-wide text-on-surface-variant">
              {entry.types
                .map((t) => labels.pokemonTypes[t.toLowerCase()] ?? t)
                .join(" · ")}
            </p>
          )}
        </div>
        <span className={["relative z-10 font-mono text-[10px]", rarityStyle.text].join(" ")}>
          {labels.rarity[entry.rarity] ?? entry.rarity}
        </span>
        <span className="relative z-10">
          <StatusIcons entry={entry} labels={labels} inline />
        </span>

        {entry.status === "caught" && (
          <div
            className={[
              "pointer-events-none absolute inset-0 z-20 flex items-center justify-end gap-3 px-3 transition-opacity duration-300",
              expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            ].join(" ")}
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${glow}22 35%, rgba(6,8,12,0.92) 100%)`,
            }}
          >
            <dl className="flex gap-3 text-right">
              {(
                [
                  [labels.stats.hp, entry.baseHp],
                  [labels.stats.atk, entry.baseAttack],
                  [labels.stats.spe, entry.baseSpeed],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[9px] uppercase tracking-wide text-white/60">{k}</dt>
                  <dd className="font-mono text-[12px] font-semibold text-white">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </button>
    </li>
  );
}

function StatusIcons({
  entry,
  labels,
  inline,
}: {
  entry: PokedexSpeciesCard;
  labels: PokedexLabels;
  inline?: boolean;
}) {
  if (entry.status === "unseen") return null;
  const icons: { key: string; icon: string; title: string; className: string }[] = [];
  if (entry.isFavorite) {
    icons.push({
      key: "fav",
      icon: "star",
      title: labels.icons.favorite,
      className: "text-electric-yellow",
    });
  }
  if (entry.hasShiny) {
    icons.push({
      key: "shiny",
      icon: "auto_awesome",
      title: labels.icons.shiny,
      className: "text-pink-300",
    });
  }
  if (entry.isMythical) {
    icons.push({
      key: "myth",
      icon: "diamond",
      title: labels.icons.mythical,
      className: "text-pink-300",
    });
  } else if (entry.isLegendary) {
    icons.push({
      key: "leg",
      icon: "workspace_premium",
      title: labels.icons.legendary,
      className: "text-electric-yellow",
    });
  }
  if (entry.isStarter) {
    icons.push({
      key: "starter",
      icon: "spa",
      title: labels.icons.starter,
      className: "text-emerald-300",
    });
  }
  if (entry.isPseudo) {
    icons.push({
      key: "pseudo",
      icon: "bolt",
      title: labels.icons.pseudo,
      className: "text-violet-300",
    });
  }
  if (icons.length === 0) return null;

  if (inline) {
    return (
      <span className="flex shrink-0 gap-0.5">
        {icons.map((i) => (
          <span
            key={i.key}
            title={i.title}
            className={`material-symbols-outlined text-[14px]! ${i.className}`}
          >
            {i.icon}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="absolute right-0 top-0 flex flex-col gap-0.5">
      {icons.slice(0, 3).map((i) => (
        <span
          key={i.key}
          title={i.title}
          className={`material-symbols-outlined text-[12px]! drop-shadow ${i.className}`}
        >
          {i.icon}
        </span>
      ))}
    </span>
  );
}
