/**
 * Rellena Species.evolveLevel desde las cadenas de PokeAPI (solo trigger level-up).
 * Requiere la columna evolveLevel (prisma/sql/add-evolve-level.sql).
 */
import { prisma } from "../src/lib/prisma";
import { fetchPokeApi, runWithConcurrency } from "../prisma/seed/pokeapi-client";

type EvoDetail = {
  trigger: { name: string };
  min_level: number | null;
};

type ChainLink = {
  species: { name: string; url: string };
  evolution_details: EvoDetail[];
  evolves_to: ChainLink[];
};

type EvolutionChain = { chain: ChainLink };

type SpeciesApi = {
  id: number;
  evolution_chain: { url: string };
};

function idFromUrl(url: string): number {
  const parts = url.replace(/\/$/, "").split("/");
  return Number(parts[parts.length - 1]);
}

function walk(
  link: ChainLink,
  out: Map<number, number>,
) {
  for (const child of link.evolves_to) {
    const childId = idFromUrl(child.species.url);
    const levelUp = child.evolution_details.find(
      (d) => d.trigger.name === "level-up" && d.min_level != null,
    );
    if (levelUp?.min_level != null) {
      const fromId = idFromUrl(link.species.url);
      // evolveLevel vive en la forma pre-evolución.
      out.set(fromId, levelUp.min_level);
    }
    walk(child, out);
  }
}

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Species" ADD COLUMN IF NOT EXISTS "evolveLevel" INTEGER`,
  );

  const species = await prisma.species.findMany({ select: { id: true } });
  const evolveLevelBySpecies = new Map<number, number>();
  const chainUrls = new Set<string>();

  console.log(`→ Leyendo evolution_chain de ${species.length} especies...`);
  await runWithConcurrency(species, 8, async (s) => {
    const api = await fetchPokeApi<SpeciesApi>(`/pokemon-species/${s.id}`);
    if (api.evolution_chain?.url) {
      const path = api.evolution_chain.url.replace("https://pokeapi.co/api/v2", "");
      chainUrls.add(path);
    }
  });

  console.log(`→ ${chainUrls.size} cadenas únicas...`);
  await runWithConcurrency([...chainUrls], 6, async (path) => {
    const chain = await fetchPokeApi<EvolutionChain>(path);
    walk(chain.chain, evolveLevelBySpecies);
  });

  let updated = 0;
  for (const [id, level] of evolveLevelBySpecies) {
    const res = await prisma.species.updateMany({
      where: { id },
      data: { evolveLevel: level },
    });
    updated += res.count;
  }

  const bulb = await prisma.species.findUnique({
    where: { id: 1 },
    select: { name: true, evolveLevel: true, evolvesTo: { select: { name: true } } },
  });
  console.log(`→ Actualizadas ${updated} especies. Bulbasaur:`, bulb);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
