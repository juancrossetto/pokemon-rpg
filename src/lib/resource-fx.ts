/**
 * Deltas cortos de energía/gemas para el header (espejo liviano de coin-fx).
 * Sin tween largo: flash + floater −N, y pending en sessionStorage para
 * sobrevivir el redirect a /battle.
 */
import { playResourceSpendSfx } from "@/lib/resource-spend-sfx";

export const ENERGY_DELTA_EVENT = "pokerpg:energy-delta";
export const GEM_DELTA_EVENT = "pokerpg:gem-delta";

export type ResourceDeltaDetail = {
  delta: number;
  /** Saldo post-delta cuando el caller ya lo conoce (evita esperar revalidate). */
  balanceAfter?: number;
};

const ENERGY_PENDING_KEY = "pokerpg:energy-delta-pending";
const GEM_PENDING_KEY = "pokerpg:gem-delta-pending";

type Slot = {
  pending: number;
  at: number;
  key: string;
  event: string;
};

const energySlot: Slot = {
  pending: 0,
  at: 0,
  key: ENERGY_PENDING_KEY,
  event: ENERGY_DELTA_EVENT,
};

const gemSlot: Slot = {
  pending: 0,
  at: 0,
  key: GEM_PENDING_KEY,
  event: GEM_DELTA_EVENT,
};

function writePending(slot: Slot, delta: number): void {
  slot.pending = delta;
  slot.at = Date.now();
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(slot.key, JSON.stringify({ delta, at: slot.at }));
    }
  } catch {
    /* private mode / SSR */
  }
}

function readPending(slot: Slot): { delta: number; at: number } | null {
  if (slot.pending !== 0 && Date.now() - slot.at < 8_000) {
    return { delta: slot.pending, at: slot.at };
  }
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(slot.key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { delta?: number; at?: number };
    if (
      typeof parsed.delta === "number" &&
      Number.isFinite(parsed.delta) &&
      parsed.delta !== 0 &&
      typeof parsed.at === "number" &&
      Date.now() - parsed.at < 8_000
    ) {
      slot.pending = parsed.delta;
      slot.at = parsed.at;
      return { delta: parsed.delta, at: parsed.at };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function clearPending(slot: Slot): void {
  slot.pending = 0;
  slot.at = 0;
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(slot.key);
  } catch {
    /* ignore */
  }
}

function announce(
  slot: Slot,
  delta: number,
  playSfx: boolean,
  balanceAfter?: number,
): void {
  if (typeof window === "undefined" || !Number.isFinite(delta) || delta === 0) return;
  const next = (readPending(slot)?.delta ?? 0) + delta;
  writePending(slot, next);
  const detail: ResourceDeltaDetail = { delta };
  if (
    typeof balanceAfter === "number" &&
    Number.isFinite(balanceAfter) &&
    balanceAfter >= 0
  ) {
    detail.balanceAfter = balanceAfter;
  }
  window.dispatchEvent(
    new CustomEvent<ResourceDeltaDetail>(slot.event, { detail }),
  );
  if (playSfx && delta < 0) playResourceSpendSfx();
}

export function seedPendingEnergyDelta(delta: number): void {
  if (typeof window === "undefined" || !Number.isFinite(delta) || delta === 0) return;
  writePending(energySlot, (readPending(energySlot)?.delta ?? 0) + delta);
}

export function announceEnergyDelta(delta: number, balanceAfter?: number): void {
  announce(energySlot, delta, true, balanceAfter);
}

/** Dispara la animación con el pending ya sembrado (sin sumar otra vez). */
export function flushPendingEnergyDelta(): void {
  if (typeof window === "undefined") return;
  const pending = readPending(energySlot);
  if (!pending || pending.delta === 0) return;
  window.dispatchEvent(
    new CustomEvent<ResourceDeltaDetail>(ENERGY_DELTA_EVENT, {
      detail: { delta: pending.delta },
    }),
  );
}

export function peekPendingEnergyDelta(): number {
  return readPending(energySlot)?.delta ?? 0;
}

export function clearPendingEnergyDelta(): void {
  clearPending(energySlot);
}

export function seedPendingGemDelta(delta: number): void {
  if (typeof window === "undefined" || !Number.isFinite(delta) || delta === 0) return;
  writePending(gemSlot, (readPending(gemSlot)?.delta ?? 0) + delta);
}

export function announceGemDelta(delta: number, balanceAfter?: number): void {
  announce(gemSlot, delta, true, balanceAfter);
}

export function peekPendingGemDelta(): number {
  return readPending(gemSlot)?.delta ?? 0;
}

export function clearPendingGemDelta(): void {
  clearPending(gemSlot);
}
