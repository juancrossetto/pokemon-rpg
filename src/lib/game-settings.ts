import type { AutoStrategy } from "@/lib/battle-auto";

export type GameSettings = {
  autoStrategy: AutoStrategy;
  autoStopHpPercent: number;
  reducedMotion: boolean;
  flashes: boolean;
};

const STORAGE_KEY = "game-settings-v1";
const DEFAULTS: GameSettings = {
  autoStrategy: "balanced",
  autoStopHpPercent: 15,
  reducedMotion: false,
  flashes: true,
};

let current = DEFAULTS;
let hydrated = false;
const listeners = new Set<() => void>();

function sanitize(value: Partial<GameSettings> | null | undefined): GameSettings {
  const strategy = value?.autoStrategy;
  return {
    autoStrategy:
      strategy === "conservative" || strategy === "aggressive" || strategy === "balanced"
        ? strategy
        : DEFAULTS.autoStrategy,
    autoStopHpPercent: Math.min(50, Math.max(0, Number(value?.autoStopHpPercent) || 0)),
    reducedMotion: Boolean(value?.reducedMotion),
    flashes: value?.flashes !== false,
  };
}

export function getGameSettings(): GameSettings {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      current = raw ? sanitize(JSON.parse(raw) as Partial<GameSettings>) : DEFAULTS;
    } catch {
      current = DEFAULTS;
    }
  }
  return current;
}

export function getServerGameSettings(): GameSettings {
  return DEFAULTS;
}

export function updateGameSettings(patch: Partial<GameSettings>): GameSettings {
  current = sanitize({ ...getGameSettings(), ...patch });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // La preferencia sigue activa durante esta sesión.
  }
  document.documentElement.dataset.reduceMotion = current.reducedMotion ? "1" : "0";
  document.documentElement.dataset.flashes = current.flashes ? "1" : "0";
  for (const listener of listeners) listener();
  return current;
}

export function subscribeGameSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
