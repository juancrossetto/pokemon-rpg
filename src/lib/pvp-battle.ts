import {
  playerActsFirst,
  STRUGGLE_MOVE,
  type CombatantStats,
  type MoveSnapshot,
} from "@/lib/battle";
import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import { emptyStages, resolveSingleAction, type SideBattleState } from "@/lib/resolve-action";

// Simulación PvP headless (fase 4 del dossier). Enfrenta dos equipos completos
// reutilizando EXACTAMENTE el mismo combate por turnos que el PvE
// (resolveSingleAction: daño Gen III, STAB, tipos, estados, críticos), así que
// no se inventa un motor nuevo ni se puede divergir del balance de PvE.
//
// Es server-authoritative y automática: no hay intercambio de turnos en vivo
// (eso llega con Supabase Realtime más adelante). Ambos equipos pelean a HP
// completo — no toca el HP real de los Pokémon; PvP es una simulación, no
// modifica tu colección.

export type PvpPokemon = {
  name: string;
  maxHp: number;
  stats: CombatantStats;
  moves: MoveSnapshot[];
};

export type PvpTeam = PvpPokemon[];

export type PvpBattleResult = {
  winner: "a" | "b";
  // Cada KO como "atacanteLado:atacanteNombre>defensorLado:defensorNombre".
  koLog: string[];
  turns: number;
};

// Tope de acciones: corta batallas patológicas (dos muros que no se hacen daño).
// Si se alcanza, gana quien tenga más HP total restante — determinístico.
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

/**
 * IA simple: elige el movimiento de mayor daño esperado contra el rival actual
 * (poder × STAB × efectividad de tipo). Si solo hay movimientos de estado,
 * usa el primero; sin movimientos, Struggle.
 */
function pickMove(attacker: PvpPokemon, defenderTypes: string[]): MoveSnapshot {
  if (attacker.moves.length === 0) return STRUGGLE_MOVE;

  let best = attacker.moves[0];
  let bestScore = -1;
  for (const move of attacker.moves) {
    if (move.category === "STATUS" || move.power === null) continue;
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

/**
 * Simula la batalla completa. `teamA` es el retador, `teamB` el rival. Devuelve
 * el ganador, la cadena de KOs y la cantidad de turnos.
 */
export function simulatePvpBattle(teamA: PvpTeam, teamB: PvpTeam): PvpBattleResult {
  const a = teamA.map(toState);
  const b = teamB.map(toState);
  const koLog: string[] = [];

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

  while (ai !== -1 && bi !== -1 && turns < MAX_TURNS) {
    turns++;

    const moveA = pickMove(teamA[ai], b[bi].baseStats.types);
    const moveB = pickMove(teamB[bi], a[ai].baseStats.types);

    // Orden por prioridad y velocidad (lado A = "player", lado B = "wild").
    const aFirst = playerActsFirst(moveA, moveB, a[ai].baseStats.speed, b[bi].baseStats.speed);
    const order: ("a" | "b")[] = aFirst ? ["a", "b"] : ["b", "a"];

    for (const side of order) {
      if (a[ai].hp <= 0 || b[bi].hp <= 0) break; // alguien ya cayó este turno

      if (side === "a") {
        const out = resolveSingleAction("player", moveA, a[ai], b[bi]);
        a[ai] = out.player;
        b[bi] = out.wild;
        if (b[bi].hp <= 0) {
          koLog.push(`a:${a[ai].name}>b:${b[bi].name}`);
        }
      } else {
        const out = resolveSingleAction("wild", moveB, a[ai], b[bi]);
        a[ai] = out.player;
        b[bi] = out.wild;
        if (a[ai].hp <= 0) {
          koLog.push(`b:${b[bi].name}>a:${a[ai].name}`);
        }
      }
    }

    // Reemplazos: entra el próximo Pokémon vivo de cada lado que haya caído.
    if (a[ai].hp <= 0) ai = nextAlive(a, ai + 1);
    if (bi !== -1 && b[bi].hp <= 0) bi = nextAlive(b, bi + 1);
  }

  let winner: "a" | "b";
  if (ai === -1) winner = "b";
  else if (bi === -1) winner = "a";
  else winner = totalHp(a) >= totalHp(b) ? "a" : "b"; // desempate por tope de turnos

  return { winner, koLog, turns };
}
