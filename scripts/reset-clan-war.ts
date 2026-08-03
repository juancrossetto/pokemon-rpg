import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  CLAN_WAR_BATTLE_SLOTS,
  CLAN_WAR_STARTING_RATING,
  buildWarBattleSlots,
  ensureClanWarSeason,
} from "../src/lib/clan-war";

async function main() {
  const season = await ensureClanWarSeason(prisma);
  const testers = await prisma.clan.findUnique({ where: { tag: "TST" } });
  const rivals = await prisma.clan.findUnique({ where: { tag: "RVL" } });
  if (!testers || !rivals) throw new Error("clans missing");

  await prisma.clanWar.updateMany({
    where: {
      seasonId: season.id,
      status: { in: ["ACTIVE", "PENDING"] },
      OR: [
        { clanAId: testers.id, clanBId: rivals.id },
        { clanAId: rivals.id, clanBId: testers.id },
      ],
    },
    data: { status: "CANCELLED", completedAt: new Date() },
  });

  const [clanAId, clanBId] =
    testers.id < rivals.id ? [testers.id, rivals.id] : [rivals.id, testers.id];

  const war = await prisma.clanWar.create({
    data: {
      seasonId: season.id,
      clanAId,
      clanBId,
      status: "ACTIVE",
      ratingABefore: CLAN_WAR_STARTING_RATING,
      ratingBBefore: CLAN_WAR_STARTING_RATING,
      battles: {
        create: buildWarBattleSlots(CLAN_WAR_BATTLE_SLOTS).map((slot) => ({ slot })),
      },
    },
  });
  console.log("fresh war", war.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
