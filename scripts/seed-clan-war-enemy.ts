/**
 * Crea el clan enemigo RIVALS con 10 bots + equipos, les da medallas para
 * nivel 5, registra ambos clanes en la temporada y fuerza el match.
 *
 * Uso: npx tsx scripts/seed-clan-war-enemy.ts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { CAMPAIGN_DEFAULTS } from "../src/lib/campaign";
import { DEFAULT_CLAN_EMBLEM, serializeClanEmblem } from "../src/lib/clan-emblem";
import { canonicalizeClanName, normalizeClanTag } from "../src/lib/clan-rules";
import { calculateMaxHp, unspentPointsForLevel, xpForLevel } from "../src/lib/stats";
import { getMovesetForLevel } from "../src/lib/moveset";
import {
  CLAN_WAR_BATTLE_SLOTS,
  CLAN_WAR_STARTING_RATING,
  buildWarBattleSlots,
  ensureClanWarSeason,
} from "../src/lib/clan-war";

const PASSWORD = "warriors1";
const LEVEL = 40;
const SPECIES_POOL = [6, 9, 3, 130, 143, 149, 65, 94, 131, 68]; // Charizard, Blastoise, Venusaur…

const ENEMY_ROSTER = [
  "RivalChief",
  "EnemyBot01",
  "EnemyBot02",
  "EnemyBot03",
  "EnemyBot04",
  "EnemyBot05",
  "EnemyBot06",
  "EnemyBot07",
  "EnemyBot08",
  "EnemyBot09",
];

async function ensureUser(username: string, email: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { username },
    create: {
      email,
      username,
      passwordHash,
      country: "BR",
      locale: "es",
      coins: 5000,
      energy: 40,
      energyMax: 40,
      campaignProgress: { create: { ...CAMPAIGN_DEFAULTS } },
    },
    update: { energy: 40, energyMax: 40 },
    select: { id: true, username: true },
  });
}

async function ensureTeam(userId: string, seed: number) {
  const existing = await prisma.pokemonInstance.count({
    where: { ownerId: userId, teamSlot: { not: null } },
  });
  if (existing >= 3) return;

  for (let slot = 1; slot <= 3; slot++) {
    const speciesId = SPECIES_POOL[(seed + slot) % SPECIES_POOL.length]!;
    const species = await prisma.species.findUnique({ where: { id: speciesId } });
    if (!species) continue;
    const moveIds = await getMovesetForLevel(speciesId, LEVEL);
    const moves = await prisma.move.findMany({ where: { id: { in: moveIds } } });
    const maxHp = calculateMaxHp(species.baseHp, LEVEL);
    await prisma.pokemonInstance.create({
      data: {
        ownerId: userId,
        speciesId,
        level: LEVEL,
        xp: xpForLevel(LEVEL),
        currentHp: maxHp,
        teamSlot: slot,
        unspentPoints: unspentPointsForLevel(LEVEL),
        moves: {
          create: moveIds.slice(0, 4).map((moveId, i) => {
            const m = moves.find((x) => x.id === moveId);
            return { moveId, slot: i + 1, currentPp: m?.pp ?? 20 };
          }),
        },
      },
    });
  }
}

async function ensureBadges(userId: string, need: number) {
  const have = await prisma.badge.count({ where: { userId } });
  if (have >= need) return;
  const owned = new Set(
    (await prisma.badge.findMany({ where: { userId }, select: { gymId: true } })).map(
      (b) => b.gymId,
    ),
  );
  const gyms = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Gym" ORDER BY id`;
  const missing = gyms.filter((g) => !owned.has(g.id)).slice(0, need - have);
  if (missing.length > 0) {
    await prisma.badge.createMany({
      data: missing.map((g) => ({ userId, gymId: g.id })),
      skipDuplicates: true,
    });
  }
  // Stubs si aún faltan
  let still = need - (await prisma.badge.count({ where: { userId } }));
  for (let i = 0; still > 0; i++, still--) {
    const id = `dev-rival-badge-gym-${randomUUID()}`;
    const order = 3000 + Math.floor(Math.random() * 500000) + i;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Gym" (id, "regionId", "order", name, "leaderName", "badgeName", type, "cooldownHours", "opensHour", "closesHour", "coinReward", "isElite")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 24, 0, 24, 0, true)
       ON CONFLICT (id) DO NOTHING`,
      id,
      "dev-rival",
      order,
      `Rival Stub ${i}`,
      "Rival",
      `Rival Badge ${i}`,
      "dark",
    );
    await prisma.badge.createMany({
      data: [{ userId, gymId: id }],
      skipDuplicates: true,
    });
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const users = [];
  for (let i = 0; i < ENEMY_ROSTER.length; i++) {
    const username = ENEMY_ROSTER[i]!;
    const u = await ensureUser(username, `enemy${i}@rivals.local`, passwordHash);
    users.push(u);
    await ensureTeam(u.id, i * 3);
  }

  const leader = users[0]!;
  // 20 badges en el clan → nivel 5 (todas en el leader alcanza).
  await ensureBadges(leader.id, 20);

  const name = "RIVALS";
  const tag = "RVL";
  let clan = await prisma.clan.findUnique({ where: { tag } });
  if (!clan) {
    // Si el leader ya lidera otro clan, abortar.
    const led = await prisma.clan.findUnique({ where: { leaderId: leader.id } });
    if (led) {
      clan = led;
    } else {
      clan = await prisma.clan.create({
        data: {
          name,
          normalizedName: canonicalizeClanName(name),
          tag,
          normalizedTag: normalizeClanTag(tag),
          leaderId: leader.id,
          description: "Clan enemigo de prueba para guerras.",
          motto: "No mercy",
          joinPolicy: "INVITE",
          focus: "PVP",
          affinity: "DARK",
          emblem: serializeClanEmblem(DEFAULT_CLAN_EMBLEM),
        },
      });
    }
  }

  for (const u of users) {
    await prisma.clanMember.upsert({
      where: { userId: u.id },
      create: {
        userId: u.id,
        clanId: clan.id,
        role: u.id === leader.id ? "LEADER" : "MEMBER",
      },
      update: {
        clanId: clan.id,
        role: u.id === leader.id ? "LEADER" : "MEMBER",
      },
    });
  }

  // También dale equipo a los WarBots de TESTERS (rivales de pelea).
  const testers = await prisma.clan.findUnique({ where: { tag: "TST" } });
  if (testers) {
    const mates = await prisma.clanMember.findMany({
      where: { clanId: testers.id },
      include: { user: { select: { id: true, username: true } } },
    });
    for (const [i, m] of mates.entries()) {
      await ensureTeam(m.userId, 50 + i);
    }
  }

  // Registrar ambos + match.
  const season = await ensureClanWarSeason(prisma);
  const rosterEnemy = users.map((u) => u.id);
  await prisma.clanWarRegistration.upsert({
    where: { seasonId_clanId: { seasonId: season.id, clanId: clan.id } },
    create: {
      seasonId: season.id,
      clanId: clan.id,
      rating: CLAN_WAR_STARTING_RATING,
      roster: rosterEnemy,
    },
    update: { roster: rosterEnemy },
  });

  if (testers) {
    const testerIds = (
      await prisma.clanMember.findMany({
        where: { clanId: testers.id },
        select: { userId: true },
      })
    ).map((m) => m.userId);
    await prisma.clanWarRegistration.upsert({
      where: { seasonId_clanId: { seasonId: season.id, clanId: testers.id } },
      create: {
        seasonId: season.id,
        clanId: testers.id,
        rating: CLAN_WAR_STARTING_RATING,
        roster: testerIds,
      },
      update: { roster: testerIds },
    });

    const existing = await prisma.clanWar.findFirst({
      where: {
        seasonId: season.id,
        status: { in: ["ACTIVE", "PENDING"] },
        OR: [
          { clanAId: testers.id, clanBId: clan.id },
          { clanAId: clan.id, clanBId: testers.id },
        ],
      },
    });
    if (!existing) {
      const [clanAId, clanBId] =
        testers.id < clan.id ? [testers.id, clan.id] : [clan.id, testers.id];
      await prisma.clanWar.create({
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
      console.log("war created", clanAId, "vs", clanBId);
    } else {
      console.log("war already active", existing.id);
    }
  }

  console.log({
    enemyClan: { id: clan.id, name: clan.name, tag: clan.tag },
    members: users.map((u) => u.username),
    password: PASSWORD,
    season: season.seasonKey,
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
