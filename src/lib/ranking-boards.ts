import { prisma } from "@/lib/prisma";
import {
  compareCombatPower,
  comparePvpRating,
  isPvpRankingEligible,
  teamPower,
  winRate,
  type RankingEntry,
  type RankingFeaturedCreature,
} from "@/lib/ranking";

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
