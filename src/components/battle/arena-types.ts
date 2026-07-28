// Tipos compartidos de la arena de batalla. Viven separados del componente
// para que las páginas de batalla y las piezas extraídas (paneles, vistas de
// comandos, pantallas de resultado) no tengan que importar el componente
// gigante solo por sus tipos.

export interface Combatant {
  name: string;
  /** Nombre de especie (PokeAPI) — para el GIF animado de Showdown. */
  speciesName: string;
  level: number;
  /** Official artwork — fallback si el GIF falla. */
  spriteUrl: string;
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
  healAmount: number;
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
}

export interface OpponentPartyMember {
  slot: number;
  name: string;
  spriteUrl: string;
  fainted: boolean;
  active: boolean;
}

export type View = "menu" | "moves" | "bag" | "team";
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
  moves: { moveId: number; name: string; type: string; power?: number | null; pp: number; maxPp: number }[];
  initialLog: string[];
  pokeballs: PokeballStack[];
  potions: PotionStack[];
  /** Equipo completo del jugador (incluye el activo). */
  party: RosterMember[];
  opponentParty: OpponentPartyMember[];
  playerStatus: string | null;
  wildStatus: string | null;
  /** Si porta un objeto Choice, el movimiento al que ya quedó atado (o null). */
  playerChoiceLockMoveId: number | null;
  gymId: string | null;
  gymRunId: string | null;
  gymType: string | null;
  gymName: string | null;
  gymLeaderName: string | null;
  gymBadgeName: string | null;
  /** Modo de batalla: wild | gym | pvp */
  battleMode: "wild" | "gym" | "pvp";
  pvpMatchId: string | null;
}
