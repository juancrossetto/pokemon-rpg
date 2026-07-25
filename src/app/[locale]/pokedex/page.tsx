import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { syncPokedexSeen } from "@/lib/pokedex-seen";
import {
  LEGENDARY_IDS,
  MYTHICAL_IDS,
  POKEDEX_REGIONS,
  PSEUDO_IDS,
  STARTER_IDS,
  speciesRarity,
  type PokedexProgress,
  type PokedexRegionId,
  type PokedexSpeciesCard,
  type RegionProgress,
} from "@/lib/pokedex";
import { PokedexTerminal, type PokedexLabels } from "@/components/pokedex-terminal";

export default async function PokedexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, session] = await Promise.all([getTranslations("pokedex"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const userId = session.user.id;
  await redirectIfInBattle(userId, locale);
  await syncPokedexSeen(userId);

  const [species, owned, seenRows] = await Promise.all([
    prisma.species.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        types: true,
        spriteUrl: true,
        generation: true,
        captureRate: true,
        baseHp: true,
        baseAttack: true,
        baseDefense: true,
        baseSpAtk: true,
        baseSpDef: true,
        baseSpeed: true,
        evolvesFromId: true,
        evolvesTo: { select: { id: true } },
      },
    }),
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId },
      select: {
        speciesId: true,
        isShiny: true,
        isFavorite: true,
      },
    }),
    prisma.pokedexEntry.findMany({
      where: { userId },
      select: { speciesId: true },
    }),
  ]);

  const caughtIds = new Set(owned.map((o) => o.speciesId));
  const seenIds = new Set(seenRows.map((s) => s.speciesId));
  for (const id of caughtIds) seenIds.add(id);

  const shinySpecies = new Set(owned.filter((o) => o.isShiny).map((o) => o.speciesId));
  const favoriteSpecies = new Set(owned.filter((o) => o.isFavorite).map((o) => o.speciesId));

  const entries: PokedexSpeciesCard[] = species.map((s) => {
    let status: PokedexSpeciesCard["status"] = "unseen";
    if (caughtIds.has(s.id)) {
      status = "caught";
    } else if (seenIds.has(s.id)) {
      status = "seen";
    }

    const isMythical = MYTHICAL_IDS.has(s.id);
    const isLegendary = LEGENDARY_IDS.has(s.id) || isMythical;

    return {
      id: s.id,
      name: s.name,
      types: s.types,
      spriteUrl: s.spriteUrl,
      generation: s.generation,
      captureRate: s.captureRate,
      baseHp: s.baseHp,
      baseAttack: s.baseAttack,
      baseDefense: s.baseDefense,
      baseSpAtk: s.baseSpAtk,
      baseSpDef: s.baseSpDef,
      baseSpeed: s.baseSpeed,
      evolvesFromId: s.evolvesFromId,
      evolvesToIds: s.evolvesTo.map((e) => e.id),
      status,
      rarity: speciesRarity({ id: s.id, captureRate: s.captureRate }),
      isStarter: STARTER_IDS.has(s.id),
      isPseudo: PSEUDO_IDS.has(s.id),
      isLegendary,
      isMythical,
      hasShiny: shinySpecies.has(s.id),
      isFavorite: favoriteSpecies.has(s.id),
    };
  });

  const total = species.length;
  const seen = seenIds.size;
  const caught = caughtIds.size;
  const completion = total === 0 ? 0 : Math.round((caught / total) * 1000) / 10;
  const shinyCount = shinySpecies.size;
  const legendaryCaught = [...caughtIds].filter(
    (id) => LEGENDARY_IDS.has(id) || MYTHICAL_IDS.has(id),
  ).length;

  const regions: RegionProgress[] = POKEDEX_REGIONS.map((r) => {
    const inRegion = species.filter((s) => s.generation === r.generation);
    const regionTotal = inRegion.length;
    const regionSeen = inRegion.filter((s) => seenIds.has(s.id)).length;
    const regionCaught = inRegion.filter((s) => caughtIds.has(s.id)).length;
    return {
      id: r.id,
      generation: r.generation,
      available: r.available && regionTotal > 0,
      total: regionTotal,
      seen: regionSeen,
      caught: regionCaught,
    };
  });

  // Si Johto+ no tienen especies en DB, marcar available false.
  for (const r of regions) {
    if (r.total === 0) r.available = false;
  }

  const progress: PokedexProgress = {
    total,
    seen,
    caught,
    completion,
    shiny: shinyCount,
    legendary: legendaryCaught,
    regions,
  };

  const labels: PokedexLabels = {
    eyebrow: t("eyebrow"),
    title: t("title"),
    researchDatabase: t("researchDatabase"),
    signInHint: t("signInHint"),
    comingSoon: t("comingSoon"),
    noResults: t("noResults"),
    completion: t("progress.completion"),
    searchPlaceholder: t("searchPlaceholder"),
    regions: Object.fromEntries(
      POKEDEX_REGIONS.map((r) => [r.id, t(`regions.${r.id}`)]),
    ) as Record<PokedexRegionId, string>,
    progress: {
      seen: t("progress.seen"),
      captured: t("progress.captured"),
      completion: t("progress.completion"),
      shiny: t("progress.shiny"),
      legendary: t("progress.legendary"),
    },
    filters: {
      all: t("filters.all"),
      seen: t("filters.seen"),
      caught: t("filters.caught"),
      missing: t("filters.missing"),
      favorites: t("filters.favorites"),
      shiny: t("filters.shiny"),
      legendary: t("filters.legendary"),
      mythical: t("filters.mythical"),
      starter: t("filters.starter"),
      pseudo: t("filters.pseudo"),
    },
    sort: {
      label: t("sort.label"),
      number: t("sort.number"),
      name: t("sort.name"),
      rarity: t("sort.rarity"),
    },
    view: {
      grid: t("view.grid"),
      list: t("view.list"),
    },
    typeFilter: t("typeFilter"),
    allTypes: t("allTypes"),
    pokemonTypes: {
      normal: t("pokemonTypes.normal"),
      fire: t("pokemonTypes.fire"),
      water: t("pokemonTypes.water"),
      electric: t("pokemonTypes.electric"),
      grass: t("pokemonTypes.grass"),
      ice: t("pokemonTypes.ice"),
      fighting: t("pokemonTypes.fighting"),
      poison: t("pokemonTypes.poison"),
      ground: t("pokemonTypes.ground"),
      flying: t("pokemonTypes.flying"),
      psychic: t("pokemonTypes.psychic"),
      bug: t("pokemonTypes.bug"),
      rock: t("pokemonTypes.rock"),
      ghost: t("pokemonTypes.ghost"),
      dragon: t("pokemonTypes.dragon"),
      dark: t("pokemonTypes.dark"),
      steel: t("pokemonTypes.steel"),
      fairy: t("pokemonTypes.fairy"),
    },
    rarity: {
      common: t("rarity.common"),
      rare: t("rarity.rare"),
      epic: t("rarity.epic"),
      legendary: t("rarity.legendary"),
      mythical: t("rarity.mythical"),
      ultraBeast: t("rarity.ultraBeast"),
      paradox: t("rarity.paradox"),
    },
    stats: {
      hp: t("stats.hp"),
      atk: t("stats.atk"),
      def: t("stats.def"),
      spa: t("stats.spa"),
      spd: t("stats.spd"),
      spe: t("stats.spe"),
      capture: t("stats.capture"),
      evolves: t("stats.evolves"),
    },
    unknown: t("unknown"),
    statusCaught: t("statusCaught"),
    statusSeen: t("statusSeen"),
    research: t("research"),
    icons: {
      favorite: t("icons.favorite"),
      shiny: t("icons.shiny"),
      legendary: t("icons.legendary"),
      mythical: t("icons.mythical"),
      starter: t("icons.starter"),
      pseudo: t("icons.pseudo"),
    },
  };

  const defaultRegion =
    (regions.find((r) => r.available)?.id as PokedexRegionId | undefined) ?? "kanto";

  return (
    <div className="flex-1 px-margin-mobile py-6 md:px-margin-desktop md:py-8">
      <div className="mx-auto max-w-7xl">
        <PokedexTerminal
          entries={entries}
          progress={progress}
          labels={labels}
          signedIn
          initialRegion={defaultRegion}
        />
      </div>
    </div>
  );
}
