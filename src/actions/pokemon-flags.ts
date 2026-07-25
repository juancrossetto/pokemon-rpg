"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function ownedPokemon(instanceId: string, userId: string) {
  return prisma.pokemonInstance.findFirst({
    where: { id: instanceId, ownerId: userId },
    select: { id: true, isFavorite: true, isTradeLocked: true },
  });
}

function revalidateSquad(locale: string) {
  // Evitar `layout`: fuerza a re-renderizar home (muy pesado) en cada flag.
  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/pc`);
  revalidatePath(`/${locale}/market`);
  revalidatePath(`/${locale}/ranking`);
  revalidatePath(`/${locale}`);
}

/** Un solo favorito por entrenador: al marcar uno, se limpia el anterior. */
export async function togglePokemonFavorite(
  instanceId: string,
  locale: string,
): Promise<{ ok: true; isFavorite: boolean } | { ok: false }> {
  const session = await auth();
  if (!session?.user) return { ok: false };

  const userId = session.user.id;
  const instance = await ownedPokemon(instanceId, userId);
  if (!instance) return { ok: false };

  const next = !instance.isFavorite;

  await prisma.$transaction(async (tx) => {
    if (next) {
      await tx.pokemonInstance.updateMany({
        where: { ownerId: userId, isFavorite: true },
        data: { isFavorite: false },
      });
    }
    await tx.pokemonInstance.update({
      where: { id: instance.id },
      data: { isFavorite: next },
    });
  });

  revalidateSquad(locale);
  return { ok: true, isFavorite: next };
}

export async function togglePokemonTradeLock(
  instanceId: string,
  locale: string,
): Promise<{ ok: true; isTradeLocked: boolean } | { ok: false }> {
  const session = await auth();
  if (!session?.user) return { ok: false };

  const instance = await ownedPokemon(instanceId, session.user.id);
  if (!instance) return { ok: false };

  const next = !instance.isTradeLocked;
  await prisma.pokemonInstance.update({
    where: { id: instance.id },
    data: { isTradeLocked: next },
  });

  revalidateSquad(locale);
  return { ok: true, isTradeLocked: next };
}
