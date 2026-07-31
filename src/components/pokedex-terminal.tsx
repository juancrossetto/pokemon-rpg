"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { neonTypeColor } from "@/lib/type-colors";
import { showdownTypeSymbolUrl } from "@/lib/type-icons";
import { spriteFor } from "@/lib/shiny";
import { PokeballIcon } from "@/components/pokeball-icon";
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
              regionId={region}
              regionLabel={labels.regions[region]}
            />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1">
          {visible.map((entry) => (
            <DexListRow key={entry.id} entry={entry} labels={labels} />
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
 * Banner inferior: un solo color de tipo, semitransparente.
 * Más bajo y suave para no “comerse” el sprite / gris de arriba.
 */
function typeBannerWash(types: string[]): string {
  const base = neonTypeColor(types[0] ?? "normal");
  return [
    `linear-gradient(0deg,`,
    `${base}a8 0%,`,
    `${base}78 20%,`,
    `${base}48 42%,`,
    `${base}22 62%,`,
    `${base}0c 80%,`,
    `transparent 100%)`,
  ].join(" ");
}

function DexCard({
  entry,
  labels,
  regionId,
  regionLabel,
}: {
  entry: PokedexSpeciesCard;
  labels: PokedexLabels;
  regionId: PokedexRegionId;
  regionLabel: string;
}) {
  const primary = entry.types[0] ?? "normal";
  const glow = neonTypeColor(primary);
  const unseen = entry.status === "unseen";
  const seenOnly = entry.status === "seen";
  const caught = entry.status === "caught";

  const tip = unseen ? labels.unknown : entry.name;
  const rarityLabel = labels.rarity[entry.rarity] ?? entry.rarity;

  return (
    <li className="h-full">
      <article
        title={tip}
        className={[
          "group relative flex h-full min-h-[22rem] w-full flex-col overflow-hidden border text-center transition-all duration-300",
          "hover:-translate-y-0.5",
          "dex-card dex-card--cut border-white/12 hover:border-white/22",
          caught ? "dex-caught-pulse" : "",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={unseen ? "dex-card__mesh dex-card__mesh--dim" : "dex-card__mesh"}
        />

        {/* Gris arriba intacto; color de tipo solo en la franja inferior → fade up */}
        {!unseen ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[40%]"
            style={{ background: typeBannerWash(entry.types) }}
          />
        ) : null}

        {/* Header: solo iconos de estado */}
        <div className="relative z-20 flex min-h-[1.5rem] items-center justify-end gap-0.5 px-3 pt-2.5">
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
        </div>

        {/* Artwork */}
        <div className="relative z-10 flex min-h-[13.5rem] flex-[1.35] items-center justify-center px-2 pb-2">
          {entry.spriteUrl ? (
            <Image
              src={spriteFor(entry.spriteUrl, entry.hasShiny)}
              alt={unseen ? labels.unknown : entry.name}
              width={176}
              height={176}
              className={[
                "relative z-10 h-36 w-36 object-contain transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.05] sm:h-40 sm:w-40",
                unseen
                  ? "brightness-0 invert opacity-[0.42] drop-shadow-[0_0_6px_rgba(255,255,255,0.12)]"
                  : "drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]",
                seenOnly && !unseen ? "opacity-90" : "",
              ].join(" ")}
            />
          ) : null}
        </div>

        {/* Footer: tipos alineados al bloque de rareza/nombre + badges unificados */}
        <div className="dex-card__banner relative z-20 mt-auto px-3 pb-3 pt-1">
          <div className="flex min-w-0 items-end gap-1.5">
            <div className="flex min-w-0 flex-1 items-stretch gap-1.5 text-left">
              {!unseen ? (
                <span
                  aria-hidden
                  className="dex-card__banner-bar w-[3px] shrink-0 self-stretch rounded-full"
                  style={{
                    background: glow,
                    boxShadow: `0 0 10px ${glow}aa`,
                  }}
                />
              ) : null}

              <div className="min-w-0 flex-1 space-y-1.5">
                {!unseen ? (
                  <div className="flex items-center gap-1">
                    {entry.types.map((t) => {
                      const c = neonTypeColor(t);
                      const label = labels.pokemonTypes[t.toLowerCase()] ?? t;
                      return (
                        <span
                          key={t}
                          title={label}
                          className="dex-card__type-flag"
                          style={{
                            background: `linear-gradient(135deg, ${c}dd 0%, ${c}88 100%)`,
                            boxShadow: `0 2px 8px ${c}40`,
                          }}
                        >
                          <Image
                            src={showdownTypeSymbolUrl(t)}
                            alt=""
                            width={14}
                            height={14}
                            unoptimized
                            className="h-3.5 w-3.5 object-contain brightness-110 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]"
                          />
                        </span>
                      );
                    })}
                  </div>
                ) : null}

                {!unseen ? (
                  <p className="dex-card__rarity truncate text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-white/88">
                    {rarityLabel}
                  </p>
                ) : null}

                <p
                  className={[
                    "dex-card__name min-w-0 uppercase leading-none",
                    unseen ? "text-white/50" : "text-white",
                  ].join(" ")}
                >
                  {unseen ? labels.unknown : entry.name}
                </p>
              </div>
            </div>

            <div className="dex-card__chips flex shrink-0 items-center gap-1.5">
              {!unseen ? (
                <span className="dex-card__chip" aria-label={regionLabel}>
                  <span className="dex-card__chip-inner dex-card__chip-letter">
                    {regionId.slice(0, 1).toUpperCase()}
                  </span>
                </span>
              ) : null}
              <span
                className="dex-card__chip"
                aria-label={`#${String(entry.id).padStart(3, "0")}`}
              >
                <span className="dex-card__chip-inner dex-card__chip-num">
                  {String(entry.id).padStart(3, "0")}
                </span>
              </span>
              {!unseen ? (
                <span
                  className="dex-card__chip"
                  aria-label={caught ? labels.statusCaught : labels.statusSeen}
                >
                  <span className="dex-card__chip-inner">
                    {caught ? (
                      <PokeballIcon className="h-3 w-3" />
                    ) : (
                      <span className="material-symbols-outlined text-[13px]! text-white/90">
                        visibility
                      </span>
                    )}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

function DexListRow({
  entry,
  labels,
}: {
  entry: PokedexSpeciesCard;
  labels: PokedexLabels;
}) {
  const primary = entry.types[0] ?? "normal";
  const glow = neonTypeColor(primary);
  const unseen = entry.status === "unseen";
  const rarityStyle = RARITY_STYLES[entry.rarity];

  return (
    <li className="relative">
      <div
        className={[
          "group relative flex w-full items-center gap-3 overflow-hidden rounded-md border px-3 py-2.5 text-left transition",
          "dex-card border-white/10 hover:border-white/22",
        ].join(" ")}
        style={
          unseen
            ? undefined
            : {
                boxShadow: `inset 3px 0 0 ${glow}`,
                borderColor: `${glow}33`,
              }
        }
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
      </div>
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
