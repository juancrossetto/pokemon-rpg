/**
 * Rellena el requisito de evolución del lado del hijo desde las cadenas de
 * PokeAPI: `evolveTrigger`, `evolveItem` y `evolveMinLevel`.
 *
 * Complementa a `backfill-evolve-level.ts`, que solo cubría el trigger
 * "level-up" y guardaba el nivel en el padre — con eso, las 20 evoluciones por
 * piedra o intercambio de Kanto no mostraban ningún requisito, y las tres de
 * Eevee no podían distinguirse entre sí.
 *
 * Requiere las columnas de `prisma/sql/add-evolve-method.sql`.
 */
import { prisma } from "../src/lib/prisma";
import { fetchPokeApi, runWithConcurrency } from "../prisma/seed/pokeapi-client";

type EvoDetail = {
  trigger: { name: string };
  min_level: number | null;
  item: { name: string } | null;
};

type ChainLink = {
  species: { name: string; url: string };
  evolution_details: EvoDetail[];
  evolves_to: ChainLink[];
};

type EvolutionChain = { chain: ChainLink };
type SpeciesApi = { id: number; evolution_chain: { url: string } | null };

type Method = {
  trigger: string;
  item: string | null;
  minLevel: number | null;
};

function idFromUrl(url: string): number {
  const parts = url.replace(/\/$/, "").split("/");
  return Number(parts[parts.length - 1]);
}

/** "water-stone" → "Water Stone", que es como se llama en la tabla `Item`. */
function itemName(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function walk(link: ChainLink, out: Map<number, Method>) {
  for (const child of link.evolves_to) {
    const childId = idFromUrl(child.species.url);
    // El primer detalle es el canónico; los alternativos (formas regionales,
    // versiones concretas) no aplican al alcance de este juego.
    const detail = child.evolution_details[0];
    if (detail) {
      out.set(childId, {
        trigger: detail.trigger.name,
        item: detail.item ? itemName(detail.item.name) : null,
        minLevel: detail.min_level,
      });
    }
    walk(child, out);
  }
}

async function main() {
  for (const column of [
    `ALTER TABLE "Species" ADD COLUMN IF NOT EXISTS "evolveTrigger" TEXT`,
    `ALTER TABLE "Species" ADD COLUMN IF NOT EXISTS "evolveItem" TEXT`,
    `ALTER TABLE "Species" ADD COLUMN IF NOT EXISTS "evolveMinLevel" INTEGER`,
  ]) {
    await prisma.$executeRawUnsafe(column);
  }

  const species = await prisma.species.findMany({ select: { id: true } });
  const chainUrls = new Set<string>();

  console.log(`→ Leyendo evolution_chain de ${species.length} especies...`);
  await runWithConcurrency(species, 8, async (s) => {
    const api = await fetchPokeApi<SpeciesApi>(`/pokemon-species/${s.id}`);
    if (api.evolution_chain?.url) {
      chainUrls.add(api.evolution_chain.url.replace("https://pokeapi.co/api/v2", ""));
    }
  });

  const methodBySpecies = new Map<number, Method>();
  console.log(`→ ${chainUrls.size} cadenas únicas...`);
  await runWithConcurrency([...chainUrls], 6, async (path) => {
    const chain = await fetchPokeApi<EvolutionChain>(path);
    walk(chain.chain, methodBySpecies);
  });

  let updated = 0;
  for (const [id, method] of methodBySpecies) {
    const res = await prisma.species.updateMany({
      where: { id },
      data: {
        evolveTrigger: method.trigger,
        evolveItem: method.item,
        evolveMinLevel: method.minLevel,
      },
    });
    updated += res.count;
  }

  const missing = await prisma.species.count({
    where: { evolvesFromId: { not: null }, evolveTrigger: null },
  });
  console.log(`→ Actualizadas ${updated} especies. Sin método: ${missing}.`);

  const sample = await prisma.species.findMany({
    where: { id: { in: [26, 65, 94, 134, 135, 136] } },
    select: { id: true, name: true, evolveTrigger: true, evolveItem: true, evolveMinLevel: true },
    orderBy: { id: "asc" },
  });
  console.table(sample);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
