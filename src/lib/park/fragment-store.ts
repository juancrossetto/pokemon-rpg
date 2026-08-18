/**
 * Persistencia de fragmentos de especie (pesca / mina).
 *
 * La bolsa JSON de `ParkMine.bag` era el almacén anterior de fósiles. Si un
 * hallazgo quedó ahí y no en `SpeciesFragment`, la mina lo muestra y la
 * mochila no: hay que absorberlo antes de leer el inventario.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { addTowardAssemble, FRAGMENTS_TO_ASSEMBLE } from "@/lib/park/fragments";
import { FOSSIL_KINDS, FOSSIL_SPECIES, parseMineBag, type MineBag } from "@/lib/park/mine";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function creditFragments(
  tx: Prisma.TransactionClient,
  userId: string,
  speciesId: number,
  gained: number,
  assemble: boolean,
): Promise<{ quantity: number; assembled: number }> {
  const row = await tx.speciesFragment.findUnique({
    where: { userId_speciesId: { userId, speciesId } },
  });
  const next = addTowardAssemble(row?.quantity ?? 0, gained, FRAGMENTS_TO_ASSEMBLE, assemble);
  await tx.speciesFragment.upsert({
    where: { userId_speciesId: { userId, speciesId } },
    create: { userId, speciesId, quantity: next.quantity },
    update: { quantity: next.quantity },
  });
  return next;
}

export async function absorbLegacyFossilBag(
  tx: Prisma.TransactionClient,
  userId: string,
  bag: MineBag,
): Promise<MineBag> {
  const next = { ...bag };
  for (const kind of FOSSIL_KINDS) {
    if (next[kind] <= 0) continue;
    await creditFragments(tx, userId, FOSSIL_SPECIES[kind], next[kind], false);
    next[kind] = 0;
  }
  return next;
}

/**
 * Pasa fósiles de `ParkMine.bag` a `SpeciesFragment` si todavía quedaban.
 * Se llama al abrir parque o inventario: no espera a que el jugador pique.
 */
export async function migrateLegacyFossilsIfNeeded(userId: string): Promise<void> {
  const mine = await prisma.parkMine.findUnique({
    where: { userId },
    select: { bag: true },
  });
  if (!mine) return;
  const bag = parseMineBag(mine.bag);
  if (FOSSIL_KINDS.every((kind) => bag[kind] <= 0)) return;

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);
    const locked = await tx.parkMine.findUnique({
      where: { userId },
      select: { bag: true },
    });
    if (!locked) return;
    const next = await absorbLegacyFossilBag(tx, userId, parseMineBag(locked.bag));
    await tx.parkMine.update({
      where: { userId },
      data: { bag: json(next) },
    });
  });
}
