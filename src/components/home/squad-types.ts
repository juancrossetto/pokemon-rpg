import type { SquadContextLabels } from "@/components/squad-card-context-menu";
import type { HeldItemInfo } from "@/components/held-item-panel";
import type { EvolutionStage } from "@/lib/evolution-readiness";

/**
 * Tipos del squad de Home. Vivían en home-squad-grid/card (UI vieja, ya
 * eliminada); la strip actual (`active-team-strip`) sigue usando este shape.
 */

export type HomeSquadMove = {
  slot: number;
  name: string;
  type: string;
  currentPp: number;
  maxPp: number;
};

export type HomeSquadCardLabels = {
  hp: string;
  exp: string;
  atk: string;
  def: string;
  spAtk: string;
  spDef: string;
  speed: string;
  level: string;
  slot: string;
  lead: string;
  fainted: string;
  favorite: string;
  tradeLocked: string;
  pp: string;
  emptyMove: string;
  showDetails: string;
  hideDetails: string;
  tabAbout: string;
  tabStats: string;
  tabEvolutions: string;
  unknownSpecies: string;
  evolveAtLevel: string;
  evolveByTrade: string;
  evolveTradeItemHint?: string;
  evolveStones: Record<string, string>;
  evolveReadyShort?: string;
  evolveNeedItem?: string;
  evolveNeedLevel?: string;
  evolveNow?: string;
  evolveUseStone?: string;
  evolving?: string;
  canEvolveBadge?: string;
};

export type HomeSquadMember = {
  id: string;
  /** Para el número de Pokédex de la ficha grande. */
  speciesId: number;
  level: number;
  isFavorite: boolean;
  isTradeLocked: boolean;
  nickname: string | null;
  speciesName: string;
  types: string[];
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
  xpPct: number;
  xpToNextLabel: string;
  levelLabel: string;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
  unspentPoints: number;
  points: {
    ptStrength: number;
    ptDexterity: number;
    ptIntelligence: number;
    ptSpeed: number;
    ptConstitution: number;
  };
  bases: {
    baseHp: number;
    baseAttack: number;
    baseDefense: number;
    baseSpAtk: number;
    baseSpDef: number;
    baseSpeed: number;
  };
  evolutionChain: EvolutionStage[];
  ownedEvolutionItems?: string[];
  heldItemName: string | null;
  heldItem: HeldItemInfo | null;
  moves: (HomeSquadMove | null)[];
  labels: Omit<HomeSquadCardLabels, "lead" | "slot" | "level">;
  menuLabels: SquadContextLabels;
};
