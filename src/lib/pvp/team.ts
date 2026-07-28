import type { MoveSnapshot } from "@/lib/battle";
import { calculateMaxHp } from "@/lib/stats";
import { playerCombatantStats } from "@/lib/combatant";
import type { PvpTeam } from "@/lib/pvp-battle";

/** Foto congelada de un Pokémon para un combate PvP (JSON en PvpMatch). */
export type PvpTeamMemberSnap = {
  slot: number;
  instanceId: string;
  name: string;
  speciesId: number;
  speciesName: string;
  spriteUrl: string;
  level: number;
  types: string[];
  maxHp: number;
  /** Stats ya calculadas (pt* incluidas). */
  stats: {
    level: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
    types: string[];
  };
  moves: Array<{
    id: number;
    name: string;
    type: string;
    category: MoveSnapshot["category"];
    power: number | null;
    accuracy: number | null;
    priority: number;
    maxPp: number;
  }>;
  heldItemId: string | null;
  /** HP real antes del combate (se restaura al cerrar). */
  preBattleHp: number;
  /** PP real por movimiento antes del combate. */
  preBattlePp: number[];
  heldItem: {
    id: string;
    name: string;
    heldEffect: string | null;
    heldValue: number | null;
    heldStat: string | null;
    heldBoostType: string | null;
  } | null;
  ptStrength: number;
  ptDexterity: number;
  ptIntelligence: number;
  ptSpeed: number;
  ptConstitution: number;
  isFullyEvolved: boolean;
};

export type PvpTeamSnap = PvpTeamMemberSnap[];

export type TeamRowForSnap = {
  id: string;
  nickname: string | null;
  level: number;
  currentHp: number;
  teamSlot: number | null;
  pvpSlot: number | null;
  ptStrength: number;
  ptDexterity: number;
  ptIntelligence: number;
  ptSpeed: number;
  ptConstitution: number;
  heldItemId: string | null;
  heldItem: {
    id: string;
    name: string;
    heldEffect: string | null;
    heldValue: number | null;
    heldStat: string | null;
    heldBoostType: string | null;
  } | null;
  species: {
    id: number;
    name: string;
    spriteUrl: string;
    baseHp: number;
    baseAttack: number;
    baseDefense: number;
    baseSpAtk: number;
    baseSpDef: number;
    baseSpeed: number;
    types: string[];
    evolvesTo: { id: number }[];
  };
  moves: {
    currentPp: number;
    move: {
      id: number;
      name: string;
      type: string;
      category: MoveSnapshot["category"];
      power: number | null;
      accuracy: number | null;
      priority: number;
      pp: number;
    };
  }[];
};

export const PVP_TEAM_INCLUDE = {
  species: { include: { evolvesTo: { select: { id: true } } } },
  moves: { include: { move: true }, orderBy: { slot: "asc" as const } },
  heldItem: true,
} as const;

/** Prioriza pvpSlot; si no hay preset, usa el equipo de aventura (teamSlot). */
export function resolveTeamRows<T extends { pvpSlot: number | null; teamSlot: number | null }>(
  rows: T[],
): T[] {
  const pvp = rows.filter((r) => r.pvpSlot != null).sort((a, b) => (a.pvpSlot ?? 0) - (b.pvpSlot ?? 0));
  if (pvp.length > 0) return pvp;
  return rows
    .filter((r) => r.teamSlot != null)
    .sort((a, b) => (a.teamSlot ?? 0) - (b.teamSlot ?? 0));
}

export function snapshotTeam(rows: TeamRowForSnap[]): PvpTeamSnap {
  return rows.map((p, i) => {
    const stats = playerCombatantStats(p.species, p.level, p);
    return {
      slot: p.pvpSlot ?? p.teamSlot ?? i + 1,
      instanceId: p.id,
      name: p.nickname ?? p.species.name,
      speciesId: p.species.id,
      speciesName: p.species.name,
      spriteUrl: p.species.spriteUrl,
      level: p.level,
      types: p.species.types,
      maxHp: calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution),
      stats: {
        level: stats.level,
        atk: stats.atk,
        def: stats.def,
        spAtk: stats.spAtk,
        spDef: stats.spDef,
        speed: stats.speed,
        types: stats.types,
      },
      moves: p.moves.map((m) => ({
        id: m.move.id,
        name: m.move.name,
        type: m.move.type,
        category: m.move.category,
        power: m.move.power,
        accuracy: m.move.accuracy,
        priority: m.move.priority,
        maxPp: m.move.pp,
      })),
      heldItemId: p.heldItemId,
      preBattleHp: p.currentHp,
      preBattlePp: p.moves.map((m) => m.currentPp),
      heldItem: p.heldItem
        ? {
            id: p.heldItem.id,
            name: p.heldItem.name,
            heldEffect: p.heldItem.heldEffect,
            heldValue: p.heldItem.heldValue,
            heldStat: p.heldItem.heldStat,
            heldBoostType: p.heldItem.heldBoostType,
          }
        : null,
      ptStrength: p.ptStrength,
      ptDexterity: p.ptDexterity,
      ptIntelligence: p.ptIntelligence,
      ptSpeed: p.ptSpeed,
      ptConstitution: p.ptConstitution,
      isFullyEvolved: p.species.evolvesTo.length === 0,
    };
  });
}

/** Convierte un snapshot a la forma que consume `simulatePvpBattle`. */
export function snapToSimTeam(snap: PvpTeamSnap): PvpTeam {
  return snap.map((p) => ({
    name: p.name,
    maxHp: p.maxHp,
    stats: {
      level: p.stats.level,
      atk: p.stats.atk,
      def: p.stats.def,
      spAtk: p.stats.spAtk,
      spDef: p.stats.spDef,
      speed: p.stats.speed,
      types: p.stats.types,
    },
    moves: p.moves.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      category: m.category,
      power: m.power,
      accuracy: m.accuracy,
      priority: m.priority,
    })),
  }));
}

export function parseTeamSnap(raw: unknown): PvpTeamSnap {
  if (!Array.isArray(raw)) return [];
  return raw as PvpTeamSnap;
}
