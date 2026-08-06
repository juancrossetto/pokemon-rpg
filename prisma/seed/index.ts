import "dotenv/config";
import { prisma } from "../../src/lib/prisma";
import { fetchPokeApi, runWithConcurrency } from "./pokeapi-client";
import { buildTypeChart, writeTypeChart } from "./type-chart";
import { seedItems } from "./items";
import { seedHeldItems } from "./held-items";
import { seedGyms } from "./gyms";
import { seedMachines, MACHINES } from "./machines";

/**
 * Seed por generación. `SEED_GEN_LIMIT` (default 151) corta el tope de dex #.
 *
 * Cada gen trae `versionGroups` preferidos para level-up / MT. Si se sube el
 * límite a 251 sin esto, Johto quedaría con movesets vacíos (PokeAPI no tiene
 * level-up de Chikorita en "red-blue"). Preferidos en orden; si ninguno
 * matchea, se usa el earliest version_group presente en la respuesta.
 *
 * Para importar Gen 2 (Johto) sin habilitar la liga: `SEED_GEN_LIMIT=251 npm
 * run db:seed` y `speciesAvailable: true` en `@/lib/regions` (playable /
 * gymsAvailable siguen en false → Pokédex bloqueada, sin capturas).
 */
const GENERATIONS = [
  { gen: 1, species: [1, 151] as const, versionGroups: ["red-blue", "gold-silver"] },
  { gen: 2, species: [152, 251] as const, versionGroups: ["gold-silver"] },
  { gen: 3, species: [252, 386] as const, versionGroups: ["emerald", "ruby-sapphire"] },
  { gen: 4, species: [387, 493] as const, versionGroups: ["platinum", "diamond-pearl"] },
] as const;

const SPECIES_LIMIT = Number(process.env.SEED_GEN_LIMIT ?? 151);
const CONCURRENCY = 5;

interface PokeApiPokemon {
  id: number;
  name: string;
  sprites: {
    front_default: string | null;
    other?: {
      "official-artwork"?: { front_default: string | null };
      home?: { front_default: string | null };
    };
  };
  types: { type: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
  moves: {
    move: { name: string };
    version_group_details: {
      level_learned_at: number;
      move_learn_method: { name: string };
      version_group: { name: string };
    }[];
  }[];
}

type VersionDetail = PokeApiPokemon["moves"][number]["version_group_details"][number];

function preferredVersionGroupsForSpecies(speciesId: number): readonly string[] {
  for (const g of GENERATIONS) {
    if (speciesId >= g.species[0] && speciesId <= g.species[1]) {
      return g.versionGroups;
    }
  }
  return GENERATIONS[0].versionGroups;
}

/** Elige el version_group a usar para level-up / machine de una especie. */
function resolveVersionGroup(
  speciesId: number,
  details: VersionDetail[],
  method: "level-up" | "machine",
): string | null {
  const preferred = preferredVersionGroupsForSpecies(speciesId);
  const methodDetails = details.filter((d) => d.move_learn_method.name === method);
  if (methodDetails.length === 0) return null;

  for (const group of preferred) {
    if (methodDetails.some((d) => d.version_group.name === group)) return group;
  }

  // Fallback: earliest group presente (orden de aparición en PokeAPI ≈ cronológico).
  const fallback = methodDetails[0]?.version_group.name ?? null;
  if (fallback) {
    console.warn(
      `  ⚠ species #${speciesId}: sin version group preferido para ${method}; uso "${fallback}"`,
    );
  }
  return fallback;
}

interface PokeApiSpecies {
  generation: { name: string };
  evolves_from_species: { url: string } | null;
  capture_rate: number;
}

interface PokeApiMove {
  id: number;
  name: string;
  type: { name: string };
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  damage_class: { name: "physical" | "special" | "status" };
  effect_entries: { effect: string; language: { name: string } }[];
  target: { name: string };
}

function statFrom(pokemon: PokeApiPokemon, name: string): number {
  return pokemon.stats.find((s) => s.stat.name === name)?.base_stat ?? 0;
}

function generationNumber(generationName: string): number {
  // "generation-i" → 1, "generation-ii" → 2, ...
  const roman = generationName.replace("generation-", "");
  const romanValues: Record<string, number> = {
    i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9,
  };
  return romanValues[roman] ?? 0;
}

function idFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/);
  if (!match) throw new Error(`No pude extraer un id de ${url}`);
  return Number(match[1]);
}

async function seedTypeChart() {
  console.log("→ Efectividad de tipos...");
  const chart = await buildTypeChart();
  await writeTypeChart(chart);
  console.log("  src/data/type-chart.json listo");
}

async function seedSpeciesAndMoves() {
  const speciesIds = Array.from({ length: SPECIES_LIMIT }, (_, i) => i + 1);
  const learnedMoveNames = new Set<string>(MACHINES.map((m) => m.moveName));
  const machineMoveNames = new Set(MACHINES.map((m) => m.moveName));

  console.log(`→ Especies 1-${SPECIES_LIMIT}...`);
  await runWithConcurrency(speciesIds, CONCURRENCY, async (id) => {
    const [pokemon, species] = await Promise.all([
      fetchPokeApi<PokeApiPokemon>(`/pokemon/${id}`),
      fetchPokeApi<PokeApiSpecies>(`/pokemon-species/${id}`),
    ]);

    const levelUpGroup = resolveVersionGroup(
      pokemon.id,
      pokemon.moves.flatMap((m) => m.version_group_details),
      "level-up",
    );
    const levelUpMoves = pokemon.moves
      .map((m) => {
        if (!levelUpGroup) return null;
        const detail = m.version_group_details.find(
          (d) =>
            d.version_group.name === levelUpGroup &&
            d.move_learn_method.name === "level-up",
        );
        return detail ? { name: m.move.name, level: detail.level_learned_at } : null;
      })
      .filter((m): m is { name: string; level: number } => m !== null);

    // Compatibilidad real con MT/MO: solo movimientos que además tienen un
    // Item real (ver machines.ts) — evita filas de SpeciesMove sin ítem que
    // las respalde.
    const machineGroup = resolveVersionGroup(
      pokemon.id,
      pokemon.moves.flatMap((m) => m.version_group_details),
      "machine",
    );
    const machineMoves = pokemon.moves
      .filter((m) =>
        machineGroup
          ? m.version_group_details.some(
              (d) =>
                d.version_group.name === machineGroup &&
                d.move_learn_method.name === "machine",
            )
          : false,
      )
      .map((m) => m.move.name)
      .filter((name) => machineMoveNames.has(name));

    for (const move of levelUpMoves) learnedMoveNames.add(move.name);

    // evolvesFromId se resuelve en un segundo pase (ver abajo): con carga
    // concurrente, la especie de la que evoluciona puede no existir todavía
    // y viola la foreign key.
    await prisma.species.upsert({
      where: { id: pokemon.id },
      create: {
        id: pokemon.id,
        name: pokemon.name,
        types: pokemon.types.map((t) => t.type.name),
        baseHp: statFrom(pokemon, "hp"),
        baseAttack: statFrom(pokemon, "attack"),
        baseDefense: statFrom(pokemon, "defense"),
        baseSpAtk: statFrom(pokemon, "special-attack"),
        baseSpDef: statFrom(pokemon, "special-defense"),
        baseSpeed: statFrom(pokemon, "speed"),
        spriteUrl:
          pokemon.sprites.other?.["official-artwork"]?.front_default ??
          pokemon.sprites.front_default ??
          "",
        generation: generationNumber(species.generation.name),
        captureRate: species.capture_rate,
      },
      update: { captureRate: species.capture_rate },
    });

    if (species.evolves_from_species) {
      // Algunas especies de Kanto tienen una pre-evolución "bebé" agregada
      // en una generación posterior (ej. Pikachu ← Pichu, id 172, gen II).
      // Si esa pre-evolución cae afuera del rango sembrado, se ignora acá.
      const evolvesFromId = idFromUrl(species.evolves_from_species.url);
      if (evolvesFromId <= SPECIES_LIMIT) {
        evolutionBySpeciesId.set(pokemon.id, evolvesFromId);
      }
    }

    // Se guarda para un segundo paso: necesitamos que todos los Move existan
    // antes de crear las filas de SpeciesMove.
    speciesMoveCache.set(pokemon.id, levelUpMoves);
    speciesMachineCache.set(pokemon.id, machineMoves);
  });

  console.log("→ Cadenas de evolución...");
  for (const [speciesId, evolvesFromId] of evolutionBySpeciesId) {
    await prisma.species.update({
      where: { id: speciesId },
      data: { evolvesFromId },
    });
  }

  console.log(`→ Movimientos (${learnedMoveNames.size} distintos)...`);
  await runWithConcurrency([...learnedMoveNames], CONCURRENCY, async (name) => {
    const move = await fetchPokeApi<PokeApiMove>(`/move/${name}`);
    const effect = move.effect_entries.find((e) => e.language.name === "en");

    await prisma.move.upsert({
      where: { id: move.id },
      create: {
        id: move.id,
        name: move.name,
        type: move.type.name,
        category: move.damage_class.name.toUpperCase() as
          | "PHYSICAL"
          | "SPECIAL"
          | "STATUS",
        power: move.power,
        accuracy: move.accuracy,
        pp: move.pp,
        priority: move.priority,
        effectText: effect?.effect ?? null,
        target: move.target?.name ?? "selected-pokemon",
      },
      update: {
        target: move.target?.name ?? "selected-pokemon",
        effectText: effect?.effect ?? null,
      },
    });
    moveIdByName.set(move.name, move.id);
  });

  console.log("→ Relación especie ↔ movimiento (nivel)...");
  for (const [speciesId, moves] of speciesMoveCache) {
    for (const { name, level } of moves) {
      const moveId = moveIdByName.get(name);
      if (!moveId) continue;
      await prisma.speciesMove.upsert({
        where: { speciesId_moveId_method: { speciesId, moveId, method: "LEVEL_UP" } },
        create: { speciesId, moveId, method: "LEVEL_UP", learnLevel: level },
        update: { learnLevel: level },
      });
    }
  }

  console.log("→ Relación especie ↔ movimiento (MT/MO)...");
  for (const [speciesId, moveNames] of speciesMachineCache) {
    for (const name of moveNames) {
      const moveId = moveIdByName.get(name);
      if (!moveId) continue;
      await prisma.speciesMove.upsert({
        where: { speciesId_moveId_method: { speciesId, moveId, method: "MACHINE" } },
        create: { speciesId, moveId, method: "MACHINE", learnLevel: null },
        update: {},
      });
    }
  }
}

const speciesMoveCache = new Map<number, { name: string; level: number }[]>();
const speciesMachineCache = new Map<number, string[]>();
const moveIdByName = new Map<string, number>();
const evolutionBySpeciesId = new Map<number, number>();

async function main() {
  await seedTypeChart();
  await seedSpeciesAndMoves();
  await seedMachines();
  await seedItems();
  await seedHeldItems();
  await seedGyms();
  console.log("✓ Seed completo");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
