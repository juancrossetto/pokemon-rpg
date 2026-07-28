import type { ClanAffinity } from "@/lib/clan-types";

export type AffinityBuff = {
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
};

const AFFINITY_BUFFS: Record<ClanAffinity, AffinityBuff> = {
  NORMAL: { leftLabel: "HP", leftValue: 2, rightLabel: "DEF", rightValue: 1 },
  FIRE: { leftLabel: "ATK", leftValue: 3, rightLabel: "SPD", rightValue: 1 },
  WATER: { leftLabel: "DEF", leftValue: 3, rightLabel: "HP", rightValue: 1 },
  GRASS: { leftLabel: "HP", leftValue: 2, rightLabel: "REC", rightValue: 2 },
  ELECTRIC: { leftLabel: "SPD", leftValue: 3, rightLabel: "ATK", rightValue: 1 },
  ICE: { leftLabel: "SPA", leftValue: 2, rightLabel: "SPD", rightValue: 2 },
  ROCK: { leftLabel: "DEF", leftValue: 3, rightLabel: "ATK", rightValue: 1 },
  GROUND: { leftLabel: "DEF", leftValue: 2, rightLabel: "HP", rightValue: 2 },
  PSYCHIC: { leftLabel: "SPA", leftValue: 3, rightLabel: "SPD", rightValue: 1 },
  DARK: { leftLabel: "ATK", leftValue: 2, rightLabel: "CRIT", rightValue: 2 },
  STEEL: { leftLabel: "DEF", leftValue: 3, rightLabel: "SPD", rightValue: 1 },
  DRAGON: { leftLabel: "ATK", leftValue: 2, rightLabel: "SPA", rightValue: 2 },
  FAIRY: { leftLabel: "SPD", leftValue: 2, rightLabel: "REC", rightValue: 2 },
  FIGHTING: { leftLabel: "ATK", leftValue: 3, rightLabel: "HP", rightValue: 1 },
  GHOST: { leftLabel: "SPD", leftValue: 2, rightLabel: "CRIT", rightValue: 2 },
};

export function getAffinityBuff(affinity: ClanAffinity): AffinityBuff {
  return AFFINITY_BUFFS[affinity];
}
