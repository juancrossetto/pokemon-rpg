import Image from "next/image";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FlagIcon } from "@/components/flag-icon";
import { ElectricBorder } from "@/components/electric-border";
import { getCountryOptions } from "@/lib/countries";
import { typeColor } from "@/lib/type-colors";
import { LeaderboardCountrySelect } from "@/components/leaderboard-country-select";
import {
  tierForRank,
  RankingEmblem,
  type RankingEmblemPokemon,
} from "@/components/ranking-emblem";
import { spriteFor } from "@/lib/shiny";
import {
  RANKING_PAGE_SIZE,
  compareCollectors,
  compareTrainers,
  pokemonPower,
  teamPower,
  winRate,
} from "@/lib/ranking";
import { tierForRating } from "@/lib/pvp/tiers";

const MAIN_POKEMON_INCLUDE = {
  where: {
    OR: [{ isFavorite: true }, { teamSlot: { not: null } }],
  },
  orderBy: [{ isFavorite: "desc" as const }, { teamSlot: "asc" as const }],
  take: 1,
  select: {
    isShiny: true,
    isFavorite: true,
    species: { select: { name: true, spriteUrl: true } },
  },
};

function toEmblemPokemon(
  row:
    | {
        isShiny: boolean;
        species: { name: string; spriteUrl: string };
      }
    | null
    | undefined,
): RankingEmblemPokemon {
  if (!row) return null;
  return {
    name: row.species.name,
    spriteUrl: row.species.spriteUrl,
    isShiny: row.isShiny,
  };
}

function pickMainFromTeam(
  team: Array<{
    teamSlot: number | null;
    isFavorite?: boolean;
    isShiny: boolean;
    species: { name: string; spriteUrl: string };
  }>,
): RankingEmblemPokemon {
  const favorite = team.find((p) => p.isFavorite);
  if (favorite) return toEmblemPokemon(favorite);
  const lead = team
    .filter((p) => p.teamSlot != null)
    .sort((a, b) => (a.teamSlot ?? 99) - (b.teamSlot ?? 99))[0];
  return toEmblemPokemon(lead);
}

const BOARDS = ["trainers", "pvp", "collectors", "pokedex"] as const;
type Board = (typeof BOARDS)[number];

/*
  Arte propio en vez de Material Symbols: son los mismos íconos que ya
  identifican cada sección en la navegación, así el jugador reconoce la
  categoría antes de leer el título. Van sin caja: tienen luz y sombra propias
  y un recuadro con borde los aplanaba.
*/
const BOARD_META: Record<Board, { iconSrc: string }> = {
  trainers: { iconSrc: "/nav/ranking-icon.png" },
  pvp: { iconSrc: "/nav/pvp-icon.png" },
  collectors: { iconSrc: "/nav/pc-icon.png" },
  pokedex: { iconSrc: "/nav/collection-icon.png" },
};

const SPECIES_STATS_SELECT = {
  baseHp: true,
  baseAttack: true,
  baseDefense: true,
  baseSpAtk: true,
  baseSpDef: true,
  baseSpeed: true,
} as const;

export default async function RankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; country?: string; species?: string; page?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [t, session] = await Promise.all([getTranslations("ranking"), auth()]);
  const userId = session?.user?.id ?? null;

  const board = pickBoard(query.view);
  const countryOptions = getCountryOptions(locale);
  const validCountries = new Set(countryOptions.map((c) => c.code));
  const country = query.country && validCountries.has(query.country) ? query.country : "";
  const page = Math.max(1, Number(query.page) > 0 ? Math.floor(Number(query.page)) : 1);

  const me = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { country: true, username: true, avatarId: true },
      })
    : null;

  return (
    <div className="flex-1 px-margin-mobile py-6 md:px-margin-desktop md:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 md:mb-5">
          <h1 className="text-headline-lg tracking-tight text-white md:text-display-sm">
            {t("title")}
          </h1>
          {/* El subtítulo ocupaba dos renglones en mobile para decir algo que
              el título ya dice. Queda desde `sm`. */}
          <p className="mt-1 hidden max-w-xl text-label-md text-on-surface-variant sm:block">
            {t("subtitle")}
          </p>
        </header>

        {/*
          En mobile la grilla de 2×2 se comía media pantalla antes de mostrar a
          un solo jugador. Acá es una fila de pestañas que se desplaza —el
          patrón habitual para categorías— y recupera unos 80px.
        */}
        <nav className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1 md:mb-5 md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
          {BOARDS.map((id) => {
            const active = board === id;
            return (
              <Link
                key={id}
                href={boardHref(id, country)}
                className={`group relative flex shrink-0 items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 transition md:shrink md:gap-2.5 md:py-2.5 ${
                  active
                    ? "border-white/25 bg-white/[0.07]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                {/* Filo superior: marca la pestaña activa sin teñir la card. */}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
                  />
                ) : null}
                <Image
                  src={BOARD_META[id].iconSrc}
                  alt=""
                  width={40}
                  height={40}
                  className={`h-8 w-8 shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] transition duration-300 md:h-10 md:w-10 ${
                    active ? "" : "opacity-70 group-hover:opacity-100"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span
                    className={`block whitespace-nowrap text-label-md font-semibold md:truncate ${
                      active ? "text-white" : "text-on-surface"
                    }`}
                  >
                    {t(`boards.${id}.title`)}
                  </span>
                  {/*
                    En 2 columnas angostas el subtítulo se partía en tres
                    renglones y estiraba la card; desde `sm` hay ancho para que
                    entre en uno o dos.
                  */}
                  <span className="mt-0.5 hidden text-[11px] leading-snug text-on-surface-variant md:block">
                    {t(`boards.${id}.blurb`)}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="grid gap-3 lg:gap-5 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)]">
          {/*
            El panel de filtros ocupaba ~260px arriba de todo en mobile, antes
            de que apareciera un solo jugador. Debajo de `lg` se aplana a una
            barra de una línea: los dos accesos y el selector de país en fila,
            sin rótulos ni la nota al pie. Es el mismo markup y las mismas
            rutas; solo cambia la disposición.
          */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
            <section className="rounded-xl border border-white/10 bg-black/30 p-2 backdrop-blur-md lg:p-3.5">
              <p className="mb-2.5 hidden text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70 lg:block">
                {t("filters.title")}
              </p>
              <div className="flex items-center gap-2 lg:flex-col lg:items-stretch">
                <div className="flex shrink-0 gap-2 lg:w-full lg:flex-col">
                  <FilterChip
                    href={boardHref(board, "")}
                    active={country === ""}
                    icon="public"
                    label={t("filters.global")}
                  />
                  {me?.country && (
                    <FilterChip
                      href={boardHref(board, me.country)}
                      active={country === me.country}
                      flag={me.country}
                      label={t("filters.myCountry")}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 lg:mt-3 lg:w-full lg:flex-none lg:border-t lg:border-white/8 lg:pt-3">
                  <LeaderboardCountrySelect
                    view={board}
                    country={country}
                    options={countryOptions}
                    allLabel={t("filters.global")}
                    countryLabel={t("filters.country")}
                  />
                </div>
              </div>
              <p className="mt-3 hidden text-[11px] leading-snug text-on-surface-variant/60 lg:block">
                {t("filters.friendsSoon")}
              </p>
            </section>
          </aside>

          <main className="min-w-0">
            {board === "trainers" && (
              <TrainersBoard userId={userId} country={country} page={page} />
            )}
            {board === "pvp" && <PvpBoard userId={userId} country={country} page={page} />}
            {board === "collectors" && (
              <CollectorsBoard userId={userId} country={country} page={page} />
            )}
            {board === "pokedex" && (
              <PokedexBoard
                userId={userId}
                country={country}
                page={page}
                speciesQuery={query.species}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function pickBoard(raw: string | undefined): Board {
  // Compat: ?view=ladder|species de URLs viejas
  if (raw === "ladder") return "pvp";
  if (raw === "species") return "pokedex";
  return BOARDS.includes(raw as Board) ? (raw as Board) : "trainers";
}

function boardHref(board: Board, country: string, page?: number, species?: string): string {
  const params = new URLSearchParams({ view: board });
  if (country) params.set("country", country);
  if (page && page > 1) params.set("page", String(page));
  if (species) params.set("species", species);
  return `/ranking?${params.toString()}`;
}

function FilterChip({
  href,
  active,
  icon,
  flag,
  label,
}: {
  href: string;
  active: boolean;
  icon?: string;
  flag?: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-label-sm transition ${
        active
          ? "border-white/25 bg-white/[0.07] text-white"
          : "border-white/10 text-on-surface-variant hover:border-white/20 hover:text-on-surface"
      }`}
    >
      {flag ? (
        <FlagIcon code={flag} className="h-2.5 w-auto rounded-[1px]" />
      ) : (
        <span className="material-symbols-outlined text-[16px]!">{icon}</span>
      )}
      {label}
    </Link>
  );
}

// ---------------- Trainers ----------------

async function TrainersBoard({
  userId,
  country,
  page,
}: {
  userId: string | null;
  country: string;
  page: number;
}) {
  const t = await getTranslations("ranking");

  const users = await prisma.user.findMany({
    where: country ? { country } : undefined,
    select: {
      id: true,
      username: true,
      country: true,
      avatarId: true,
      createdAt: true,
      _count: { select: { badges: true } },
      pokemon: {
        where: {
          OR: [{ teamSlot: { not: null } }, { isFavorite: true }],
        },
        select: {
          teamSlot: true,
          isFavorite: true,
          level: true,
          isShiny: true,
          ptStrength: true,
          ptDexterity: true,
          ptIntelligence: true,
          ptSpeed: true,
          ptConstitution: true,
          species: { select: { ...SPECIES_STATS_SELECT, name: true, spriteUrl: true } },
        },
      },
    },
  });

  const ranked = users
    .map((u) => {
      const team = u.pokemon.filter((p) => p.teamSlot != null);
      return {
        id: u.id,
        username: u.username,
        country: u.country,
        avatarId: u.avatarId,
        createdAt: u.createdAt,
        badges: u._count.badges,
        power: teamPower(team),
        mainPokemon: pickMainFromTeam(u.pokemon),
      };
    })
    .sort(compareTrainers);

  return (
    <BoardShell
      empty={ranked.length === 0}
      emptyLabel={t("emptyTrainers")}
      emptyIcon="trophy"
      ranked={ranked}
      userId={userId}
      page={page}
      country={country}
      board="trainers"
      renderMetrics={(u) => (
        <>
          <Metric label={t("cols.power")} value={u.power.toLocaleString()} accent />
          <Metric label={t("cols.badges")} value={String(u.badges)} />
        </>
      )}
      yourExtra={(u) => t("yourPowerBadges", { power: u.power, badges: u.badges })}
    />
  );
}

// ---------------- PvP ----------------

async function PvpBoard({
  userId,
  country,
  page,
}: {
  userId: string | null;
  country: string;
  page: number;
}) {
  const t = await getTranslations("ranking");
  const tPvp = await getTranslations("pvp");
  const where = {
    ...(country ? { country } : {}),
    OR: [{ pvpWins: { gt: 0 } }, { pvpLosses: { gt: 0 } }],
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ pvpRating: "desc" }, { pvpWins: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      username: true,
      country: true,
      avatarId: true,
      pvpRating: true,
      pvpWins: true,
      pvpLosses: true,
      createdAt: true,
      pokemon: MAIN_POKEMON_INCLUDE,
    },
  });

  const ranked = users.map((u) => ({
    id: u.id,
    username: u.username,
    country: u.country,
    avatarId: u.avatarId,
    createdAt: u.createdAt,
    power: u.pvpRating,
    badges: 0,
    rating: u.pvpRating,
    wins: u.pvpWins,
    losses: u.pvpLosses,
    winrate: winRate(u.pvpWins, u.pvpLosses),
    mainPokemon: toEmblemPokemon(u.pokemon[0]),
  }));

  if (ranked.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/12 px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.05] text-on-surface-variant">
          <span className="material-symbols-outlined text-[28px]!">swords</span>
        </span>
        <h2 className="text-lg font-semibold text-white">{t("pvpEmpty.title")}</h2>
        <p className="max-w-md text-label-sm text-on-surface-variant">{t("pvpEmpty.body")}</p>
        <Link
          href="/pvp"
          className="mt-2 rounded-md border border-white/20 bg-white/[0.07] px-4 py-2 text-label-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/[0.12]"
        >
          {t("pvpEmpty.cta")}
        </Link>
      </div>
    );
  }

  return (
    <BoardShell
      empty={false}
      emptyLabel=""
      emptyIcon="swords"
      ranked={ranked}
      userId={userId}
      page={page}
      country={country}
      board="pvp"
      renderMetrics={(u) => (
        <>
          <Metric label={t("cols.rating")} value={String(u.rating as number)} accent />
          <Metric
            label={t("cols.tier")}
            value={tPvp(`tiers.${tierForRating(u.rating as number)}`)}
          />
          <Metric label={t("cols.record")} value={`${u.wins as number}-${u.losses as number}`} />
          <Metric label={t("cols.winrate")} value={`${u.winrate as number}%`} />
        </>
      )}
      yourExtra={(u) =>
        t("yourPvp", { rating: u.rating as number, winrate: u.winrate as number })
      }
    />
  );
}

// ---------------- Collectors ----------------

async function CollectorsBoard({
  userId,
  country,
  page,
}: {
  userId: string | null;
  country: string;
  page: number;
}) {
  const t = await getTranslations("ranking");

  type AggRow = { ownerId: string; owned: number; shinies: number };

  // Agregación en SQL: evita traer todos los Pokémon al Node.
  const [speciesTotal, agg] = await Promise.all([
    prisma.species.count(),
    country
      ? prisma.$queryRaw<AggRow[]>`
          SELECT p."ownerId" AS "ownerId",
                 COUNT(DISTINCT p."speciesId")::int AS owned,
                 COUNT(*) FILTER (WHERE p."isShiny")::int AS shinies
          FROM "PokemonInstance" p
          INNER JOIN "User" u ON u.id = p."ownerId"
          WHERE u.country = ${country}
          GROUP BY p."ownerId"
          HAVING COUNT(DISTINCT p."speciesId") > 0
        `
      : prisma.$queryRaw<AggRow[]>`
          SELECT p."ownerId" AS "ownerId",
                 COUNT(DISTINCT p."speciesId")::int AS owned,
                 COUNT(*) FILTER (WHERE p."isShiny")::int AS shinies
          FROM "PokemonInstance" p
          GROUP BY p."ownerId"
          HAVING COUNT(DISTINCT p."speciesId") > 0
        `,
  ]);

  const ownerIds = agg.map((r) => r.ownerId);
  const users =
    ownerIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: {
            id: true,
            username: true,
            country: true,
            avatarId: true,
            createdAt: true,
            pokemon: MAIN_POKEMON_INCLUDE,
          },
        });
  const byId = new Map(users.map((u) => [u.id, u]));

  const ranked = agg
    .map((row) => {
      const u = byId.get(row.ownerId);
      if (!u) return null;
      const completion = speciesTotal > 0 ? Math.round((row.owned / speciesTotal) * 100) : 0;
      return {
        id: u.id,
        username: u.username,
        country: u.country,
        avatarId: u.avatarId,
        createdAt: u.createdAt,
        power: row.owned,
        badges: row.shinies,
        owned: row.owned,
        shinies: row.shinies,
        completion,
        mainPokemon: toEmblemPokemon(u.pokemon[0]),
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null)
    .sort(compareCollectors);

  return (
    <BoardShell
      empty={ranked.length === 0}
      emptyLabel={t("emptyCollectors")}
      emptyIcon="target"
      ranked={ranked}
      userId={userId}
      page={page}
      country={country}
      board="collectors"
      renderMetrics={(u) => (
        <>
          <Metric label={t("cols.owned")} value={String(u.owned as number)} accent />
          <Metric label={t("cols.shinies")} value={String(u.shinies as number)} />
          <Metric label={t("cols.completion")} value={`${u.completion as number}%`} />
        </>
      )}
      yourExtra={(u) =>
        t("yourCollectors", {
          owned: u.owned as number,
          completion: u.completion as number,
        })
      }
    />
  );
}

// ---------------- Pokédex (species power) ----------------

async function PokedexBoard({
  userId,
  country,
  page,
  speciesQuery,
}: {
  userId: string | null;
  country: string;
  page: number;
  speciesQuery?: string;
}) {
  const t = await getTranslations("ranking");

  const topSpecies = await prisma.pokemonInstance.groupBy({
    by: ["speciesId"],
    _count: { speciesId: true },
    orderBy: { _count: { speciesId: "desc" } },
    take: 40,
  });
  const speciesIds = topSpecies.map((s) => s.speciesId);
  const speciesList = await prisma.species.findMany({
    where: { id: { in: speciesIds } },
    select: { id: true, name: true, spriteUrl: true, types: true },
    orderBy: { name: "asc" },
  });

  const selectedId =
    speciesQuery && speciesList.some((s) => String(s.id) === speciesQuery)
      ? Number(speciesQuery)
      : (speciesList[0]?.id ?? null);

  if (!selectedId || speciesList.length === 0) {
    return <EmptyState icon="menu_book" label={t("emptyPokedex")} />;
  }

  const selected = speciesList.find((s) => s.id === selectedId)!;
  const instances = await prisma.pokemonInstance.findMany({
    where: {
      speciesId: selectedId,
      ...(country ? { owner: { country } } : {}),
    },
    select: {
      id: true,
      level: true,
      isShiny: true,
      nickname: true,
      ptStrength: true,
      ptDexterity: true,
      ptIntelligence: true,
      ptSpeed: true,
      ptConstitution: true,
      owner: { select: { id: true, username: true, country: true, avatarId: true, createdAt: true } },
      species: { select: SPECIES_STATS_SELECT },
    },
  });

  const ranked = instances
    .map((p) => ({
      id: p.owner.id,
      rowId: p.id,
      username: p.owner.username,
      country: p.owner.country,
      avatarId: p.owner.avatarId,
      createdAt: p.owner.createdAt,
      power: pokemonPower(p),
      badges: p.level,
      level: p.level,
      isShiny: p.isShiny,
      nickname: p.nickname,
      mainPokemon: {
        name: p.nickname?.trim() || selected.name,
        spriteUrl: selected.spriteUrl,
        isShiny: p.isShiny,
      } satisfies NonNullable<RankingEmblemPokemon>,
    }))
    .sort((a, b) => b.power - a.power || b.level - a.level || a.rowId.localeCompare(b.rowId));

  // Deduplicate by owner keeping strongest
  const byOwner = new Map<string, (typeof ranked)[number]>();
  for (const row of ranked) {
    if (!byOwner.has(row.id)) byOwner.set(row.id, row);
  }
  const unique = [...byOwner.values()];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-white/10 bg-black/25 p-3">
        <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.16em] text-on-surface-variant/70">
          {t("filters.species")}
        </p>
        <div className="mb-3 flex items-center gap-2">
          <Image
            src={spriteFor(selected.spriteUrl, false)}
            alt={selected.name}
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
          />
          <div>
            <p className="text-label-md capitalize text-white">{selected.name}</p>
            <div className="flex gap-1">
              {selected.types.map((type) => {
                const color = typeColor(type);
                return (
                  <span
                    key={type}
                    className="rounded px-1.5 py-0.5 text-[9px] uppercase"
                    style={{ backgroundColor: `${color}33`, color }}
                  >
                    {type}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {speciesList.slice(0, 16).map((s) => (
            <Link
              key={s.id}
              href={boardHref("pokedex", country, 1, String(s.id))}
              className={`rounded-md border px-2 py-1 text-[11px] capitalize transition ${
                s.id === selectedId
                  ? "border-white/25 bg-white/[0.07] text-white"
                  : "border-white/10 text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      </div>

      <BoardShell
        empty={unique.length === 0}
        emptyLabel={t("emptySpecies", { name: selected.name })}
        emptyIcon="menu_book"
        ranked={unique}
        userId={userId}
        page={page}
        country={country}
        board="pokedex"
        speciesId={String(selectedId)}
        renderMetrics={(u) => (
          <>
            <Metric label={t("cols.power")} value={u.power.toLocaleString()} accent />
            <Metric label={t("cols.level")} value={String(u.level as number)} />
            {Boolean(u.isShiny) && <Metric label={t("cols.shiny")} value="✦" />}
          </>
        )}
        yourExtra={(u) =>
          t("yourPokedex", { power: u.power, level: u.level as number })
        }
      />
    </div>
  );
}

// ---------------- Shared board chrome ----------------

type RankRow = {
  id: string;
  username: string;
  country: string;
  avatarId: string | null;
  createdAt: Date;
  power: number;
  badges: number;
  mainPokemon?: RankingEmblemPokemon;
  [key: string]: unknown;
};

async function BoardShell({
  empty,
  emptyLabel,
  emptyIcon,
  ranked,
  userId,
  page,
  country,
  board,
  speciesId,
  renderMetrics,
  yourExtra,
}: {
  empty: boolean;
  emptyLabel: string;
  emptyIcon: string;
  ranked: RankRow[];
  userId: string | null;
  page: number;
  country: string;
  board: Board;
  speciesId?: string;
  renderMetrics: (row: RankRow) => ReactNode;
  yourExtra: (row: RankRow) => string;
}) {
  const t = await getTranslations("ranking");
  if (empty) return <EmptyState icon={emptyIcon} label={emptyLabel} />;

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / RANKING_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * RANKING_PAGE_SIZE;
  const pageRows = ranked.slice(start, start + RANKING_PAGE_SIZE);

  const myIndex = userId ? ranked.findIndex((u) => u.id === userId) : -1;
  const me = myIndex >= 0 ? ranked[myIndex] : null;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;

  const top3 = clampedPage === 1 ? ranked.slice(0, 3) : [];
  const listRows =
    clampedPage === 1 ? pageRows.filter((_, i) => start + i + 1 > 3) : pageRows;

  return (
    <div className="flex flex-col gap-4">
      {me && myRank !== null && (
        <section
          className="rank-hero relative overflow-hidden rounded-xl px-5 py-5"
          data-tier={tierForRank(myRank)}
        >
          <ElectricBorder id="rank-electric-displace" />
          <p className="relative z-[1] text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
            {t("yourCard.title")}
          </p>
          <div className="relative z-[1] mt-2 flex flex-wrap items-center gap-4">
            <RankingEmblem
              pokemon={(me.mainPokemon as RankingEmblemPokemon) ?? null}
              size="md"
              tier={tierForRank(myRank)}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-lg font-semibold text-white">
                <span className="truncate">
                  #{myRank}{" "}
                  <span className="text-on-surface-variant">· {me.username}</span>
                </span>
                <FlagIcon
                  code={me.country}
                  className="h-3 w-auto shrink-0 rounded-[1px] opacity-80"
                />
              </p>
              <p className="text-label-sm text-on-surface-variant">{yourExtra(me)}</p>
            </div>
          </div>
        </section>
      )}

      {top3.length > 0 && (
        <section>
          <p className="mb-2.5 text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70">
            {t("podium.title")}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {top3.map((u, i) => {
              const rank = i + 1;
              const isMe = !!userId && u.id === userId;
              return (
                <article
                  key={u.id}
                  className={`relative overflow-hidden rounded-2xl border p-5 ${
                    rank === 1
                      ? "border-electric-yellow/40 bg-gradient-to-b from-electric-yellow/12 to-black/50 sm:order-2 sm:-mt-3 sm:pb-6"
                      : rank === 2
                        ? "border-white/20 bg-black/40 sm:order-1"
                        : "border-amber-700/35 bg-black/40 sm:order-3"
                  } ${isMe ? "ring-1 ring-white/35" : ""}`}
                >
                  <div className="flex flex-col items-center text-center">
                    <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-on-surface-variant/70">
                      #{rank}
                    </p>
                    <RankingEmblem
                      pokemon={(u.mainPokemon as RankingEmblemPokemon) ?? null}
                      size="lg"
                      tier={tierForRank(rank)}
                    />
                    <p className="mt-3 flex items-center gap-1.5 text-label-md font-semibold text-white">
                      {u.username}
                      <FlagIcon code={u.country} className="h-2.5 w-auto rounded-[1px] opacity-70" />
                    </p>
                    {isMe && (
                      <span className="mt-1 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/85">
                        {t("you")}
                      </span>
                    )}
                    <div className="mt-3 flex w-full justify-center gap-3">{renderMetrics(u)}</div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {listRows.length > 0 && (
        <section>
          <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70">
            {t("list.title")}
          </p>
          <ol className="flex flex-col gap-1.5">
            {listRows.map((u) => {
              const rank = ranked.findIndex((r) => r.id === u.id) + 1;
              const isMe = !!userId && u.id === userId;
              return (
                <li
                  key={`${u.id}-${rank}`}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    isMe
                      ? "border-white/25 bg-white/[0.06]"
                      : "border-white/8 bg-black/30"
                  }`}
                >
                  <span className="w-8 shrink-0 text-center font-mono text-sm text-on-surface-variant">
                    #{rank}
                  </span>
                  <RankingEmblem
                    pokemon={(u.mainPokemon as RankingEmblemPokemon) ?? null}
                    size="sm"
                    tier="common"
                    showLabel={false}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-label-md text-white">
                      {u.username}
                      <FlagIcon code={u.country} className="h-2.5 w-auto rounded-[1px] opacity-60" />
                      {isMe && (
                        <span className="rounded border border-white/20 bg-white/10 px-1 text-[9px] uppercase tracking-wider text-white/85">
                          {t("you")}
                        </span>
                      )}
                    </p>
                    {(u.mainPokemon as RankingEmblemPokemon)?.name && (
                      <p className="truncate text-[11px] capitalize text-on-surface-variant/70">
                        {(u.mainPokemon as RankingEmblemPokemon)!.name}
                      </p>
                    )}
                  </div>
                  <div className="hidden items-center gap-3 sm:flex">{renderMetrics(u)}</div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <Pagination
        basePath={boardHref(board, country, undefined, speciesId)}
        page={clampedPage}
        totalPages={totalPages}
        prevLabel={t("pagination.prev")}
        nextLabel={t("pagination.next")}
        pageOfLabel={t("pagination.pageOf", { page: clampedPage, total: totalPages })}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-[9px] font-mono uppercase tracking-wider text-on-surface-variant/65">
        {label}
      </p>
      <p className={`font-mono text-sm font-semibold ${accent ? "text-electric-yellow" : "text-on-surface"}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/12 py-16 text-on-surface-variant">
      <span className="material-symbols-outlined text-[36px]! opacity-50">{icon}</span>
      <p className="text-label-md">{label}</p>
    </div>
  );
}

function Pagination({
  basePath,
  page,
  totalPages,
  prevLabel,
  nextLabel,
  pageOfLabel,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  prevLabel: string;
  nextLabel: string;
  pageOfLabel: string;
}) {
  if (totalPages <= 1) return null;
  const hrefFor = (p: number) => {
    const url = new URL(basePath, "http://local");
    if (p > 1) url.searchParams.set("page", String(p));
    else url.searchParams.delete("page");
    return `${url.pathname}?${url.searchParams.toString()}`;
  };
  return (
    <nav className="mt-1 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="rounded-md border border-white/10 px-3 py-1.5 text-label-sm text-on-surface-variant hover:border-white/25 hover:text-on-surface"
        >
          {prevLabel}
        </Link>
      ) : (
        <span className="px-3 py-1.5 text-label-sm text-on-surface-variant/40">{prevLabel}</span>
      )}
      <span className="text-label-sm text-on-surface-variant">{pageOfLabel}</span>
      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          className="rounded-md border border-white/10 px-3 py-1.5 text-label-sm text-on-surface-variant hover:border-white/25 hover:text-on-surface"
        >
          {nextLabel}
        </Link>
      ) : (
        <span className="px-3 py-1.5 text-label-sm text-on-surface-variant/40">{nextLabel}</span>
      )}
    </nav>
  );
}
