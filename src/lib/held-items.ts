import type { CombatantStats } from "@/lib/battle";
import type { StatusCondition } from "@/lib/status";

export type HeldEffectKind =
  | "LEFTOVERS"
  | "CHOICE_LOCK"
  | "LIFE_ORB"
  | "FOCUS_SASH"
  | "EVIOLITE"
  | "FLINCH_CHANCE"
  | "QUICK_CLAW"
  | "SITRUS_BERRY"
  | "LUM_BERRY"
  | "TYPE_BOOST"
  | "EXP_SHARE";

export interface HeldItemSnapshot {
  id: string;
  name: string;
  effect: HeldEffectKind;
  value: number | null;
  stat: "atk" | "spAtk" | "speed" | null;
  boostType: string | null;
}

/** Convierte la fila de Item (con relación heldItem) al snapshot que usa el motor de batalla. */
export function heldItemSnapshotFromItem(
  item:
    | {
        id: string;
        name: string;
        heldEffect: string | null;
        heldValue: number | null;
        heldStat: string | null;
        heldBoostType: string | null;
      }
    | null
    | undefined,
): HeldItemSnapshot | null {
  if (!item || !item.heldEffect) return null;
  return {
    id: item.id,
    name: item.name,
    effect: item.heldEffect as HeldEffectKind,
    value: item.heldValue,
    stat: (item.heldStat as HeldItemSnapshot["stat"]) ?? null,
    boostType: item.heldBoostType,
  };
}

/**
 * Modificadores pasivos de stats del objeto equipado (Choice/Eviolite).
 * Se aplica DESPUÉS de los stages, sobre las stats ya calculadas.
 */
export function applyHeldItemToStats(
  stats: CombatantStats,
  heldItem: HeldItemSnapshot | null | undefined,
  isFullyEvolved: boolean,
): CombatantStats {
  if (!heldItem || !heldItem.value) return stats;
  if (heldItem.effect === "CHOICE_LOCK" && heldItem.stat) {
    const mult = heldItem.value;
    if (heldItem.stat === "atk") return { ...stats, atk: Math.floor(stats.atk * mult) };
    if (heldItem.stat === "spAtk") return { ...stats, spAtk: Math.floor(stats.spAtk * mult) };
    if (heldItem.stat === "speed") return { ...stats, speed: Math.floor(stats.speed * mult) };
  }
  if (heldItem.effect === "EVIOLITE" && !isFullyEvolved) {
    return {
      ...stats,
      def: Math.floor(stats.def * (1 + heldItem.value)),
      spDef: Math.floor(stats.spDef * (1 + heldItem.value)),
    };
  }
  return stats;
}

/** Multiplicador de poder por objeto (Life Orb, potenciadores de tipo) — solo golpes que dañan. */
export function heldItemPowerMultiplier(
  heldItem: HeldItemSnapshot | null | undefined,
  moveType: string,
): number {
  if (!heldItem || !heldItem.value) return 1;
  if (heldItem.effect === "LIFE_ORB") return 1 + heldItem.value;
  if (heldItem.effect === "TYPE_BOOST" && heldItem.boostType === moveType) {
    return 1 + heldItem.value;
  }
  return 1;
}

export interface HeldItemTrigger {
  itemName: string;
  kind: "focus_sash" | "sitrus_berry" | "lum_berry" | "leftovers";
  amount?: number;
  curedStatus?: StatusCondition;
}

/**
 * Resuelve los efectos "de evento" del objeto equipado del jugador (no pasivos
 * de stats): Focus Sash / Sitrus Berry / Lum Berry (un solo uso por batalla) y
 * Leftovers (cada turno). Se llama una vez por acción sobre el estado YA
 * actualizado del jugador, comparando contra su HP/estado de antes de la acción.
 */
export function resolvePlayerHeldItemTrigger(params: {
  heldItem: HeldItemSnapshot | null | undefined;
  hpBefore: number;
  hp: number;
  maxHp: number;
  statusBefore: StatusCondition | null;
  status: StatusCondition | null;
  alreadyConsumed: boolean;
  isActingThisCall: boolean;
}): { hp: number; status: StatusCondition | null; trigger: HeldItemTrigger | null; consumed: boolean } {
  const { heldItem, hpBefore, statusBefore, alreadyConsumed, isActingThisCall } = params;
  let { hp, status } = params;

  if (!heldItem) return { hp, status, trigger: null, consumed: alreadyConsumed };

  if (!alreadyConsumed) {
    if (heldItem.effect === "FOCUS_SASH" && hpBefore >= params.maxHp && hp <= 0) {
      hp = 1;
      return {
        hp,
        status,
        trigger: { itemName: heldItem.name, kind: "focus_sash" },
        consumed: true,
      };
    }

    if (
      heldItem.effect === "SITRUS_BERRY" &&
      hp > 0 &&
      hpBefore > params.maxHp * 0.5 &&
      hp <= params.maxHp * 0.5
    ) {
      const heal = Math.max(1, Math.floor(params.maxHp * (heldItem.value ?? 0.25)));
      hp = Math.min(params.maxHp, hp + heal);
      return {
        hp,
        status,
        trigger: { itemName: heldItem.name, kind: "sitrus_berry", amount: heal },
        consumed: true,
      };
    }

    if (heldItem.effect === "LUM_BERRY" && statusBefore === null && status !== null) {
      const cured = status;
      status = null;
      return {
        hp,
        status,
        trigger: { itemName: heldItem.name, kind: "lum_berry", curedStatus: cured },
        consumed: true,
      };
    }
  }

  if (isActingThisCall && heldItem.effect === "LEFTOVERS" && hp > 0 && hp < params.maxHp) {
    const heal = Math.max(1, Math.floor(params.maxHp * (heldItem.value ?? 1 / 16)));
    hp = Math.min(params.maxHp, hp + heal);
    return {
      hp,
      status,
      trigger: { itemName: heldItem.name, kind: "leftovers", amount: heal },
      consumed: alreadyConsumed,
    };
  }

  return { hp, status, trigger: null, consumed: alreadyConsumed };
}
