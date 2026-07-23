import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchPokeApi } from "./pokeapi-client";

// Los 18 tipos estándar. "shadow" y "unknown" quedan afuera a propósito:
// son casos especiales de PokeAPI, no tipos jugables.
const TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting",
  "poison", "ground", "flying", "psychic", "bug", "rock", "ghost",
  "dragon", "dark", "steel", "fairy",
] as const;

type TypeName = (typeof TYPES)[number];

interface PokeApiType {
  name: string;
  damage_relations: {
    double_damage_to: { name: string }[];
    half_damage_to: { name: string }[];
    no_damage_to: { name: string }[];
  };
}

// chart[attacker][defender] = multiplicador de daño
export type TypeChart = Record<TypeName, Record<TypeName, number>>;

export async function buildTypeChart(): Promise<TypeChart> {
  const chart = {} as TypeChart;

  for (const attacker of TYPES) {
    chart[attacker] = Object.fromEntries(TYPES.map((t) => [t, 1])) as Record<
      TypeName,
      number
    >;
  }

  await Promise.all(
    TYPES.map(async (attacker) => {
      const data = await fetchPokeApi<PokeApiType>(`/type/${attacker}`);
      for (const t of data.damage_relations.double_damage_to) {
        if (t.name in chart[attacker]) chart[attacker][t.name as TypeName] = 2;
      }
      for (const t of data.damage_relations.half_damage_to) {
        if (t.name in chart[attacker]) chart[attacker][t.name as TypeName] = 0.5;
      }
      for (const t of data.damage_relations.no_damage_to) {
        if (t.name in chart[attacker]) chart[attacker][t.name as TypeName] = 0;
      }
    }),
  );

  return chart;
}

export async function writeTypeChart(chart: TypeChart): Promise<void> {
  const outDir = join(process.cwd(), "src", "data");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, "type-chart.json"),
    JSON.stringify(chart, null, 2),
  );
}
