/**
 * Beats destacados de una pelea para el highlight reel del resultado.
 * Se acumulan en el cliente durante playEvent / KO.
 */

export type BattleHighlightKind =
  | "crit"
  | "superEffective"
  | "ko"
  | "ohko"
  | "multiHit"
  | "seStreak";

export type BattleHighlight = {
  kind: BattleHighlightKind;
  /** Nombre del move (ya formateado) cuando aplica. */
  moveName?: string;
  /** Contador (multi-hit, racha SE). */
  count?: number;
};

export type BattleHighlightsState = {
  items: BattleHighlight[];
  /** SE consecutivos del jugador en esta pelea. */
  seStreak: number;
  seStreakBest: number;
  /** Turnos ofensivos del jugador con daño. */
  playerHits: number;
};

export function createHighlightsState(): BattleHighlightsState {
  return { items: [], seStreak: 0, seStreakBest: 0, playerHits: 0 };
}

const MAX_ITEMS = 5;

function pushUnique(
  state: BattleHighlightsState,
  item: BattleHighlight,
): BattleHighlightsState {
  // Evitar duplicar el mismo kind+move seguido.
  const last = state.items[state.items.length - 1];
  if (
    last &&
    last.kind === item.kind &&
    last.moveName === item.moveName &&
    item.kind !== "seStreak"
  ) {
    return state;
  }
  const items = [...state.items, item].slice(-MAX_ITEMS);
  return { ...state, items };
}

/** Registrar un golpe del jugador (después de resolver hit). */
export function recordPlayerHit(
  state: BattleHighlightsState,
  opts: {
    moveName: string;
    critical: boolean;
    effectiveness: number;
    hitCount: number;
    damage: number;
    defenderMaxHp: number;
    causedKo: boolean;
  },
): BattleHighlightsState {
  let next = { ...state, playerHits: state.playerHits + 1 };
  const se = opts.effectiveness > 1;

  if (se) {
    const seStreak = next.seStreak + 1;
    const seStreakBest = Math.max(next.seStreakBest, seStreak);
    next = { ...next, seStreak, seStreakBest };
    if (seStreak === 3 || (seStreak > 3 && seStreak % 2 === 1)) {
      next = pushUnique(next, { kind: "seStreak", count: seStreak });
    }
  } else {
    next = { ...next, seStreak: 0 };
  }

  if (opts.critical) {
    next = pushUnique(next, { kind: "crit", moveName: opts.moveName });
  }
  if (se) {
    next = pushUnique(next, {
      kind: "superEffective",
      moveName: opts.moveName,
    });
  }
  if (opts.hitCount > 1) {
    next = pushUnique(next, {
      kind: "multiHit",
      moveName: opts.moveName,
      count: opts.hitCount,
    });
  }
  if (opts.causedKo) {
    const ohko =
      opts.defenderMaxHp > 0 && opts.damage >= opts.defenderMaxHp * 0.95;
    next = pushUnique(next, {
      kind: ohko ? "ohko" : "ko",
      moveName: opts.moveName,
    });
  }

  return next;
}

export function recordFoeBreaksSeStreak(
  state: BattleHighlightsState,
): BattleHighlightsState {
  if (state.seStreak === 0) return state;
  return { ...state, seStreak: 0 };
}
