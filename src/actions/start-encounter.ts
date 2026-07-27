"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { getMovesetForLevel } from "@/lib/moveset";
import { getCurrentEnergy } from "@/lib/energy";
import { getActiveGymRun, revalidateCombatUi } from "@/lib/battle-lock";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import { getKantoStage, resolveSpawn } from "@/lib/campaign";
import { rollShiny } from "@/lib/shiny";
import { recordSeenSpecies } from "@/lib/zone-progress";
import { pickEventItemName, rollExplorationEvent } from "@/lib/campaign/events";
import { markSpeciesSeen } from "@/lib/pokedex-seen";

const FALLBACK_ENERGY_COST = 1;

export type StartEncounterResult =
  | { success: true }
  | { success: false; error: "no_lead" | "fainted_lead" | "no_energy" | "no_stage" };

export async function startEncounter(locale: string): Promise<StartEncounterResult | void> {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  const existing = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    revalidatePath(`/${locale}/battle`);
    redirect({ href: "/battle", locale });
    return;
  }

  const gymRun = await getActiveGymRun(userId);
  if (gymRun) {
    redirect({ href: `/gyms/${gymRun.gymId}/run`, locale });
    return;
  }

  const progress = await ensureCampaignProgress(userId);
  const stage = getKantoStage(progress.farmingStageId);
  if (!stage) return { success: false, error: "no_stage" };

  const energyCost = stage.energyCost ?? FALLBACK_ENERGY_COST;

  const [user, lead] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    // Primer Pokémon del equipo con HP > 0 (por slot). Si el lead está KO
    // pero hay backups sanos, igual se puede explorar.
    prisma.pokemonInstance.findFirst({
      where: { ownerId: userId, teamSlot: { not: null }, currentHp: { gt: 0 } },
      include: { species: true },
      orderBy: { teamSlot: "asc" },
    }),
  ]);

  if (!lead) {
    const anyInTeam = await prisma.pokemonInstance.findFirst({
      where: { ownerId: userId, teamSlot: { not: null } },
      select: { id: true },
    });
    return { success: false, error: anyInTeam ? "fainted_lead" : "no_lead" };
  }

  const currentEnergy = getCurrentEnergy(user.energy, user.energyMax, user.energyUpdatedAt);
  if (currentEnergy < energyCost) return { success: false, error: "no_energy" };

  const { speciesId: wildSpeciesId, level: baseLevel } = resolveSpawn(stage);
  // Evento de exploración: expectativa por tirada, sin contenido nuevo.
  const event = rollExplorationEvent();
  const wildLevel = event.kind === "alpha" ? baseLevel + event.levelBonus : baseLevel;
  const wildSpecies = await prisma.species.findUniqueOrThrow({ where: { id: wildSpeciesId } });
  const wildMaxHp = calculateMaxHp(wildSpecies.baseHp, wildLevel);
  const wildMoveIds = await getMovesetForLevel(wildSpeciesId, wildLevel);
  const wildMoves = await prisma.move.findMany({ where: { id: { in: wildMoveIds } } });
  const wildMovePp = wildMoveIds.map((id) => wildMoves.find((m) => m.id === id)?.pp ?? 20);
  // 1/4096, igual que el juego oficial (ver dossier).
  const wildIsShiny = rollShiny();
  // Descubrimiento progresivo: la Pokédex de la zona revela lo que ya cruzaste.
  await recordSeenSpecies(userId, progress.farmingLocationId, wildSpeciesId);

  const foundItem =
    event.kind === "item"
      ? await prisma.item.findFirst({ where: { name: pickEventItemName() } })
      : null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { energy: currentEnergy - energyCost, energyUpdatedAt: new Date() },
    }),
    ...(foundItem
      ? [
          prisma.inventoryItem.upsert({
            where: { userId_itemId: { userId, itemId: foundItem.id } },
            create: { userId, itemId: foundItem.id, quantity: 1 },
            update: { quantity: { increment: 1 } },
          }),
        ]
      : []),
    prisma.battleSession.create({
      data: {
        userId,
        pokemonInstanceId: lead.id,
        wildSpeciesId,
        wildLevel,
        wildCurrentHp: wildMaxHp,
        wildMaxHp,
        wildMoveIds,
        wildMovePp,
        wildIsShiny,
        log: [
          ...(event.kind === "alpha" ? ["alpha"] : []),
          `appear:${wildSpecies.name}`,
        ],
        participantIds: [lead.id],
      },
    }),
  ]);

  await markSpeciesSeen(userId, wildSpeciesId);

  // No revalidar /pokedex acá: redirige a batalla y el combat-lock saca al jugador
  // de otras rutas; la Dex se actualiza al volver. Revalidarla dispara RSC de Dex
  // en medio de la transición y con Turbopack stale suele romper el client.
  revalidatePath(`/${locale}/battle`);
  revalidateCombatUi(locale);
  redirect({ href: "/battle", locale });
}
