import { getTypeEffectiveness } from "@/lib/type-effectiveness";

export interface CombatantStats {
  level: number;
  types: string[];
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface MoveSnapshot {
  id: number;
  name: string;
  type: string;
  category: "PHYSICAL" | "SPECIAL" | "STATUS";
  power: number | null;
  accuracy: number | null;
  priority: number;
}

// Orden de turno oficial: prioridad del movimiento primero (ej. Ataque
// Rápido siempre pega antes sin importar velocidad), y recién ahí Velocidad
// del Pokémon como desempate.
export function playerActsFirst(
  playerMove: MoveSnapshot,
  wildMove: MoveSnapshot,
  playerSpeed: number,
  wildSpeed: number,
): boolean {
  if (playerMove.priority !== wildMove.priority) {
    return playerMove.priority > wildMove.priority;
  }
  return playerSpeed >= wildSpeed;
}

export interface MoveResult {
  hit: boolean;
  damage: number;
  effectiveness: number;
}

// Fórmula de daño estilo Gen III+, simplificada: sin críticos, sin ítems,
// sin efectos de estado (parálisis/quemadura/etc) — eso queda para una
// fase posterior. STAB + efectividad de tipo + variación aleatoria sí están.
export function resolveMoveUse(
  attacker: CombatantStats,
  defender: CombatantStats,
  move: MoveSnapshot,
): MoveResult {
  const hit = move.accuracy === null ? true : Math.random() * 100 < move.accuracy;
  if (!hit || move.category === "STATUS" || move.power === null) {
    return { hit, damage: 0, effectiveness: 1 };
  }

  const atkStat = move.category === "PHYSICAL" ? attacker.atk : attacker.spAtk;
  const defStat = move.category === "PHYSICAL" ? defender.def : defender.spDef;

  const base = Math.floor(
    (Math.floor((2 * attacker.level) / 5 + 2) * move.power * (atkStat / defStat)) / 50 + 2,
  );

  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = getTypeEffectiveness(move.type, defender.types);
  const randomFactor = 0.85 + Math.random() * 0.15;

  const damage = Math.max(0, Math.floor(base * stab * effectiveness * randomFactor));
  return { hit, damage, effectiveness };
}

// Curva simple de XP por victoria PvE — el nivel del salvaje pesa más que
// una fórmula fija, para que enfrentar rivales más fuertes valga la pena.
export function xpForVictory(wildLevel: number): number {
  return wildLevel * 12;
}

// Un evento por golpe/uso de movimiento dentro de un turno — el cliente
// reproduce esta lista en secuencia (shake, popup de daño, barra de HP)
// en vez de saltar directo al estado final.
export interface TurnEvent {
  side: "player" | "wild";
  moveName: string;
  moveType: string;
  category: "PHYSICAL" | "SPECIAL" | "STATUS";
  hit: boolean;
  isStatus: boolean;
  damage: number;
  effectiveness: number;
  hpAfter: number;
}

