import {
  playerActsFirst,
  STRUGGLE_MOVE,
  type CombatantStats,
  type MoveSnapshot,
} from "@/lib/battle";
import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import { emptyStages, resolveSingleAction, type SideBattleState } from "@/lib/resolve-action";

// Simulación PvP headless. Enfrenta dos equipos completos reutilizando el
// mismo motor que el PvE. Guarda koLog + turnLog (mismo formato que ranked)
// para el replay en /pvp/[id].

export type PvpPokemon = {
  name: string;
  maxHp: number;
  stats: CombatantStats;
  moves: MoveSnapshot[];
};

export type PvpTeam = PvpPokemon[];

export type PvpBattleResult = {
  winner: "a" | "b";
  // "a:Attacker>b:Fainted"
  koLog: string[];
  /** Mismo esquema machine-readable que battle-move (used:/damage:/fainted:/…). */
  turnLog: string[];
  turns: number;
};

const MAX_TURNS = 400;

function toState(p: PvpPokemon): SideBattleState {
  return {
    hp: p.maxHp,
    maxHp: p.maxHp,
    status: null,
    sleepTurns: 0,
    stages: emptyStages(),
    name: p.name,
    baseStats: p.stats,
  };
}

function pickMove(attacker: PvpPokemon, defenderTypes: string[]): MoveSnapshot {
  if (attacker.moves.length === 0) return STRUGGLE_MOVE;

  let best = attacker.moves[0];
  let bestScore = -1;
  for (const move of attacker.moves) {
    if (move.category === "STATUS" || move.power == null) continue;
    const stab = attacker.stats.types.includes(move.type) ? 1.5 : 1;
    const eff = getTypeEffectiveness(move.type, defenderTypes);
    const score = move.power * stab * eff;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function totalHp(team: SideBattleState[]): number {
  return team.reduce((sum, s) => sum + Math.max(0, s.hp), 0);
}

function appendActionLog(
  turnLog: string[],
  attackerName: string,
  foeName: string,
  move: MoveSnapshot,
  events: {
    skipped?: string | null;
    hit: boolean;
    isStatus?: boolean;
    damage: number;
    residualDamage?: number;
    residualStatus?: string | null;
    statusApplied?: string | null;
  }[],
) {
  for (const e of events) {
    if (e.skipped === "paralyzed") turnLog.push(`paralyzed:${attackerName}`);
    else if (e.skipped === "asleep") turnLog.push(`asleep:${attackerName}`);
    else if (e.skipped === "frozen") turnLog.push(`frozen:${attackerName}`);
    else if (e.skipped === "flinch") turnLog.push(`flinch:${attackerName}`);
    else if (e.skipped) turnLog.push(`disobey:${attackerName}`);
    else if (e.hit && e.isStatus) {
      turnLog.push(`used:${attackerName}:${move.name}`);
      if (e.statusApplied) turnLog.push(`status:${foeName}:${e.statusApplied}`);
    } else if (e.hit && !e.isStatus) {
      turnLog.push(`used:${attackerName}:${move.name}`);
      turnLog.push(`damage:${foeName}:${e.damage}`);
      if (e.statusApplied) turnLog.push(`status:${foeName}:${e.statusApplied}`);
    } else if (!e.hit) {
      turnLog.push(`miss:${attackerName}:${move.name}`);
    }

    if (e.residualDamage) {
      const kind =
        e.residualStatus === "BURN" ? "burn" : e.residualStatus === "POISON" ? "poison" : "status";
      turnLog.push(`residual:${attackerName}:${e.residualDamage}:${kind}`);
    }
  }
}

/**
 * Simula la batalla completa. `teamA` es el retador, `teamB` el rival.
 */
export function simulatePvpBattle(teamA: PvpTeam, teamB: PvpTeam): PvpBattleResult {
  const a = teamA.map(toState);
  const b = teamB.map(toState);
  const koLog: string[] = [];
  const turnLog: string[] = [];

  let ai = 0;
  let bi = 0;
  let turns = 0;

  const nextAlive = (team: SideBattleState[], from: number): number => {
    for (let i = from; i < team.length; i++) {
      if (team[i].hp > 0) return i;
    }
    return -1;
  };

  ai = nextAlive(a, 0);
  bi = nextAlive(b, 0);
  if (ai !== -1) turnLog.push(`sendOut:${a[ai].name}`);
  if (bi !== -1) turnLog.push(`sendOut:${b[bi].name}`);

  while (ai !== -1 && bi !== -1 && turns < MAX_TURNS) {
    turns++;

    const moveA = pickMove(teamA[ai], b[bi].baseStats.types);
    const moveB = pickMove(teamB[bi], a[ai].baseStats.types);

    const aFirst = playerActsFirst(moveA, moveB, a[ai].baseStats.speed, b[bi].baseStats.speed);
    const order: ("a" | "b")[] = aFirst ? ["a", "b"] : ["b", "a"];

    for (const side of order) {
      if (a[ai].hp <= 0 || b[bi].hp <= 0) break;

      if (side === "a") {
        const out = resolveSingleAction("player", moveA, a[ai], b[bi]);
        a[ai] = out.player;
        b[bi] = out.wild;
        appendActionLog(turnLog, a[ai].name, b[bi].name, moveA, out.events);
        if (b[bi].hp <= 0) {
          koLog.push(`a:${a[ai].name}>b:${b[bi].name}`);
          turnLog.push(`fainted:${b[bi].name}`);
        }
      } else {
        const out = resolveSingleAction("wild", moveB, a[ai], b[bi]);
        a[ai] = out.player;
        b[bi] = out.wild;
        appendActionLog(turnLog, b[bi].name, a[ai].name, moveB, out.events);
        if (a[ai].hp <= 0) {
          koLog.push(`b:${b[bi].name}>a:${a[ai].name}`);
          turnLog.push(`fainted:${a[ai].name}`);
        }
      }
    }

    if (a[ai].hp <= 0) {
      ai = nextAlive(a, ai + 1);
      if (ai !== -1) turnLog.push(`sendOut:${a[ai].name}`);
    }
    if (bi !== -1 && b[bi].hp <= 0) {
      bi = nextAlive(b, bi + 1);
      if (bi !== -1) turnLog.push(`sendOut:${b[bi].name}`);
    }
  }

  let winner: "a" | "b";
  if (ai === -1) winner = "b";
  else if (bi === -1) winner = "a";
  else winner = totalHp(a) >= totalHp(b) ? "a" : "b";

  return { winner, koLog, turnLog, turns };
}
