// Fórmula de HP de los juegos oficiales (sin IV/EV, ya que acá los reemplazan
// los puntos manuales del jugador — ver dossier de diseño).
export function calculateMaxHp(baseHp: number, level: number): number {
  return Math.floor((2 * baseHp * level) / 100) + level + 10;
}

// Misma fórmula oficial para el resto de los stats, reemplazando el término
// de IV/EV por los puntos que el jugador invirtió a mano en ese stat.
export function calculateStat(base: number, points: number, level: number): number {
  return Math.floor(((2 * base + points) * level) / 100) + 5;
}

// Curva de experiencia "Medium Fast" de los juegos oficiales — la misma que
// usa la línea de Charmander. total de XP acumulada para llegar a un nivel.
export function xpForLevel(level: number): number {
  return level ** 3;
}

// XP restante para el próximo nivel, a partir de la XP acumulada real.
export function xpToNextLevel(currentXp: number, level: number): number {
  return Math.max(0, xpForLevel(level + 1) - currentXp);
}
