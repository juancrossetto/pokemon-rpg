import { calculateMaxHp, calculateStat } from "@/lib/stats";
import type { PvpDivision, PvpTier } from "@/lib/pvp/tiers";

// Ranking: PC (poder de combate del equipo activo), PvP (Elo) y Clasificatoria
// (próximamente). El PC usa las mismas fórmulas de combate que stats.ts.

export type RankingCategory = "combat_power" | "pvp" | "ranked";
export type RankingScope = "global" | "country" | "friends";

export type PowerInput = {
  level: number;
  ptStrength: number;
  ptDexterity: number;
  ptIntelligence: number;
  ptSpeed: number;
  ptConstitution: number;
  species: {
    baseHp: number;
    baseAttack: number;
    baseDefense: number;
    baseSpAtk: number;
    baseSpDef: number;
    baseSpeed: number;
  };
};

export type RankingFeaturedCreature = {
  id?: string;
  name: string;
  image: string;
  isShiny?: boolean;
};

/** Sprite compacto del equipo activo (fila bajo el nombre en Combat Power). */
export type RankingTeamSprite = {
  name: string;
  image: string;
  isShiny?: boolean;
  /** Para el tooltip del equipo: el sprite solo no dice qué tan fuerte es. */
  level: number;
};

export type RankingEntry = {
  playerId: string;
  playerName: string;
  countryCode?: string;
  avatarId?: string | null;
  position: number;
  featuredCreature?: RankingFeaturedCreature | null;
  /** Equipo activo ordenado por slot — Combat Power. */
  teamSprites?: RankingTeamSprite[];
  combatPower?: number;
  medals?: number;
  wins?: number;
  losses?: number;
  winRate?: number;
  matchesPlayed?: number;
  rating?: number;
  isCurrentPlayer?: boolean;
  createdAt?: Date;
};

export type RankedSeasonEntry = {
  playerId: string;
  playerName: string;
  countryCode?: string;
  avatarId?: string | null;
  position: number;
  rating: number;
  wins: number;
  losses: number;
  winRate: number;
  tier: PvpTier;
  division: PvpDivision;
  isCurrentPlayer: boolean;
};

export type RankedSeasonChampion = {
  seasonKey: string;
  playerId: string;
  playerName: string;
  countryCode?: string;
  avatarId?: string | null;
  rating: number;
  tier: PvpTier;
};

export type RankedSeasonBoardData = {
  seasonKey: string;
  entries: RankedSeasonEntry[];
  currentPlayer: RankedSeasonEntry | null;
  champions: RankedSeasonChampion[];
};

export const RANKING_CATEGORIES: RankingCategory[] = ["combat_power", "pvp", "ranked"];

/** Mínimo de partidas PvP para aparecer en el ladder (Elo). */
export const PVP_MIN_MATCHES = 5;

export const RANKING_PAGE_SIZE = 20;

export function pokemonPower(p: PowerInput): number {
  const s = p.species;
  return (
    calculateMaxHp(s.baseHp, p.level, p.ptConstitution) +
    calculateStat(s.baseAttack, p.ptStrength, p.level) +
    calculateStat(s.baseDefense, p.ptDexterity, p.level) +
    calculateStat(s.baseSpAtk, p.ptIntelligence, p.level) +
    calculateStat(s.baseSpDef, p.ptIntelligence, p.level) +
    calculateStat(s.baseSpeed, p.ptSpeed, p.level)
  );
}

/**
 * Poder de combate (PC) = suma del poder del equipo activo (máx. 6).
 */
export function teamPower(team: PowerInput[]): number {
  return team.reduce((total, p) => total + pokemonPower(p), 0);
}

export type TrainerRankFields = {
  badges: number;
  power: number;
  createdAt: Date;
};

/**
 * Orden legacy (clanes): medallas → poder → antigüedad.
 * El ranking de jugadores usa `compareCombatPower` (PC primero).
 */
export function compareTrainers(a: TrainerRankFields, b: TrainerRankFields): number {
  if (a.badges !== b.badges) return b.badges - a.badges;
  if (a.power !== b.power) return b.power - a.power;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export type CombatPowerRankFields = {
  id: string;
  combatPower: number;
  medals: number;
  createdAt: Date;
};

/** Ranking PC: mayor PC → más medallas → cuenta más antigua → id estable. */
export function compareCombatPower(
  a: CombatPowerRankFields,
  b: CombatPowerRankFields,
): number {
  if (a.combatPower !== b.combatPower) return b.combatPower - a.combatPower;
  if (a.medals !== b.medals) return b.medals - a.medals;
  const byDate = a.createdAt.getTime() - b.createdAt.getTime();
  if (byDate !== 0) return byDate;
  return a.id.localeCompare(b.id);
}

export type CollectorRankFields = {
  owned: number;
  shinies: number;
  createdAt: Date;
};

/** Collectors (legacy / otros usos): especies → shinies → antigüedad. */
export function compareCollectors(a: CollectorRankFields, b: CollectorRankFields): number {
  if (a.owned !== b.owned) return b.owned - a.owned;
  if (a.shinies !== b.shinies) return b.shinies - a.shinies;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export type PvpRankFields = {
  id: string;
  rating: number;
  wins: number;
  losses: number;
  createdAt: Date;
};

/** Ranking PvP: Elo → victorias → antigüedad → id. */
export function comparePvpRating(a: PvpRankFields, b: PvpRankFields): number {
  if (a.rating !== b.rating) return b.rating - a.rating;
  if (a.wins !== b.wins) return b.wins - a.wins;
  const byDate = a.createdAt.getTime() - b.createdAt.getTime();
  if (byDate !== 0) return byDate;
  return a.id.localeCompare(b.id);
}

export function pvpMatchesPlayed(wins: number, losses: number): number {
  return Math.max(0, wins) + Math.max(0, losses);
}

export function isPvpRankingEligible(wins: number, losses: number): boolean {
  return pvpMatchesPlayed(wins, losses) >= PVP_MIN_MATCHES;
}

export function winRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total <= 0) return 0;
  return Math.round((wins / total) * 100);
}

/** Parsea `?view=` con compat de URLs viejas. */
export function pickRankingCategory(raw: string | undefined): RankingCategory {
  if (raw === "ladder" || raw === "pvp") return "pvp";
  if (raw === "ranked") return "ranked";
  if (raw === "combat_power" || raw === "trainers") return "combat_power";
  // collectors / pokedex / species → default PC
  return "combat_power";
}

export function rankingHref(
  category: RankingCategory,
  scope: RankingScope,
  countryCode?: string,
  page?: number,
): string {
  const params = new URLSearchParams({ view: category });
  if (scope === "friends") {
    params.set("scope", "friends");
  } else if (scope === "country" && countryCode) {
    params.set("country", countryCode);
  }
  if (page && page > 1) params.set("page", String(page));
  return `/ranking?${params.toString()}`;
}

export function isCurrentPlayerInTop3(position: number | null | undefined): boolean {
  return typeof position === "number" && position >= 1 && position <= 3;
}

/** Buckets simples (legacy; no usado en la UI nueva). */
export function powerDistribution(
  powers: number[],
): { labelKey: "low" | "mid" | "high" | "elite"; count: number; pct: number }[] {
  if (powers.length === 0) return [];
  const max = Math.max(...powers, 1);
  const edges = [0, max * 0.25, max * 0.5, max * 0.75, max + 1];
  const labelKeys = ["low", "mid", "high", "elite"] as const;
  const counts = [0, 0, 0, 0];
  for (const p of powers) {
    const i = edges.findIndex((edge, idx) => idx > 0 && p < edge) - 1;
    counts[Math.max(0, i)] += 1;
  }
  const total = powers.length;
  return labelKeys.map((labelKey, i) => ({
    labelKey,
    count: counts[i],
    pct: Math.round((counts[i] / total) * 100),
  }));
}
