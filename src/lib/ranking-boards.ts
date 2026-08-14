import { prisma } from "@/lib/prisma";
import {
  compareCombatPower,
  comparePvpRating,
  isPvpRankingEligible,
  teamPower,
  winRate,
  type RankingEntry,
  type RankingFeaturedCreature,
  type RankedSeasonBoardData,
  type RankedSeasonChampion,
  type RankedSeasonEntry,
  type RankingTeamSprite,
} from "@/lib/ranking";
import { currentSeasonKey } from "@/lib/pvp/seasons";
import { rankForRating, tierForRating } from "@/lib/pvp/tiers";

const SPECIES_STATS_SELECT = {
  baseHp: true,
  baseAttack: true,
  baseDefense: true,
  baseSpAtk: true,
  baseSpDef: true,
  baseSpeed: true,
} as const;

const MAIN_POKEMON_INCLUDE = {
  where: {
    OR: [{ isFavorite: true }, { teamSlot: { not: null } }],
  },
  orderBy: [{ isFavorite: "desc" as const }, { teamSlot: "asc" as const }],
  take: 1,
  select: {
    isShiny: true,
    isFavorite: true,
    species: { select: { name: true, spriteUrl: true } },
  },
};

function toFeatured(
  row:
    | {
        isShiny: boolean;
        species: { name: string; spriteUrl: string };
      }
    | null
    | undefined,
): RankingFeaturedCreature | null {
  if (!row) return null;
  return {
    name: row.species.name,
    image: row.species.spriteUrl,
    isShiny: row.isShiny,
  };
}

function pickMainFromTeam(
  team: Array<{
    teamSlot: number | null;
    isFavorite?: boolean;
    isShiny: boolean;
    species: { name: string; spriteUrl: string };
  }>,
): RankingFeaturedCreature | null {
  const favorite = team.find((p) => p.isFavorite);
  if (favorite) return toFeatured(favorite);
  const lead = team
    .filter((p) => p.teamSlot != null)
    .sort((a, b) => (a.teamSlot ?? 99) - (b.teamSlot ?? 99))[0];
  return toFeatured(lead);
}

function pickTeamSprites(
  team: Array<{
    teamSlot: number | null;
    isShiny: boolean;
    species: { name: string; spriteUrl: string };
  }>,
): RankingTeamSprite[] {
  return team
    .filter((p) => p.teamSlot != null)
    .sort((a, b) => (a.teamSlot ?? 99) - (b.teamSlot ?? 99))
    .slice(0, 5)
    .map((p) => ({
      name: p.species.name,
      image: p.species.spriteUrl,
      isShiny: p.isShiny,
    }));
}

function withPositions(
  rows: Omit<RankingEntry, "position" | "isCurrentPlayer">[],
  userId: string | null,
): RankingEntry[] {
  return rows.map((row, i) => ({
    ...row,
    position: i + 1,
    isCurrentPlayer: !!userId && row.playerId === userId,
  }));
}

/** Ranking por poder de combate del equipo activo. */
export async function loadCombatPowerBoard(
  country: string,
  userId: string | null,
): Promise<RankingEntry[]> {
  const users = await prisma.user.findMany({
    where: country ? { country } : undefined,
    select: {
      id: true,
      username: true,
      country: true,
      avatarId: true,
      createdAt: true,
      _count: { select: { badges: true } },
      pokemon: {
        where: {
          OR: [{ teamSlot: { not: null } }, { isFavorite: true }],
        },
        select: {
          teamSlot: true,
          isFavorite: true,
          level: true,
          isShiny: true,
          ptStrength: true,
          ptDexterity: true,
          ptIntelligence: true,
          ptSpeed: true,
          ptConstitution: true,
          species: { select: { ...SPECIES_STATS_SELECT, name: true, spriteUrl: true } },
        },
      },
    },
  });

  const ranked = users
    .map((u) => {
      const team = u.pokemon.filter((p) => p.teamSlot != null);
      return {
        playerId: u.id,
        playerName: u.username,
        countryCode: u.country,
        avatarId: u.avatarId,
        createdAt: u.createdAt,
        medals: u._count.badges,
        combatPower: teamPower(team),
        featuredCreature: pickMainFromTeam(u.pokemon),
        teamSprites: pickTeamSprites(team),
      };
    })
    .sort((a, b) =>
      compareCombatPower(
        {
          id: a.playerId,
          combatPower: a.combatPower,
          medals: a.medals,
          createdAt: a.createdAt,
        },
        {
          id: b.playerId,
          combatPower: b.combatPower,
          medals: b.medals,
          createdAt: b.createdAt,
        },
      ),
    );

  return withPositions(ranked, userId);
}

/**
 * Ranking PvP por Elo. Solo jugadores con ≥ PVP_MIN_MATCHES partidas.
 */
export async function loadPvpBoard(
  country: string,
  userId: string | null,
): Promise<RankingEntry[]> {
  const users = await prisma.user.findMany({
    where: {
      ...(country ? { country } : {}),
      OR: [{ pvpWins: { gt: 0 } }, { pvpLosses: { gt: 0 } }],
    },
    select: {
      id: true,
      username: true,
      country: true,
      avatarId: true,
      pvpRating: true,
      pvpWins: true,
      pvpLosses: true,
      createdAt: true,
      pokemon: MAIN_POKEMON_INCLUDE,
    },
  });

  const ranked = users
    .filter((u) => isPvpRankingEligible(u.pvpWins, u.pvpLosses))
    .map((u) => {
      const wins = u.pvpWins;
      const losses = u.pvpLosses;
      return {
        playerId: u.id,
        playerName: u.username,
        countryCode: u.country,
        avatarId: u.avatarId,
        createdAt: u.createdAt,
        rating: u.pvpRating,
        wins,
        losses,
        winRate: winRate(wins, losses),
        matchesPlayed: wins + losses,
        featuredCreature: toFeatured(u.pokemon[0]),
      };
    })
    .sort((a, b) =>
      comparePvpRating(
        {
          id: a.playerId,
          rating: a.rating,
          wins: a.wins,
          losses: a.losses,
          createdAt: a.createdAt,
        },
        {
          id: b.playerId,
          rating: b.rating,
          wins: b.wins,
          losses: b.losses,
          createdAt: b.createdAt,
        },
      ),
    );

  return withPositions(ranked, userId);
}

/**
 * Ladder clasificatorio de la temporada vigente.
 *
 * El récord se deriva de partidos RANKED cerrados. Los contadores generales
 * del usuario también incluyen combates rápidos, por lo que no sirven para
 * representar una clasificación estacional real.
 */
export async function loadRankedSeasonBoard(
  userId: string | null,
): Promise<RankedSeasonBoardData> {
  const seasonKey = currentSeasonKey();
  const [matches, snapshots, historicalSeasonRows] = await Promise.all([
    prisma.pvpMatch.findMany({
      where: {
        seasonKey,
        mode: "RANKED",
        status: { in: ["COMPLETED", "FORFEIT"] },
      },
      select: { challengerId: true, opponentId: true, winnerId: true },
    }),
    prisma.pvpSeasonStats.findMany({
      where: { seasonKey },
      select: {
        rating: true,
        createdAt: true,
        user: {
          select: { id: true, username: true, country: true, avatarId: true },
        },
      },
    }),
    prisma.pvpMatch.findMany({
      where: {
        seasonKey: { not: null, notIn: [seasonKey] },
        mode: "RANKED",
        status: { in: ["COMPLETED", "FORFEIT"] },
      },
      distinct: ["seasonKey"],
      orderBy: { seasonKey: "desc" },
      take: 6,
      select: { seasonKey: true },
    }),
  ]);

  const records = new Map<string, { wins: number; losses: number }>();
  const recordFor = (id: string) => {
    const existing = records.get(id);
    if (existing) return existing;
    const created = { wins: 0, losses: 0 };
    records.set(id, created);
    return created;
  };

  for (const match of matches) {
    const challenger = recordFor(match.challengerId);
    const opponent = recordFor(match.opponentId);
    if (match.winnerId === match.challengerId) {
      challenger.wins += 1;
      opponent.losses += 1;
    } else if (match.winnerId === match.opponentId) {
      opponent.wins += 1;
      challenger.losses += 1;
    }
  }

  const ranked = snapshots
    .filter((snapshot) => records.has(snapshot.user.id))
    .map((snapshot) => ({
      snapshot,
      record: records.get(snapshot.user.id) ?? { wins: 0, losses: 0 },
    }))
    .sort((a, b) => {
      if (a.snapshot.rating !== b.snapshot.rating) return b.snapshot.rating - a.snapshot.rating;
      if (a.record.wins !== b.record.wins) return b.record.wins - a.record.wins;
      const byDate = a.snapshot.createdAt.getTime() - b.snapshot.createdAt.getTime();
      if (byDate !== 0) return byDate;
      return a.snapshot.user.id.localeCompare(b.snapshot.user.id);
    });

  const entries: RankedSeasonEntry[] = ranked.map(({ snapshot, record }, index) => {
    const standing = rankForRating(snapshot.rating);
    return {
      playerId: snapshot.user.id,
      playerName: snapshot.user.username,
      countryCode: snapshot.user.country,
      avatarId: snapshot.user.avatarId,
      position: index + 1,
      rating: snapshot.rating,
      wins: record.wins,
      losses: record.losses,
      winRate: winRate(record.wins, record.losses),
      tier: standing.tier,
      division: standing.division,
      isCurrentPlayer: snapshot.user.id === userId,
    };
  });

  const champions = (
    await Promise.all(
      historicalSeasonRows
        .map((row) => row.seasonKey)
        .filter((key): key is string => Boolean(key))
        .map(async (historicalSeasonKey): Promise<RankedSeasonChampion | null> => {
          const champion = await prisma.pvpSeasonStats.findFirst({
            where: { seasonKey: historicalSeasonKey },
            orderBy: [{ rating: "desc" }, { wins: "desc" }, { createdAt: "asc" }],
            select: {
              rating: true,
              user: {
                select: { id: true, username: true, country: true, avatarId: true },
              },
            },
          });
          if (!champion) return null;
          return {
            seasonKey: historicalSeasonKey,
            playerId: champion.user.id,
            playerName: champion.user.username,
            countryCode: champion.user.country,
            avatarId: champion.user.avatarId,
            rating: champion.rating,
            tier: tierForRating(champion.rating),
          };
        }),
    )
  ).filter((champion): champion is RankedSeasonChampion => champion !== null);

  return {
    seasonKey,
    entries,
    currentPlayer: entries.find((entry) => entry.isCurrentPlayer) ?? null,
    champions,
  };
}

/** Códigos ISO de países que tienen al menos un perfil. */
export async function listActiveRankingCountryCodes(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    distinct: ["country"],
    select: { country: true },
    orderBy: { country: "asc" },
  });
  return rows
    .map((r) => r.country?.trim().toUpperCase())
    .filter((c): c is string => Boolean(c) && c.length === 2);
}
