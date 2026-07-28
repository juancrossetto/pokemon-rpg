"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { blockIfInCombat } from "@/lib/battle-lock";
import { calculateMaxHp, unspentPointsForLevel, xpForLevel } from "@/lib/stats";
import { getMovesetForLevel } from "@/lib/moveset";
import { rollShiny } from "@/lib/shiny";
import { TEAM_SIZE } from "@/lib/market-rules";
import {
  BREEDING_COST,
  BREEDING_MIN_LEVEL,
  HATCH_LEVEL,
  hatchReadyAt,
  inheritPoints,
} from "@/lib/breeding";

export type BreedError =
  | "unauthorized"
  | "same_parent"
  | "not_found"
  | "in_team"
  | "listed"
  | "too_young"
  | "no_coins"
  | "not_ready"
  | "busy_parents"
  | "team_full";

export async function breedPair(
  locale: string,
  parentAId: string,
  parentBId: string,
): Promise<{ ok: true } | { ok: false; error: BreedError }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;
  if (await blockIfInCombat(userId, locale)) return { ok: false, error: "unauthorized" };
  if (parentAId === parentBId) return { ok: false, error: "same_parent" };

  let failure: BreedError | null = null;

  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, userId);

    const parents = await tx.pokemonInstance.findMany({
      where: { id: { in: [parentAId, parentBId] }, ownerId: userId },
      include: { listings: { where: { status: "ACTIVE" }, select: { id: true } } },
    });
    if (parents.length !== 2) return void (failure = "not_found");
    // En la PC, no en el equipo: criar cuesta sacarlos de circulación.
    if (parents.some((p) => p.teamSlot !== null)) return void (failure = "in_team");
    if (parents.some((p) => p.listings.length > 0)) return void (failure = "listed");
    if (parents.some((p) => p.level < BREEDING_MIN_LEVEL)) return void (failure = "too_young");

    // Ya están incubando otro huevo: la misma pareja no produce en serie.
    const busyEggs = await tx.egg.findMany({
      where: {
        ownerId: userId,
        hatchedAt: null,
        OR: [
          { parentAId: { in: [parentAId, parentBId] } },
          { parentBId: { in: [parentAId, parentBId] } },
        ],
      },
      select: { id: true },
    });
    if (busyEggs.length > 0) return void (failure = "busy_parents");

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { coins: true },
    });
    if (user.coins < BREEDING_COST) return void (failure = "no_coins");

    const [a, b] = parents;
    const points = inheritPoints(a, b);

    await tx.user.update({
      where: { id: userId },
      data: { coins: { decrement: BREEDING_COST } },
    });

    await tx.egg.create({
      data: {
        ownerId: userId,
        speciesId: a.speciesId,
        parentAId: a.id,
        parentBId: b.id,
        ...points,
        // Se tira de nuevo: criar no es una fábrica de variocolor.
        isShiny: rollShiny(),
        readyAt: hatchReadyAt(),
      },
    });
  });

  if (failure) return { ok: false, error: failure };

  revalidatePath(`/${locale}/pc`);
  return { ok: true };
}

export async function hatchEgg(
  locale: string,
  eggId: string,
): Promise<{ ok: true } | { ok: false; error: BreedError }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const egg = await prisma.egg.findFirst({
    where: { id: eggId, ownerId: userId, hatchedAt: null },
    include: { species: true },
  });
  if (!egg) return { ok: false, error: "not_found" };
  if (egg.readyAt.getTime() > Date.now()) return { ok: false, error: "not_ready" };

  const moveIds = await getMovesetForLevel(egg.speciesId, HATCH_LEVEL);
  const moves = await prisma.move.findMany({ where: { id: { in: moveIds } } });
  const maxHp = calculateMaxHp(egg.species.baseHp, HATCH_LEVEL, egg.ptConstitution);

  // La cría nace en la PC salvo que haya lugar en el equipo.
  const teamCount = await prisma.pokemonInstance.count({
    where: { ownerId: userId, teamSlot: { not: null } },
  });
  const openSlot = teamCount < TEAM_SIZE ? teamCount + 1 : null;

  await prisma.$transaction([
    prisma.pokemonInstance.create({
      data: {
        ownerId: userId,
        speciesId: egg.speciesId,
        level: HATCH_LEVEL,
        xp: xpForLevel(HATCH_LEVEL),
        currentHp: maxHp,
        teamSlot: openSlot,
        isShiny: egg.isShiny,
        ptStrength: egg.ptStrength,
        ptSpeed: egg.ptSpeed,
        ptDexterity: egg.ptDexterity,
        ptIntelligence: egg.ptIntelligence,
        ptConstitution: egg.ptConstitution,
        // Herencia ya viene en pt*; el unspent es el pool de 1→HATCH_LEVEL.
        unspentPoints: unspentPointsForLevel(HATCH_LEVEL),
        moves: {
          create: moveIds.map((moveId, i) => ({
            moveId,
            slot: i + 1,
            currentPp: moves.find((m) => m.id === moveId)?.pp ?? 20,
          })),
        },
      },
    }),
    prisma.egg.update({ where: { id: egg.id }, data: { hatchedAt: new Date() } }),
  ]);

  revalidatePath(`/${locale}/pc`);
  revalidatePath(`/${locale}/team`);
  return { ok: true };
}
