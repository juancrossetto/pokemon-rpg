import { COMBAT_TOWER_CONFIG, getBlessing, TOWER_BLESSINGS } from "./config";
import type { TowerBlessing, TowerRunCreature } from "./types";

/** Elige hasta 3 bendiciones distintas no saturadas por stacks. */
export function pickBlessingOffers(
  ownedIds: string[],
  rng: () => number = Math.random,
): string[] {
  const ownedCount = new Map<string, number>();
  for (const id of ownedIds) {
    ownedCount.set(id, (ownedCount.get(id) ?? 0) + 1);
  }

  const eligible = TOWER_BLESSINGS.filter((b) => (ownedCount.get(b.id) ?? 0) < b.maxStacks);
  const pool = eligible.length > 0 ? eligible : TOWER_BLESSINGS;
  const shuffled = [...pool].sort(() => rng() - 0.5);
  const picked: string[] = [];
  for (const b of shuffled) {
    if (picked.includes(b.id)) continue;
    picked.push(b.id);
    if (picked.length >= 3) break;
  }
  return picked;
}

export function resolveBlessings(ids: string[]): TowerBlessing[] {
  return ids.map(getBlessing).filter((b): b is TowerBlessing => Boolean(b));
}

/** Multiplicador de monedas por bendición fortune. */
export function coinsBlessingMultiplier(blessingIds: string[]): number {
  let pct = 0;
  for (const id of blessingIds) {
    const b = getBlessing(id);
    if (!b) continue;
    for (const e of b.effects) {
      if (e.kind === "coins_pct") pct += e.value;
    }
  }
  return 1 + pct / 100;
}

export function maxHpBlessingMultiplier(blessingIds: string[]): number {
  let pct = 0;
  for (const id of blessingIds) {
    const b = getBlessing(id);
    if (!b) continue;
    for (const e of b.effects) {
      if (e.kind === "max_hp_pct") pct += e.value;
    }
  }
  return 1 + pct / 100;
}

/** Cura % del equipo vivo; no revive. */
export function applyHealToSnapshot(
  team: TowerRunCreature[],
  percent: number,
): TowerRunCreature[] {
  return team.map((m) => {
    if (m.defeated || m.currentHp <= 0) return m;
    const healed = Math.min(m.maxHp, m.currentHp + Math.floor(m.maxHp * (percent / 100)));
    return { ...m, currentHp: healed, defeated: false };
  });
}

/** Revive al primero derrotado con % HP. */
export function applyReviveOne(
  team: TowerRunCreature[],
  percent: number,
): TowerRunCreature[] {
  const idx = team.findIndex((m) => m.defeated || m.currentHp <= 0);
  if (idx < 0) return team;
  const next = team.map((m) => ({ ...m }));
  const target = next[idx]!;
  next[idx] = {
    ...target,
    defeated: false,
    currentHp: Math.max(1, Math.floor(target.maxHp * (percent / 100))),
  };
  return next;
}

export function applyRestRecovery(
  team: TowerRunCreature[],
  percent: number,
  reviveWeakest = false,
): TowerRunCreature[] {
  let next = applyHealToSnapshot(team, percent);
  if (reviveWeakest) {
    next = applyReviveOne(next, Math.max(20, Math.floor(percent / 2)));
  }
  return next;
}

export function averageHpRatio(team: TowerRunCreature[]): number {
  if (team.length === 0) return 0;
  const sum = team.reduce((acc, m) => acc + (m.defeated ? 0 : m.currentHp / m.maxHp), 0);
  return sum / team.length;
}

export function livingCount(team: TowerRunCreature[]): number {
  return team.filter((m) => !m.defeated && m.currentHp > 0).length;
}

export function shouldOfferBlessing(clearedFloor: number): boolean {
  return COMBAT_TOWER_CONFIG.blessingOfferFloors.includes(clearedFloor);
}
