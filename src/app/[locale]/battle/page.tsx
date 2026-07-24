import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { getActiveGymRun } from "@/lib/battle-lock";
import { BattleScreen } from "@/components/battle-screen";
import type { BattleArenaProps, OpponentPartyMember } from "@/components/battle-arena";

export default async function BattlePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  // Si quedó más de una ACTIVE (carreras al explorar), cerramos las viejas
  // para que no “cambie” de batalla al refrescar.
  const activeBattles = await prisma.battleSession.findMany({
    where: { userId, status: "ACTIVE" },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });
  if (activeBattles.length > 1) {
    await prisma.battleSession.updateMany({
      where: { id: { in: activeBattles.slice(1).map((b) => b.id) }, status: "ACTIVE" },
      data: { status: "FLED" },
    });
  }

  const battle = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: {
      pokemonInstance: { include: { species: true, moves: { include: { move: true } } } },
      wildSpecies: true,
      gym: { select: { type: true, name: true, leaderName: true, badgeName: true } },
      gymTrainer: { select: { name: true } },
    },
  });

  let initialBattle: BattleArenaProps | null = null;
  let hasHealthyTeam = true;

  if (!battle) {
    // En un desafío de gym no se puede escapar al encuentro salvaje para curar.
    const gymRun = await getActiveGymRun(userId);
    if (gymRun) {
      redirect({ href: `/gyms/${gymRun.gymId}/run`, locale });
      return null;
    }

    const healthy = await prisma.pokemonInstance.findFirst({
      where: { ownerId: userId, teamSlot: { not: null }, currentHp: { gt: 0 } },
      select: { id: true },
    });
    hasHealthyTeam = healthy !== null;
  }

  if (battle) {
    const instance = battle.pokemonInstance;
    const playerMaxHp = calculateMaxHp(instance.species.baseHp, instance.level);
    const currentSlot = battle.gymPokemonSlot ?? 1;

    const [pokeballs, potions, partyRows, opponentTeam] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { userId, quantity: { gt: 0 }, item: { type: "POKEBALL" } },
        include: { item: true },
        orderBy: { item: { buyPrice: "asc" } },
      }),
      prisma.inventoryItem.findMany({
        where: { userId, quantity: { gt: 0 }, item: { type: "POTION" } },
        include: { item: true },
        orderBy: { item: { buyPrice: "asc" } },
      }),
      prisma.pokemonInstance.findMany({
        where: { ownerId: userId, teamSlot: { not: null } },
        include: { species: true },
        orderBy: { teamSlot: "asc" },
      }),
      battle.gymTrainerId
        ? prisma.gymTrainerPokemon.findMany({
            where: { gymTrainerId: battle.gymTrainerId },
            include: { species: true },
            orderBy: { slot: "asc" },
          })
        : battle.gymId
          ? prisma.gymPokemon.findMany({
              where: { gymId: battle.gymId },
              include: { species: true },
              orderBy: { slot: "asc" },
            })
          : Promise.resolve([]),
    ]);

    const opponentParty: OpponentPartyMember[] =
      opponentTeam.length > 0
        ? opponentTeam.map((m) => ({
            slot: m.slot,
            name: m.species.name,
            spriteUrl: m.species.spriteUrl,
            fainted: m.slot < currentSlot,
            active: m.slot === currentSlot,
          }))
        : [
            {
              slot: 1,
              name: battle.wildSpecies.name,
              spriteUrl: battle.wildSpecies.spriteUrl,
              fainted: false,
              active: true,
            },
          ];

    const opponentName = battle.gymTrainer?.name
      ?? battle.gym?.leaderName
      ?? null;

    initialBattle = {
      battleId: battle.id,
      locale,
      trainerName: session.user.name ?? "Trainer",
      opponentName,
      pokeballs: pokeballs.map((p) => ({
        itemId: p.itemId,
        name: p.item.name,
        quantity: p.quantity,
      })),
      potions: potions.map((p) => ({
        itemId: p.itemId,
        name: p.item.name,
        quantity: p.quantity,
        healAmount: p.item.healAmount ?? 0,
      })),
      party: partyRows.map((r) => ({
        instanceId: r.id,
        name: r.nickname ?? r.species.name,
        speciesName: r.species.name,
        level: r.level,
        spriteUrl: r.species.spriteUrl,
        currentHp: r.id === instance.id ? instance.currentHp : r.currentHp,
        maxHp: calculateMaxHp(r.species.baseHp, r.level),
      })),
      player: {
        instanceId: instance.id,
        name: instance.nickname ?? instance.species.name,
        speciesName: instance.species.name,
        level: instance.level,
        spriteUrl: instance.species.spriteUrl,
        currentHp: instance.currentHp,
        maxHp: playerMaxHp,
      },
      wild: {
        name: battle.wildSpecies.name,
        speciesName: battle.wildSpecies.name,
        level: battle.wildLevel,
        spriteUrl: battle.wildSpecies.spriteUrl,
        currentHp: battle.wildCurrentHp,
        maxHp: battle.wildMaxHp,
        types: battle.wildSpecies.types,
      },
      moves: instance.moves.map((m) => ({
        moveId: m.moveId,
        name: m.move.name,
        type: m.move.type,
        pp: m.currentPp <= 0 ? m.move.pp : Math.min(m.currentPp, m.move.pp),
        maxPp: m.move.pp,
      })),
      initialLog: battle.log,
      opponentParty,
      playerStatus: battle.playerStatus,
      wildStatus: battle.wildStatus,
      gymId: battle.gymId,
      gymRunId: battle.gymRunId,
      gymType: battle.gym?.type ?? null,
      gymName: battle.gym?.name ?? null,
      gymLeaderName: battle.gym?.leaderName ?? null,
      gymBadgeName: battle.gym?.badgeName ?? null,
    };
  }

  return <BattleScreen initialBattle={initialBattle} locale={locale} hasHealthyTeam={hasHealthyTeam} />;
}
