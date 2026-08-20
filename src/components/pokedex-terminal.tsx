"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CdnImage as Image } from "@/components/cdn-image";
import { PokemonImage } from "@/components/pokemon-image";
import { neonTypeColor } from "@/lib/type-colors";
import { itemHdIconUrl } from "@/lib/item-hd-icons";
import { useBodyScrollLock } from "@/lib/scroll-lock";
import {
  diffNewlyCaught,
  markDexEntriesSeen,
  readDexSeenCaught,
} from "@/lib/dex-new-entries";
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
  locked: string;
  lockedHint: string;
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
  detail: {
    close: string;
    owned: string;
    inTeam: string;
    inPc: string;
    shinyOwned: string;
    baseStats: string;
    evolutionLine: string;
    habitats: string;
    noHabitat: string;
    captureRate: string;
    researchMilestones: string;
    nextMilestone: string;
    milestoneComplete: string;
    openHint: string;
  };
  unknown: string;
  /** Sello de las especies registradas desde la última visita. */
  newEntry: string;
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

/**
 * Especies capturadas desde la última vez que se abrió la Pokédex.
 *
 * El registro de una especie nueva es de los pocos hitos de colección del
 * juego y no tenía momento: la card aparecía como una más. El estado vive en
 * localStorage porque el server no guarda "cuándo miraste la Pokédex" y no
 * vale una columna nueva sólo para esto.
 *
 * El set arranca vacío y se llena en el primer tick post-montaje: leer
 * localStorage durante el render rompería la hidratación (server y cliente
 * producirían marcado distinto).
 */
function useNewlyCaught(caughtIds: number[]): Set<number> {
  const [fresh, setFresh] = useState<Set<number>>(() => new Set());
  // Clave estable para el efecto: el array llega nuevo en cada render.
  const caughtKey = caughtIds.join(",");
  /**
   * Foto del storage al montar. `undefined` = todavía no se leyó.
   *
   * Es un ref y no una lectura directa en cada corrida porque el efecto se
   * ejecuta dos veces en desarrollo (StrictMode): la primera guardaba la lista
   * nueva y la segunda leía lo recién escrito, con lo cual no quedaba ninguna
   * especie marcada como nueva. Congelar el "antes" al montaje también es lo
   * que se quiere si capturás algo sin salir de la pantalla.
   */
  const previousRef = useRef<number[] | null | undefined>(undefined);

  useEffect(() => {
    const ids = caughtKey ? caughtKey.split(",").map(Number) : [];

    if (previousRef.current === undefined) {
      previousRef.current = readDexSeenCaught();
    }

    const added = diffNewlyCaught(previousRef.current, ids);
    if (added.length === 0) {
      markDexEntriesSeen(ids);
      return;
    }
    // La persistencia va DENTRO del rAF: en una pestaña en segundo plano el
    // callback no corre (el navegador lo pausa), y marcar "ya lo viste" antes
    // de haber podido pintar el sello se comía el momento sin mostrarlo.
    const boot = requestAnimationFrame(() => {
      setFresh(new Set(added));
      markDexEntriesSeen(ids);
    });
    return () => cancelAnimationFrame(boot);
  }, [caughtKey]);

  return fresh;
}

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? null,
    [entries, selectedId],
  );
  useBodyScrollLock(selectedEntry !== null);

  useEffect(() => {
    if (!selectedEntry) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEntry]);

  // Sobre el dataset completo, no sobre `visible`: una especie nueva sigue
  // siendo nueva aunque el filtro activo no la esté mostrando ahora.
  const caughtIds = useMemo(
    () => entries.filter((e) => e.status === "caught").map((e) => e.id),
    [entries],
  );
  const newlyCaught = useNewlyCaught(caughtIds);

  const regionDef = POKEDEX_REGIONS.find((r) => r.id === region)!;
  const regionProg = progress.regions.find((r) => r.id === region);
  const regionEmpty = !regionDef.available || (regionProg?.total ?? 0) === 0;
  const regionLocked =
    !regionEmpty && (!regionDef.playable || regionProg?.playable === false);

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
        // Atlas shiny: todas las especies de la región; las no obtenidas
        // se pintan como sombra (ver DexCard / DexListRow).
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
  }, [entries, regionDef.generation, query, type, quick, sort, labels.regions, labels.pokemonTypes, region]);

  const discoveryPct = regionProg
    ? regionProg.total === 0
      ? 0
      : Math.round((regionProg.seen / regionProg.total) * 1000) / 10
    : 0;

  const filtersActive = quick !== "all" || Boolean(type) || sort !== "number";
  const primaryQuick: DexQuickFilter[] = ["all", "seen", "caught", "missing"];
  const extraQuick = QUICK_FILTERS.filter((f) => !primaryQuick.includes(f));
  const researchMilestones = [25, 50, 75, 100] as const;
  const nextResearchMilestone = researchMilestones.find((value) => discoveryPct < value);

  return (
    <div className="flex flex-col gap-3 md:gap-6">
      {/* Header: compacto en mobile, completo en desktop */}
      <header className="space-y-3 md:space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-title text-headline-md text-white md:text-display-sm">
              {labels.title}
            </h1>
            <p className="mt-0.5 hidden font-mono text-[11px] uppercase tracking-[0.16em] text-on-surface-variant md:block">
              {labels.researchDatabase}
            </p>
          </div>
          {signedIn ? (
            <p className="shrink-0 pb-0.5 font-mono text-[12px] tabular-nums text-white/70 md:hidden">
              <span className="font-semibold text-pokeball-red">{progress.caught}</span>
              <span className="text-white/35">/{progress.total}</span>
            </p>
          ) : null}
        </div>

        {signedIn ? (
          <div className="hidden flex-wrap items-end gap-x-6 gap-y-3 border-y border-white/8 py-3 md:flex">
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

      {/* Regiones: chips compactos */}
      <section>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-2">
          {POKEDEX_REGIONS.map((r) => {
            const rp = progress.regions.find((x) => x.id === r.id);
            const active = region === r.id;
            const empty = !r.available || (rp && rp.total === 0);
            const locked = !empty && !r.playable;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRegion(r.id)}
                className={[
                  "shrink-0 rounded-full border px-3 py-1.5 text-left transition-all md:min-w-[5.5rem] md:rounded-md md:px-3.5 md:py-2",
                  active
                    ? "border-pokeball-red/55 bg-pokeball-red/12 text-white"
                    : "border-white/10 bg-black/25 text-on-surface-variant hover:border-white/22 hover:text-on-surface",
                ].join(" ")}
              >
                <span className="block text-[12px] font-medium tracking-wide md:text-label-sm">
                  {labels.regions[r.id]}
                </span>
                <span className="mt-0.5 hidden font-mono text-[10px] tabular-nums opacity-70 md:block">
                  {empty
                    ? labels.comingSoon
                    : locked
                      ? labels.locked
                      : `${labels.progress.seen} ${rp?.seen ?? 0}/${rp?.total ?? 0}`}
                </span>
              </button>
            );
          })}
        </div>

        {regionProg && regionProg.total > 0 && !regionLocked ? (
          <div className="mt-2 space-y-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                {labels.detail.researchMilestones}
              </span>
              <span className="font-mono text-[10px] text-electric-yellow tabular-nums">
                {nextResearchMilestone
                  ? labels.detail.nextMilestone.replace("{percent}", String(nextResearchMilestone))
                  : labels.detail.milestoneComplete}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {researchMilestones.map((milestone) => {
                const reached = discoveryPct >= milestone;
                return (
                  <div key={milestone} className="space-y-1">
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={reached ? "h-full w-full bg-electric-yellow" : "h-full bg-electric-yellow/45"}
                        style={reached ? undefined : { width: `${Math.min(100, discoveryPct / milestone * 100)}%` }}
                      />
                    </div>
                    <p className={[
                      "text-center font-mono text-[9px] tabular-nums",
                      reached ? "text-electric-yellow" : "text-white/35",
                    ].join(" ")}>
                      {reached ? "✓ " : ""}{milestone}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {/* Controles: search + filtros colapsables en mobile */}
      <section className="space-y-2 md:space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
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
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={[
              "inline-flex h-10 shrink-0 items-center gap-1 rounded-md border px-2.5 text-[12px] font-medium transition md:hidden",
              filtersOpen || filtersActive
                ? "border-electric-yellow/45 bg-electric-yellow/10 text-electric-yellow"
                : "border-white/10 bg-black/30 text-on-surface-variant",
            ].join(" ")}
          >
            <span className="material-symbols-outlined text-[18px]!">tune</span>
          </button>
          <div className="hidden rounded-md border border-white/10 p-0.5 md:flex">
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

        {/* Quick filters principales siempre visibles */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {primaryQuick.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setQuick(f)}
              className={[
                "shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors md:rounded-md md:px-3 md:py-1.5 md:text-label-sm",
                quick === f
                  ? "border-electric-yellow/45 bg-electric-yellow/10 text-electric-yellow"
                  : "border-white/10 bg-black/20 text-on-surface-variant hover:border-white/20 hover:text-on-surface",
              ].join(" ")}
            >
              {labels.filters[f]}
            </button>
          ))}
          {/* En desktop el resto de quick filters va en la misma fila */}
          {extraQuick.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setQuick(f)}
              className={[
                "hidden shrink-0 rounded-md border px-3 py-1.5 text-label-sm transition-colors md:inline-flex",
                quick === f
                  ? "border-electric-yellow/45 bg-electric-yellow/10 text-electric-yellow"
                  : "border-white/10 bg-black/20 text-on-surface-variant hover:border-white/20 hover:text-on-surface",
              ].join(" ")}
            >
              {labels.filters[f]}
            </button>
          ))}
        </div>

        {/* Panel filtros: abierto en mobile con tune; siempre en desktop (sort/type) */}
        <div
          className={[
            "flex-col gap-2 rounded-lg border border-white/8 bg-black/25 p-2.5",
            filtersOpen ? "flex" : "hidden",
            "md:flex md:flex-row md:items-center md:justify-between md:border-0 md:bg-transparent md:p-0",
          ].join(" ")}
        >
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

            <div className="flex rounded-md border border-white/10 p-0.5 md:hidden">
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

          <div className="flex gap-1.5 overflow-x-auto md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {extraQuick.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setQuick(f)}
                className={[
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  quick === f
                    ? "border-electric-yellow/45 bg-electric-yellow/10 text-electric-yellow"
                    : "border-white/10 bg-black/20 text-on-surface-variant",
                ].join(" ")}
              >
                {labels.filters[f]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Colecciones por región — solo desktop (redundante en mobile) */}
      <section className="hidden gap-2 sm:grid-cols-2 md:grid lg:grid-cols-4">
        {progress.regions.slice(0, 4).map((r) => {
          const empty = r.total === 0;
          const locked = !empty && !r.playable;
          const pct = empty || locked ? 0 : Math.round((r.seen / r.total) * 100);
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
                  {empty
                    ? labels.comingSoon
                    : locked
                      ? labels.locked
                      : `${labels.progress.seen} ${r.seen}/${r.total}`}
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
      {regionEmpty ? (
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
      ) : (
        <>
          {regionLocked ? (
            <p className="rounded-md border border-white/8 bg-black/20 px-3 py-2 text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined mr-1 align-middle text-[16px]!">
                lock
              </span>
              {labels.lockedHint}
            </p>
          ) : null}
          {view === "grid" ? (
            <ul className="grid grid-cols-3 gap-x-1 gap-y-4 sm:grid-cols-4 sm:gap-x-2 sm:gap-y-5 md:grid-cols-5 lg:grid-cols-6">
              {visible.map((entry, index) => (
                <DexCard
                  key={entry.id}
                  entry={entry}
                  labels={labels}
                  forceLocked={regionLocked}
                  shinyAtlas={quick === "shiny"}
                  isNew={newlyCaught.has(entry.id)}
                  eager={index === 0}
                  onOpen={
                    !regionLocked && entry.status !== "unseen"
                      ? () => setSelectedId(entry.id)
                      : undefined
                  }
                />
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col gap-1">
              {visible.map((entry, index) => (
                <DexListRow
                  key={entry.id}
                  entry={entry}
                  labels={labels}
                  forceLocked={regionLocked}
                  shinyAtlas={quick === "shiny"}
                  isNew={newlyCaught.has(entry.id)}
                  eager={index === 0}
                  onOpen={
                    !regionLocked && entry.status !== "unseen"
                      ? () => setSelectedId(entry.id)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}
      {selectedEntry ? (
        <PokedexDetailDialog
          entry={selectedEntry}
          entries={entries}
          labels={labels}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
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
 * Celda de grilla sin card (estilo GO): Nº + estrella, sprite suelto, nombre.
 */
function DexCard({
  entry,
  labels,
  forceLocked = false,
  shinyAtlas = false,
  isNew = false,
  eager = false,
  onOpen,
}: {
  entry: PokedexSpeciesCard;
  labels: PokedexLabels;
  forceLocked?: boolean;
  /** Filtro Shiny: arte variocolor; sombra si aún no lo tenés. */
  shinyAtlas?: boolean;
  /** Registrada desde la última visita: sello + pulso de entrada. */
  isNew?: boolean;
  /** Primera imagen visible: candidata a LCP. */
  eager?: boolean;
  onOpen?: () => void;
}) {
  const speciesUnseen = forceLocked || entry.status === "unseen";
  const shinyLocked = shinyAtlas && !entry.hasShiny;
  const unseen = speciesUnseen || shinyLocked;
  const seenOnly = !forceLocked && !shinyLocked && entry.status === "seen";
  const caught = !forceLocked && !shinyLocked && entry.status === "caught";
  const tip = forceLocked
    ? labels.locked
    : shinyLocked
      ? labels.icons.shiny
      : speciesUnseen
        ? labels.unknown
        : entry.name;
  const dexNum = String(entry.id).padStart(3, "0");
  const showShinyArt = shinyAtlas || entry.hasShiny;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        title={tip}
        aria-label={onOpen ? `${entry.name} · ${labels.detail.openHint}` : tip}
        className={[
          "group relative flex w-full flex-col items-center gap-0.5 px-0.5 py-1 transition",
          onOpen ? "cursor-pointer rounded-lg hover:bg-white/[0.035] focus-visible:outline-2 focus-visible:outline-pokeball-red/70" : "cursor-default",
          // Sólo las nuevas. Antes el pulso salía en TODAS las capturadas a la
          // vez en cada carga: con la Pokédex avanzada era la pantalla entera
          // latiendo y no señalaba nada.
          isNew ? "dex-caught-pulse" : "",
        ].join(" ")}
      >
        {isNew ? (
          <span className="pointer-events-none absolute -top-1 left-1/2 z-[2] -translate-x-1/2 rounded-full border border-electric-yellow/55 bg-electric-yellow/20 px-1.5 py-px font-mono text-[8px] font-bold uppercase leading-none tracking-wide text-electric-yellow">
            {labels.newEntry}
          </span>
        ) : null}
        {/* Fila superior: Nº + favorito (estilo GO, sin card) */}
        <div className="flex w-full items-center justify-between gap-1 px-0.5">
          <span
            className={[
              "font-mono text-[10px] tabular-nums leading-none tracking-wide sm:text-[11px]",
              speciesUnseen ? "text-white/30" : "text-white/70",
            ].join(" ")}
          >
            {speciesUnseen ? "—" : `#${dexNum}`}
          </span>
          {entry.isFavorite ? (
            <span
              className="material-symbols-outlined ms-fill text-[14px]! text-electric-yellow sm:text-[15px]!"
              title={labels.icons.favorite}
            >
              star
            </span>
          ) : (
            <span className="h-[14px] w-[14px] shrink-0" aria-hidden />
          )}
        </div>

        {/* Sprite suelto sobre el fondo */}
        <div className="relative flex aspect-square w-full max-w-[7.5rem] items-center justify-center self-center">
          {entry.spriteUrl ? (
            <PokemonImage
              src={entry.spriteUrl}
              speciesId={entry.id}
              speciesName={entry.name}
              isShiny={showShinyArt}
              alt={unseen ? labels.unknown : entry.name}
              width={128}
              height={128}
              loading={eager ? "eager" : "lazy"}
              className={[
                "h-[78%] w-[78%] object-contain transition duration-200 group-hover:scale-[1.06] group-active:scale-[0.98]",
                unseen
                  ? "brightness-0 invert opacity-[0.38]"
                  : "drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]",
                seenOnly ? "opacity-85" : "",
              ].join(" ")}
            />
          ) : null}

          {/* Badges mínimos sobre el sprite */}
          <div className="pointer-events-none absolute bottom-0.5 left-0.5 flex items-center gap-0.5">
            {entry.hasShiny ? (
              <span
                className="material-symbols-outlined text-[12px]! text-pink-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                title={labels.icons.shiny}
              >
                auto_awesome
              </span>
            ) : shinyAtlas ? (
              <span
                className="material-symbols-outlined text-[12px]! text-white/35"
                title={labels.icons.shiny}
              >
                auto_awesome
              </span>
            ) : null}
            {!shinyLocked && caught ? (
              <span title={labels.statusCaught} className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.75)]">
                <Image
                  src={itemHdIconUrl("Poke Ball") ?? "/items/hd/poke-ball.png"}
                  alt=""
                  width={16}
                  height={16}
                  className="h-3.5 w-3.5 object-contain sm:h-4 sm:w-4"
                  unoptimized
                />
              </span>
            ) : !shinyLocked && seenOnly ? (
              <span
                className="material-symbols-outlined text-[12px]! text-white/55"
                title={labels.statusSeen}
              >
                visibility
              </span>
            ) : null}
          </div>
        </div>

        <p
          className={[
            "w-full truncate px-0.5 text-center text-[11px] capitalize leading-tight sm:text-[12px]",
            speciesUnseen || shinyLocked ? "text-white/40" : "text-white/85",
          ].join(" ")}
        >
          {speciesUnseen ? labels.unknown : entry.name}
        </p>
      </button>
    </li>
  );
}

function DexListRow({
  entry,
  labels,
  forceLocked = false,
  shinyAtlas = false,
  isNew = false,
  eager = false,
  onOpen,
}: {
  entry: PokedexSpeciesCard;
  labels: PokedexLabels;
  forceLocked?: boolean;
  shinyAtlas?: boolean;
  /** Registrada desde la última visita. */
  isNew?: boolean;
  eager?: boolean;
  onOpen?: () => void;
}) {
  const primary = entry.types[0] ?? "normal";
  const glow = neonTypeColor(primary);
  const speciesUnseen = forceLocked || entry.status === "unseen";
  const shinyLocked = shinyAtlas && !entry.hasShiny;
  const unseen = speciesUnseen || shinyLocked;
  const rarityStyle = RARITY_STYLES[entry.rarity];
  const showShinyArt = shinyAtlas || entry.hasShiny;

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={onOpen ? `${entry.name} · ${labels.detail.openHint}` : labels.unknown}
        className={[
          "group relative flex w-full items-center gap-3 overflow-hidden px-2 py-2 text-left transition",
          "hover:bg-white/[0.04] active:bg-white/[0.06]",
          onOpen ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-pokeball-red/70" : "cursor-default",
          unseen ? "opacity-70" : "",
        ].join(" ")}
        style={
          unseen
            ? undefined
            : {
                boxShadow: `inset 2px 0 0 ${glow}`,
              }
        }
      >
        <span className="relative z-10 w-10 shrink-0 font-mono text-[11px] text-on-surface-variant">
          #{String(entry.id).padStart(3, "0")}
        </span>
        {isNew ? (
          <span className="relative z-10 shrink-0 rounded-full border border-electric-yellow/55 bg-electric-yellow/20 px-1.5 py-px font-mono text-[8px] font-bold uppercase leading-none tracking-wide text-electric-yellow">
            {labels.newEntry}
          </span>
        ) : null}
        <div className="relative z-10 h-10 w-10 shrink-0">
          {entry.spriteUrl ? (
            <PokemonImage
              src={entry.spriteUrl}
              speciesId={entry.id}
              speciesName={entry.name}
              isShiny={showShinyArt}
              alt={unseen ? labels.unknown : entry.name}
              width={40}
              height={40}
              loading={eager ? "eager" : "lazy"}
              className={[
                "h-10 w-10 object-contain",
                unseen ? "brightness-0 invert opacity-[0.5]" : "",
              ].join(" ")}
            />
          ) : null}
        </div>
        <div className="relative z-10 min-w-0 flex-1">
          <p className="truncate text-label-md capitalize text-on-surface">
            {speciesUnseen ? labels.unknown : entry.name}
          </p>
          {!speciesUnseen && (
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
      </button>
    </li>
  );
}

function PokedexDetailDialog({
  entry,
  entries,
  labels,
  onClose,
}: {
  entry: PokedexSpeciesCard;
  entries: PokedexSpeciesCard[];
  labels: PokedexLabels;
  onClose: () => void;
}) {
  const relatedIds = [entry.evolvesFromId, entry.id, ...entry.evolvesToIds].filter(
    (id): id is number => id != null,
  );
  const evolutionLine = [...new Set(relatedIds)]
    .map((id) => entries.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is PokedexSpeciesCard => candidate != null);
  const stats = [
    [labels.stats.hp, entry.baseHp],
    [labels.stats.atk, entry.baseAttack],
    [labels.stats.def, entry.baseDefense],
    [labels.stats.spa, entry.baseSpAtk],
    [labels.stats.spd, entry.baseSpDef],
    [labels.stats.spe, entry.baseSpeed],
  ] as const;

  return (
    <div
      className="fixed inset-0 z-80 flex items-end justify-center bg-black/78 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pokedex-detail-title"
        data-testid="pokedex-detail"
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[26px] border border-white/12 bg-[radial-gradient(circle_at_20%_0%,rgba(232,121,249,.13),transparent_34%),#101117] p-5 shadow-2xl sm:rounded-[26px] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-pokeball-red">
              #{String(entry.id).padStart(3, "0")} · {labels.research}
            </p>
            <h2 id="pokedex-detail-title" className="page-title mt-1 text-2xl capitalize text-white sm:text-3xl">
              {entry.name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entry.types.map((type) => (
                <span
                  key={type}
                  className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: neonTypeColor(type), borderColor: `${neonTypeColor(type)}66` }}
                >
                  {labels.pokemonTypes[type.toLowerCase()] ?? type}
                </span>
              ))}
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${RARITY_STYLES[entry.rarity].border} ${RARITY_STYLES[entry.rarity].text}`}>
                {labels.rarity[entry.rarity] ?? entry.rarity}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.detail.close}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:text-white"
          >
            <span className="material-symbols-outlined text-[20px]!">close</span>
          </button>
        </header>

        <div className="mt-5 grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="relative mx-auto aspect-square w-full max-w-56 rounded-2xl border border-white/8 bg-black/25">
              <PokemonImage
                src={entry.spriteUrl}
                speciesId={entry.id}
                speciesName={entry.name}
                isShiny={entry.hasShiny}
                alt={entry.name}
                width={240}
                height={240}
                className="h-full w-full object-contain p-4 drop-shadow-[0_18px_18px_rgba(0,0,0,.6)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "owned", label: labels.detail.owned, value: entry.ownedCount, icon: "catching_pokemon" },
                { key: "team", label: labels.detail.inTeam, value: entry.teamCount, icon: "groups" },
                { key: "pc", label: labels.detail.inPc, value: entry.pcCount, icon: "dns" },
                { key: "shiny", label: labels.detail.shinyOwned, value: entry.shinyCount, icon: "auto_awesome" },
              ].map(({ key, label, value, icon }) => (
                <div
                  key={key}
                  data-testid={`pokedex-${key}`}
                  className="rounded-xl border border-white/8 bg-black/25 px-3 py-2"
                >
                  <span className="material-symbols-outlined text-[15px]! text-white/35">{icon}</span>
                  <p className="font-mono text-lg font-bold tabular-nums text-white">{value}</p>
                  <p className="text-[10px] text-white/45">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  {labels.detail.baseStats}
                </h3>
                <span className="font-mono text-[10px] text-white/40">
                  {labels.detail.captureRate}: {entry.captureRate}/255
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {stats.map(([label, value]) => (
                  <div key={label}>
                    <div className="flex justify-between font-mono text-[10px] text-white/55">
                      <span>{label}</span><span>{value}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-pokeball-red to-secondary"
                        style={{ width: `${Math.max(4, Math.round(value / 255 * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                {labels.detail.evolutionLine}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {evolutionLine.map((candidate, index) => {
                  const hidden = candidate.status === "unseen";
                  return (
                    <div key={candidate.id} className="flex items-center gap-2">
                      {index > 0 ? <span className="material-symbols-outlined text-[16px]! text-white/25">arrow_forward</span> : null}
                      <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-2 py-1.5">
                        <PokemonImage
                          src={candidate.spriteUrl}
                          speciesId={candidate.id}
                          speciesName={candidate.name}
                          alt={hidden ? labels.unknown : candidate.name}
                          width={40}
                          height={40}
                          className={hidden ? "h-9 w-9 object-contain brightness-0 invert opacity-35" : "h-9 w-9 object-contain"}
                        />
                        <span className="text-xs capitalize text-white/75">{hidden ? labels.unknown : candidate.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                {labels.detail.habitats}
              </h3>
              {entry.encounterLocations.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entry.encounterLocations.map((location) => (
                    <span key={location.id} className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-xs text-white/65">
                      <span className="mr-1 text-[9px] font-bold uppercase text-pokeball-red">{labels.regions[location.regionId]}</span>
                      {location.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-white/40">{labels.detail.noHabitat}</p>
              )}
            </section>
          </div>
        </div>
      </section>
    </div>
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
