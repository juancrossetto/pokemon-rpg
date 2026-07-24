import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { BattleScreen } from "@/components/battle-screen";
import type { BattleArenaProps } from "@/components/battle-arena";

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

  const battle = await prisma.battleSession.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      pokemonInstance: { include: { species: true, moves: { include: { move: true } } } },
      wildSpecies: true,
      gym: { select: { type: true, name: true, leaderName: true, badgeName: true } },
    },
  });

  let initialBattle: BattleArenaProps | null = null;
  let hasHealthyTeam = true;

  if (!battle) {
    const healthy = await prisma.pokemonInstance.findFirst({
      where: { ownerId: userId, teamSlot: { not: null }, currentHp: { gt: 0 } },
      select: { id: true },
    });
    hasHealthyTeam = healthy !== null;
  }

  if (battle) {
    const instance = battle.pokemonInstance;
    const playerMaxHp = calculateMaxHp(instance.species.baseHp, instance.level);

    const [pokeballs, potions, roster] = await Promise.all([
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
        where: { ownerId: userId, teamSlot: { not: null }, id: { not: instance.id } },
        include: { species: true },
        orderBy: { teamSlot: "asc" },
      }),
    ]);

    initialBattle = {
      battleId: battle.id,
      locale,
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
      roster: roster.map((r) => ({
        instanceId: r.id,
        name: r.nickname ?? r.species.name,
        level: r.level,
        spriteUrl: r.species.spriteUrl,
        currentHp: r.currentHp,
        maxHp: calculateMaxHp(r.species.baseHp, r.level),
      })),
      player: {
        instanceId: instance.id,
        name: instance.nickname ?? instance.species.name,
        level: instance.level,
        spriteUrl: instance.species.spriteUrl,
        currentHp: instance.currentHp,
        maxHp: playerMaxHp,
      },
      wild: {
        name: battle.wildSpecies.name,
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
        pp: m.move.pp,
      })),
      initialLog: battle.log,
      gymId: battle.gymId,
      gymType: battle.gym?.type ?? null,
      gymName: battle.gym?.name ?? null,
      gymLeaderName: battle.gym?.leaderName ?? null,
      gymBadgeName: battle.gym?.badgeName ?? null,
    };
  }

  return <BattleScreen initialBattle={initialBattle} locale={locale} hasHealthyTeam={hasHealthyTeam} />;
}
