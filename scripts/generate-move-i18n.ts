/**
 * Genera `src/data/move-i18n.json` con nombre + flavor text en en/es/pt
 * desde PokeAPI (sin tocar la DB). Gen 1 por defecto (~165 moves).
 *
 *   npx tsx scripts/generate-move-i18n.ts
 *   SEED_GEN_LIMIT=251 npx tsx scripts/generate-move-i18n.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const POKEAPI = "https://pokeapi.co/api/v2";
const CONCURRENCY = 8;
/** Tope de dex → moves de esa gen + anteriores. Gen1 ≈ move id ≤ 165. */
const SPECIES_LIMIT = Number(process.env.SEED_GEN_LIMIT ?? 151);
const MOVE_ID_CAP =
  SPECIES_LIMIT <= 151 ? 165 : SPECIES_LIMIT <= 251 ? 251 : 826;

type LangEntry = { name: string; effect: string };
type MoveI18n = Record<string, { en: LangEntry; es: LangEntry; pt: LangEntry }>;

type PokeName = { name: string; language: { name: string } };
type PokeFlavor = {
  flavor_text: string;
  language: { name: string };
  version_group: { name: string };
};
type PokeEffect = {
  effect: string;
  short_effect: string;
  language: { name: string };
};
type PokeMove = {
  id: number;
  name: string;
  names: PokeName[];
  flavor_text_entries: PokeFlavor[];
  effect_entries: PokeEffect[];
};

function pickName(names: PokeName[], lang: string): string | null {
  return names.find((n) => n.language.name === lang)?.name ?? null;
}

function cleanFlavor(raw: string): string {
  return raw.replace(/\f/g, " ").replace(/\s+/g, " ").trim();
}

function pickFlavor(entries: PokeFlavor[], lang: string): string | null {
  const matches = entries.filter((e) => e.language.name === lang);
  if (matches.length === 0) return null;
  // Última entrada = gen más reciente en el array de PokeAPI.
  return cleanFlavor(matches[matches.length - 1]!.flavor_text);
}

function pickEffect(entries: PokeEffect[], lang: string): string | null {
  const hit = entries.find((e) => e.language.name === lang);
  if (!hit) return null;
  return hit.short_effect.replace(/\s+/g, " ").trim() || hit.effect.replace(/\s+/g, " ").trim();
}

function titleCaseSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchMove(id: number): Promise<PokeMove | null> {
  const res = await fetch(`${POKEAPI}/move/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`move/${id}: ${res.status}`);
  return (await res.json()) as PokeMove;
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

async function main() {
  const ids = Array.from({ length: MOVE_ID_CAP }, (_, i) => i + 1);
  const out: MoveI18n = {};
  let ok = 0;

  console.log(`Fetching moves 1..${MOVE_ID_CAP}…`);
  await runPool(ids, CONCURRENCY, async (id) => {
    const move = await fetchMove(id);
    if (!move) return;

    const enName =
      pickName(move.names, "en") ?? titleCaseSlug(move.name);
    const esName = pickName(move.names, "es") ?? enName;
    const ptName =
      pickName(move.names, "pt-BR") ??
      pickName(move.names, "pt") ??
      enName;

    const enEffect =
      pickFlavor(move.flavor_text_entries, "en") ??
      pickEffect(move.effect_entries, "en") ??
      "";
    const esEffect =
      pickFlavor(move.flavor_text_entries, "es") ??
      pickEffect(move.effect_entries, "es") ??
      enEffect;
    const ptEffect =
      pickFlavor(move.flavor_text_entries, "pt-BR") ??
      pickFlavor(move.flavor_text_entries, "pt") ??
      pickEffect(move.effect_entries, "pt-BR") ??
      esEffect;

    out[move.name] = {
      en: { name: enName, effect: enEffect },
      es: { name: esName, effect: esEffect },
      pt: { name: ptName, effect: ptEffect },
    };
    ok += 1;
    if (ok % 25 === 0) console.log(`  ${ok}…`);
  });

  const path = resolve("src/data/move-i18n.json");
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`Wrote ${ok} moves → ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
