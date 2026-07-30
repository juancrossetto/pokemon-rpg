/**
 * Rellena Move.target desde PokeAPI sin reseed completo.
 * Uso: npx tsx scripts/sync-move-targets.ts
 */
import { prisma } from "../src/lib/prisma";

type PokeMove = { id: number; target: { name: string } };

async function fetchMove(id: number): Promise<PokeMove> {
  const res = await fetch(`https://pokeapi.co/api/v2/move/${id}`);
  if (!res.ok) throw new Error(`move ${id}: ${res.status}`);
  return res.json() as Promise<PokeMove>;
}

async function main() {
  const moves = await prisma.move.findMany({ select: { id: true, name: true } });
  console.log(`Syncing target for ${moves.length} moves…`);
  let ok = 0;
  for (const m of moves) {
    try {
      const api = await fetchMove(m.id);
      await prisma.move.update({
        where: { id: m.id },
        data: { target: api.target?.name ?? "selected-pokemon" },
      });
      ok++;
      if (ok % 25 === 0) console.log(`  ${ok}/${moves.length}`);
      await new Promise((r) => setTimeout(r, 40));
    } catch (e) {
      console.warn(`skip ${m.name} (${m.id})`, e);
    }
  }
  console.log(`Done: ${ok}/${moves.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
