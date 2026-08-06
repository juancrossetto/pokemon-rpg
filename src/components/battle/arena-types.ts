// Tipos compartidos de la arena de batalla. Viven separados del componente
// para que las páginas de batalla y las piezas extraídas (paneles, vistas de
// comandos, pantallas de resultado) no tengan que importar el componente
// gigante solo por sus tipos.

import type { BattleBgId } from "@/lib/showdown-fx";

export interface Combatant {
  name: string;
  /** Nombre de especie (PokeAPI) — para el GIF animado de Showdown. */
  speciesName: string;
  level: number;
  /** Official artwork — fallback si el GIF falla. */
  spriteUrl: string;
  isShiny?: boolean;
}

export interface PokeballStack {
  itemId: string;
  name: string;
  quantity: number;
}

export interface PotionStack {
  itemId: string;
  name: string;
  quantity: number;
  /** Cura fija de HP; 0 en revives. */
  healAmount: number;
  kind: "heal" | "revive";
}

export interface RosterMember {
  instanceId: string;
  name: string;
  speciesName: string;
  level: number;
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
  types: string[];
  isShiny?: boolean;
}

export interface OpponentPartyMember {
  slot: number;
  name: string;
  spriteUrl: string;
  fainted: boolean;
  active: boolean;
}

export type MoveCategory = "PHYSICAL" | "SPECIAL" | "STATUS";

/** Movimiento tal como lo ve el panel de comandos. */
export interface BattleMoveOption {
  moveId: number;
  name: string;
  type: string;
  power?: number | null;
  /** null = nunca falla (Swift). */
  accuracy?: number | null;
  /** Obligatorio: el forecast de daño elige Atq/Def vs Atq.Esp/SpDef con esto. */
  category: MoveCategory;
  pp: number;
  maxPp: number;
  /** PokeAPI move.target.name */
  target?: string | null;
  /** Efecto del movimiento (PokeAPI), para la card de poderes. */
  effectText?: string | null;
}

export type View = "menu" | "moves" | "bag" | "team" | "targets" | "reviveTargets";
export type Outcome = "ongoing" | "won" | "lost" | "fled" | "caught" | "trainer_cleared";
export type LogSide = "player" | "wild" | "system";

export interface LogEntry {
  text: string;
  side: LogSide;
}

export interface BattleArenaProps {
  battleId: string;
  locale: string;
  trainerName: string;
  trainerPortraitUrl: string | null;
  opponentPortraitUrl: string | null;
  opponentName: string | null;
  player: Combatant & { instanceId: string; currentHp: number; maxHp: number };
  wild: Combatant & { currentHp: number; maxHp: number; types: string[]; isShiny?: boolean };
  moves: BattleMoveOption[];
  initialLog: string[];
  pokeballs: PokeballStack[];
  potions: PotionStack[];
  /** Equipo completo del jugador (incluye el activo). */
  party: RosterMember[];
  opponentParty: OpponentPartyMember[];
  playerStatus: string | null;
  wildStatus: string | null;
  /** Stats de combate del activo. El cliente les suma stages y estado para dos
   *  avisos: quién pega primero y el daño estimado de cada movimiento. El
   *  servidor sigue siendo el único que resuelve el turno. */
  playerStats: { atk: number; spAtk: number; speed: number };
  wildStats: { def: number; spDef: number; speed: number };
  /** Stats del slot B (solo DOUBLE), para forecast al elegir target. */
  playerBStats?: { atk: number; spAtk: number; speed: number } | null;
  wildBStats?: { def: number; spDef: number; speed: number } | null;
  /** Si porta un objeto Choice, el movimiento al que ya quedó atado (o null). */
  playerChoiceLockMoveId: number | null;
  /** Movimiento de 2 turnos en curso (Fly/Dig…), o null. */
  playerChargeMoveId: number | null;
  /** Carga de 2 turnos del slot B (solo DOUBLE). */
  playerChargeMoveIdB?: number | null;
  gymId: string | null;
  gymRunId: string | null;
  towerRunId: string | null;
  gymType: string | null;
  gymName: string | null;
  gymLeaderName: string | null;
  gymBadgeName: string | null;
  /** Modo de batalla: wild | gym | pvp | tower */
  battleMode: "wild" | "gym" | "pvp" | "tower";
  /**
   * Lugar del encuentro (mobile strip). Salvaje = ruta/ciudad + tramo;
   * torre = piso. Null en gym/PvP con entrenador.
   */
  encounterPlace?: {
    title: string;
    subtitle: string | null;
    /** Miniatura de zona (mapa) o torre — next/image a 32px. */
    iconUrl?: string | null;
  } | null;
  /** Fondo Showdown según bioma, location o tipo de gimnasio. */
  battleBg: BattleBgId;
  pvpMatchId: string | null;
  /** SINGLE por defecto; DOUBLE = Torre elite 2v2. */
  format?: "SINGLE" | "DOUBLE";
  /** Segundo Pokémon del jugador (solo DOUBLE). */
  playerB?: (Combatant & { instanceId: string; currentHp: number; maxHp: number }) | null;
  /** Segundo rival (solo DOUBLE). */
  wildB?: (Combatant & {
    currentHp: number;
    maxHp: number;
    types: string[];
    isShiny?: boolean;
  }) | null;
  /** Moves del slot B (solo DOUBLE). */
  movesB?: BattleMoveOption[];
  playerBStatus?: string | null;
  wildBStatus?: string | null;
  /** ISO del deadline de decisión del jugador (reloj de inactividad). */
  turnDeadlineAt?: string | null;
  /** Fallos de huida acumulados (solo salvaje; sube el % Gen III/IV). */
  fleeAttempts?: number;
}
