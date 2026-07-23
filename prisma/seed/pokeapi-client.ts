import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const BASE_URL = "https://pokeapi.co/api/v2";
const CACHE_DIR = join(process.cwd(), ".cache", "pokeapi");

// PokeAPI fair-use policy asks every client to cache responses locally —
// Pokémon data doesn't change, so we hit the network once per resource, ever.
async function readCache<T>(cachePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(cachePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function writeCache(cachePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(data, null, 2));
}

export async function fetchPokeApi<T>(path: string): Promise<T> {
  const cachePath = join(CACHE_DIR, `${path.replace(/\//g, "_")}.json`);
  const cached = await readCache<T>(cachePath);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`PokeAPI ${path} → ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as T;
  await writeCache(cachePath, data);
  return data;
}

// Corre un lote de tareas con concurrencia limitada — cortesía con la API
// en la primera corrida (después todo sale de cache y es instantáneo).
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}
