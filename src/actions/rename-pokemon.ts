"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_NICKNAME_LENGTH = 20;

export async function setPokemonNickname(instanceId: string, nickname: string, locale: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  const instance = await prisma.pokemonInstance.findFirst({
    where: { id: instanceId, ownerId: session.user.id },
    select: { id: true },
  });
  if (!instance) return false;

  const trimmed = nickname.trim().slice(0, MAX_NICKNAME_LENGTH);

  await prisma.pokemonInstance.update({
    where: { id: instanceId },
    data: { nickname: trimmed.length > 0 ? trimmed : null },
  });

  revalidatePath(`/${locale}/team`);
  return true;
}
