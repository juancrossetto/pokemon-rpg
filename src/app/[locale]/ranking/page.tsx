import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FlagIcon } from "@/components/flag-icon";
import { getCountryOptions } from "@/lib/countries";
import { typeColor } from "@/lib/type-colors";
import {
  RANKING_PAGE_SIZE,
  compareTrainers,
  pokemonPower,
  teamPower,
} from "@/lib/ranking";

const VIEWS = ["trainers", "ladder", "species"] as const;
type View = (typeof VIEWS)[number];

// Campos base de especie que necesita pokemonPower — se reutiliza en varias queries.
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

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  const view: View = pickView(query.view);
  const countryOptions = getCountryOptions(locale);
  const validCountries = new Set(countryOptions.map((c) => c.code));
  // "" = global. Solo se acepta un país conocido; cualquier otra cosa → global.
  const country = query.country && validCountries.has(query.country) ? query.country : "";
  const page = Math.max(1, Number(query.page) > 0 ? Math.floor(Number(query.page)) : 1);

  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { country: true },
  });

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <h1 className="text-headline-lg md:text-display-lg text-white">{t("title")}</h1>
          <p className="text-label-md text-on-surface-variant mt-1">{t("subtitle")}</p>
        </div>

        {/* Tabs de vista */}
        <div className="flex gap-1 mb-4 border-b border-white/10">
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={`/ranking?view=${v}${country ? `&country=${country}` : ""}`}
              className={`px-4 py-2 text-label-md rounded-t-lg transition-colors flex items-center gap-1.5 ${
                view === v
                  ? "bg-glass-surface text-pokeball-red border border-white/10 border-b-0"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {v === "trainers" ? "trophy" : v === "ladder" ? "swords" : "catching_pokemon"}
              </span>
              {t(`views.${v}`)}
            </Link>
          ))}
        </div>

        {/* Filtro de país: global / mi país / selector */}
        <CountryFilter
          view={view}
          country={country}
          myCountry={me.country}
          options={countryOptions}
          allLabel={t("filters.global")}
          myCountryLabel={t("filters.myCountry")}
          countryLabel={t("filters.country")}
          applyLabel={t("filters.apply")}
        />

        {view === "trainers" ? (
          <TrainersBoard userId={userId} country={country} page={page} />
        ) : view === "ladder" ? (
          <LadderBoard userId={userId} country={country} page={page} />
        ) : (
          <SpeciesBoard
            userId={userId}
            country={country}
            page={page}
            speciesQuery={query.species}
          />
        )}
      </div>
    </div>
  );
}

function pickView(raw: string | undefined): View {
  return VIEWS.includes(raw as View) ? (raw as View) : "trainers";
}

function CountryFilter({
  view,
  country,
  myCountry,
  options,
  allLabel,
  myCountryLabel,
  countryLabel,
  applyLabel,
}: {
  view: View;
  country: string;
  myCountry: string;
  options: { code: string; name: string }[];
  allLabel: string;
  myCountryLabel: string;
  countryLabel: string;
  applyLabel: string;
}) {
  const chipClass = (active: boolean) =>
    `text-label-md px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
      active
        ? "border-pokeball-red/50 bg-pokeball-red/15 text-pokeball-red"
        : "border-white/10 text-on-surface-variant hover:text-on-surface"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Link href={`/ranking?view=${view}`} className={chipClass(country === "")}>
        <span className="material-symbols-outlined text-[16px]">public</span>
        {allLabel}
      </Link>
      <Link
        href={`/ranking?view=${view}&country=${myCountry}`}
        className={chipClass(country === myCountry)}
      >
        <FlagIcon code={myCountry} className="h-3.5 w-auto rounded-[2px]" />
        {myCountryLabel}
      </Link>

      {/* Selector para cualquier otro país (GET nativo, sin JS) */}
      <form method="get" className="flex items-center gap-2 ml-auto">
        <input type="hidden" name="view" value={view} />
        <label className="sr-only" htmlFor="country">
          {countryLabel}
        </label>
        <select
          id="country"
          name="country"
          defaultValue={country}
          className="bg-surface-container border border-white/10 rounded-lg px-2 py-1.5 text-label-md text-on-surface focus:outline-none focus:border-pokeball-red/50"
        >
          <option value="">{allLabel}</option>
          {options.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="text-label-md px-3 py-1.5 rounded-lg bg-pokeball-red text-white hover:bg-pokeball-red/80 transition-colors"
        >
          {applyLabel}
        </button>
      </form>
    </div>
  );
}

// ---------------- Entrenadores (global / país) ----------------

async function TrainersBoard({
  userId,
  country,
  page,
}: {
  userId: string;
  country: string;
  page: number;
}) {
  const t = await getTranslations("ranking");

  // Se cargan todos los entrenadores del segmento con su equipo activo (máx 6
  // por jugador, acota el costo) y el conteo de medallas, y se ordena en app.
  // A escala grande esto pasaría a una columna de poder denormalizada +
  // ORDER BY en la DB (fase 7, anti-cheat/perf) — para el MVP alcanza.
  const users = await prisma.user.findMany({
    where: country ? { country } : undefined,
    select: {
      id: true,
      username: true,
      country: true,
      coins: true,
      createdAt: true,
      _count: { select: { badges: true } },
      pokemon: {
        where: { teamSlot: { not: null } },
        select: {
          level: true,
          ptStrength: true,
          ptDexterity: true,
          ptIntelligence: true,
          ptSpeed: true,
          species: { select: SPECIES_STATS_SELECT },
        },
      },
    },
  });

  const ranked = users
    .map((u) => ({
      id: u.id,
      username: u.username,
      country: u.country,
      coins: u.coins,
      createdAt: u.createdAt,
      badges: u._count.badges,
      power: teamPower(u.pokemon),
    }))
    .sort(compareTrainers);

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / RANKING_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * RANKING_PAGE_SIZE;
  const rows = ranked.slice(start, start + RANKING_PAGE_SIZE);

  const myIndex = ranked.findIndex((u) => u.id === userId);
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const myOnThisPage = myRank !== null && myRank > start && myRank <= start + RANKING_PAGE_SIZE;

  if (total === 0) {
    return <EmptyBoard label={t("emptyTrainers")} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {myRank !== null && !myOnThisPage && (
        <div className="rounded-lg border border-pokeball-red/40 bg-pokeball-red/10 px-4 py-2 text-label-md text-pokeball-red">
          {t("yourRank", { rank: myRank, total })}
        </div>
      )}

      <ol className="flex flex-col gap-1.5">
        {rows.map((u, i) => {
          const rank = start + i + 1;
          const isMe = u.id === userId;
          return (
            <li
              key={u.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-xl ${
                isMe
                  ? "border-pokeball-red/50 bg-pokeball-red/10"
                  : "border-white/10 bg-glass-surface"
              }`}
            >
              <RankBadge rank={rank} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <FlagIcon code={u.country} className="h-3.5 w-auto rounded-[2px] shrink-0" />
                  <span className="text-label-md text-on-surface truncate">{u.username}</span>
                  {isMe && (
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-pokeball-red/20 text-pokeball-red shrink-0">
                      {t("you")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-label-sm text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-tertiary">
                      military_tech
                    </span>
                    {t("badgeCount", { count: u.badges })}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-electric-yellow">
                      bolt
                    </span>
                    {t("power", { value: u.power })}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <Pagination
        basePath={`/ranking?view=trainers${country ? `&country=${country}` : ""}`}
        page={clampedPage}
        totalPages={totalPages}
        prevLabel={t("pagination.prev")}
        nextLabel={t("pagination.next")}
        pageOfLabel={t("pagination.pageOf", { page: clampedPage, total: totalPages })}
      />
    </div>
  );
}

// ---------------- Ladder PvP (rating Elo, global / país) ----------------

async function LadderBoard({
  userId,
  country,
  page,
}: {
  userId: string;
  country: string;
  page: number;
}) {
  const t = await getTranslations("ranking");

  // Solo entra al ladder quien jugó al menos un partido; el rating vive en la
  // DB, así que se ordena y pagina directamente ahí (a diferencia del poder).
  const where = {
    ...(country ? { country } : {}),
    OR: [{ pvpWins: { gt: 0 } }, { pvpLosses: { gt: 0 } }],
  };
  const orderBy = [
    { pvpRating: "desc" as const },
    { pvpWins: "desc" as const },
    { createdAt: "asc" as const },
  ];

  const [total, me] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { pvpRating: true, pvpWins: true, pvpLosses: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / RANKING_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const rows = await prisma.user.findMany({
    where,
    orderBy,
    skip: (clampedPage - 1) * RANKING_PAGE_SIZE,
    take: RANKING_PAGE_SIZE,
    select: { id: true, username: true, country: true, pvpRating: true, pvpWins: true, pvpLosses: true },
  });

  const iPlayed = me.pvpWins + me.pvpLosses > 0;
  // Rango aproximado: cantidad de jugadores con rating estrictamente mayor + 1
  // (los empates comparten cota, suficiente para el MVP).
  const myRank = iPlayed
    ? (await prisma.user.count({ where: { ...where, pvpRating: { gt: me.pvpRating } } })) + 1
    : null;
  const firstRankOnPage = (clampedPage - 1) * RANKING_PAGE_SIZE + 1;
  const lastRankOnPage = firstRankOnPage + rows.length - 1;
  const myOnThisPage = myRank !== null && myRank >= firstRankOnPage && myRank <= lastRankOnPage;

  if (total === 0) {
    return <EmptyBoard label={t("emptyLadder")} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {myRank !== null && !myOnThisPage && (
        <div className="rounded-lg border border-pokeball-red/40 bg-pokeball-red/10 px-4 py-2 text-label-md text-pokeball-red">
          {t("yourLadderRank", { rank: myRank, rating: me.pvpRating })}
        </div>
      )}

      <ol className="flex flex-col gap-1.5">
        {rows.map((u, i) => {
          const rank = firstRankOnPage + i;
          const isMe = u.id === userId;
          return (
            <li
              key={u.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-xl ${
                isMe ? "border-pokeball-red/50 bg-pokeball-red/10" : "border-white/10 bg-glass-surface"
              }`}
            >
              <RankBadge rank={rank} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <FlagIcon code={u.country} className="h-3.5 w-auto rounded-[2px] shrink-0" />
                  <span className="text-label-md text-on-surface truncate">{u.username}</span>
                  {isMe && (
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-pokeball-red/20 text-pokeball-red shrink-0">
                      {t("you")}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-label-sm text-on-surface-variant">
                  {t("record", { wins: u.pvpWins, losses: u.pvpLosses })}
                </div>
              </div>
              <span className="flex items-center gap-1 text-label-md font-mono text-electric-yellow shrink-0">
                <span className="material-symbols-outlined text-[14px]">military_tech</span>
                {u.pvpRating}
              </span>
            </li>
          );
        })}
      </ol>

      <Pagination
        basePath={`/ranking?view=ladder${country ? `&country=${country}` : ""}`}
        page={clampedPage}
        totalPages={totalPages}
        prevLabel={t("pagination.prev")}
        nextLabel={t("pagination.next")}
        pageOfLabel={t("pagination.pageOf", { page: clampedPage, total: totalPages })}
      />
    </div>
  );
}

// ---------------- Especies (el "3er mejor Tyranitar de Argentina") ----------------

async function SpeciesBoard({
  userId,
  country,
  page,
  speciesQuery,
}: {
  userId: string;
  country: string;
  page: number;
  speciesQuery: string | undefined;
}) {
  const t = await getTranslations("ranking");

  const allSpecies = await prisma.species.findMany({
    select: { id: true, name: true, types: true },
    orderBy: { id: "asc" },
  });

  // Especie por defecto: la más poseída, así la vista arranca con algo poblado.
  let speciesId = Number(speciesQuery);
  if (!allSpecies.some((s) => s.id === speciesId)) {
    const popular = await prisma.pokemonInstance.groupBy({
      by: ["speciesId"],
      _count: { speciesId: true },
      orderBy: { _count: { speciesId: "desc" } },
      take: 1,
    });
    speciesId = popular[0]?.speciesId ?? allSpecies[0]?.id ?? 1;
  }
  const species = allSpecies.find((s) => s.id === speciesId)!;

  const instances = await prisma.pokemonInstance.findMany({
    where: {
      speciesId,
      ...(country ? { owner: { is: { country } } } : {}),
    },
    select: {
      id: true,
      nickname: true,
      level: true,
      isShiny: true,
      ptStrength: true,
      ptDexterity: true,
      ptIntelligence: true,
      ptSpeed: true,
      ownerId: true,
      owner: { select: { username: true, country: true } },
      species: { select: SPECIES_STATS_SELECT },
    },
  });

  const ranked = instances
    .map((p) => ({
      id: p.id,
      nickname: p.nickname,
      level: p.level,
      isShiny: p.isShiny,
      ownerId: p.ownerId,
      ownerName: p.owner.username,
      ownerCountry: p.owner.country,
      power: pokemonPower(p),
    }))
    // Poder desc; desempate por nivel y luego id para orden estable.
    .sort((a, b) => b.power - a.power || b.level - a.level || a.id.localeCompare(b.id));

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / RANKING_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * RANKING_PAGE_SIZE;
  const rows = ranked.slice(start, start + RANKING_PAGE_SIZE);
  const color = typeColor(species.types[0] ?? "normal");

  const keep = country ? `&country=${country}` : "";

  return (
    <div className="flex flex-col gap-3">
      {/* Selector de especie */}
      <form method="get" className="flex items-center gap-2">
        <input type="hidden" name="view" value="species" />
        {country && <input type="hidden" name="country" value={country} />}
        <label className="text-label-md text-on-surface-variant" htmlFor="species">
          {t("filters.species")}
        </label>
        <select
          id="species"
          name="species"
          defaultValue={String(speciesId)}
          className="bg-surface-container border border-white/10 rounded-lg px-2 py-1.5 text-label-md text-on-surface capitalize focus:outline-none focus:border-pokeball-red/50 flex-1 max-w-xs"
        >
          {allSpecies.map((s) => (
            <option key={s.id} value={s.id} className="capitalize">
              #{s.id} · {s.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="text-label-md px-3 py-1.5 rounded-lg bg-pokeball-red text-white hover:bg-pokeball-red/80 transition-colors"
        >
          {t("filters.apply")}
        </button>
      </form>

      {total === 0 ? (
        <EmptyBoard label={t("emptySpecies", { name: species.name })} />
      ) : (
        <>
          <p className="text-label-sm text-on-surface-variant capitalize">
            {t("speciesCaption", { name: species.name, count: total })}
          </p>
          <ol className="flex flex-col gap-1.5">
            {rows.map((p, i) => {
              const rank = start + i + 1;
              const isMine = p.ownerId === userId;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-xl ${
                    isMine
                      ? "border-pokeball-red/50 bg-pokeball-red/10"
                      : "border-white/10 bg-glass-surface"
                  }`}
                  style={!isMine ? { borderColor: `${color}22` } : undefined}
                >
                  <RankBadge rank={rank} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-label-md text-on-surface capitalize truncate">
                        {p.nickname ?? species.name}
                      </span>
                      {p.isShiny && (
                        <span className="text-label-sm text-electric-yellow shrink-0">✦</span>
                      )}
                      <span className="text-label-sm text-on-surface-variant shrink-0">
                        {t("levelShort", { level: p.level })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-label-sm text-on-surface-variant">
                      <FlagIcon
                        code={p.ownerCountry}
                        className="h-3 w-auto rounded-[1px] shrink-0"
                      />
                      <span className="truncate">{p.ownerName}</span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-label-md font-mono shrink-0" style={{ color }}>
                    <span className="material-symbols-outlined text-[14px]">bolt</span>
                    {p.power}
                  </span>
                </li>
              );
            })}
          </ol>

          <Pagination
            basePath={`/ranking?view=species&species=${speciesId}${keep}`}
            page={clampedPage}
            totalPages={totalPages}
            prevLabel={t("pagination.prev")}
            nextLabel={t("pagination.next")}
            pageOfLabel={t("pagination.pageOf", { page: clampedPage, total: totalPages })}
          />
        </>
      )}
    </div>
  );
}

// ---------------- Piezas compartidas ----------------

function RankBadge({ rank }: { rank: number }) {
  // Podio con color; del 4º en adelante, número monoespaciado.
  const medal =
    rank === 1
      ? { bg: "bg-electric-yellow/20", text: "text-electric-yellow", border: "border-electric-yellow/50" }
      : rank === 2
        ? { bg: "bg-white/10", text: "text-on-surface", border: "border-white/30" }
        : rank === 3
          ? { bg: "bg-[#cd7f32]/20", text: "text-[#cd7f32]", border: "border-[#cd7f32]/50" }
          : null;

  if (medal) {
    return (
      <span
        className={`w-8 h-8 shrink-0 rounded-full border flex items-center justify-center font-mono text-label-md font-bold ${medal.bg} ${medal.text} ${medal.border}`}
      >
        {rank}
      </span>
    );
  }
  return (
    <span className="w-8 h-8 shrink-0 flex items-center justify-center font-mono text-label-md text-on-surface-variant">
      {rank}
    </span>
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
  const sep = basePath.includes("?") ? "&" : "?";

  return (
    <nav className="flex items-center justify-center gap-3 mt-1">
      {page > 1 ? (
        <Link
          href={`${basePath}${sep}page=${page - 1}`}
          className="text-label-md px-3 py-1.5 rounded-lg border border-white/10 text-on-surface hover:border-pokeball-red/40 transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          {prevLabel}
        </Link>
      ) : (
        <span className="text-label-md px-3 py-1.5 rounded-lg border border-white/5 text-on-surface-variant/40 flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          {prevLabel}
        </span>
      )}
      <span className="text-label-md text-on-surface-variant">{pageOfLabel}</span>
      {page < totalPages ? (
        <Link
          href={`${basePath}${sep}page=${page + 1}`}
          className="text-label-md px-3 py-1.5 rounded-lg border border-white/10 text-on-surface hover:border-pokeball-red/40 transition-colors flex items-center gap-1"
        >
          {nextLabel}
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </Link>
      ) : (
        <span className="text-label-md px-3 py-1.5 rounded-lg border border-white/5 text-on-surface-variant/40 flex items-center gap-1">
          {nextLabel}
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </span>
      )}
    </nav>
  );
}

function EmptyBoard({ label }: { label: string }) {
  return (
    <div className="bg-glass-surface border border-white/5 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-on-surface-variant">
      <span className="material-symbols-outlined text-[40px] mb-2 opacity-50">leaderboard</span>
      <span className="text-label-md text-center">{label}</span>
    </div>
  );
}
