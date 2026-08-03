/**
 * Dev helper: mete 9 cuentas fake en el clan de Crossetto para llegar a 10
 * miembros (requisito de guerra de clanes).
 *
 * Uso: npx tsx scripts/seed-clan-war-roster.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { CAMPAIGN_DEFAULTS } from "../src/lib/campaign";

const LEADER = "Crossetto";
const NEED = 9;
const PASSWORD = "warriors1";

const ROSTER = [
  "WarBotAlpha",
  "WarBotBravo",
  "WarBotCharlie",
  "WarBotDelta",
  "WarBotEcho",
  "WarBotFoxtrot",
  "WarBotGolf",
  "WarBotHotel",
  "WarBotIndia",
];

async function main() {
  const leader = await prisma.user.findFirst({
    where: { username: { equals: LEADER, mode: "insensitive" } },
    select: { id: true, username: true },
  });
  if (!leader) throw new Error(`${LEADER} not found`);

  const membership = await prisma.clanMember.findFirst({
    where: { userId: leader.id },
    include: { clan: { select: { id: true, name: true, tag: true } } },
  });
  if (!membership) throw new Error(`${LEADER} has no clan`);

  const clanId = membership.clanId;
  console.log("clan", membership.clan);

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  let joined = 0;

  for (const [i, username] of ROSTER.entries()) {
    const email = `warbot${i + 1}@testers.local`;
    const user = await prisma.user.upsert({
      where: { username },
      create: {
        email,
        username,
        passwordHash,
        country: "AR",
        locale: "es",
        coins: 1000,
        energy: 20,
        campaignProgress: { create: { ...CAMPAIGN_DEFAULTS } },
      },
      update: {},
      select: { id: true, username: true },
    });

    // Si ya está en otro clan, lo movemos (dev only).
    await prisma.clanMember.upsert({
      where: { userId: user.id },
      create: { userId: user.id, clanId, role: "MEMBER" },
      update: { clanId, role: "MEMBER" },
    });
    joined += 1;
    console.log("joined", user.username);
  }

  const count = await prisma.clanMember.count({ where: { clanId } });
  const badgeRows = await prisma.badge.groupBy({
    by: ["userId"],
    where: {
      userId: {
        in: (
          await prisma.clanMember.findMany({
            where: { clanId },
            select: { userId: true },
          })
        ).map((m) => m.userId),
      },
    },
    _count: true,
  });
  const totalBadges = badgeRows.reduce((s, b) => s + b._count, 0);
  const level = Math.max(1, Math.floor(totalBadges / 5) + 1);

  console.log({
    joined,
    members: count,
    totalBadges,
    level,
    password: PASSWORD,
    note: "login con username WarBotAlpha… password warriors1",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
