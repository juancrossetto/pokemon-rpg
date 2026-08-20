import type { AutoStrategy } from "@/lib/battle-auto";

export type GameSettings = {
  autoStrategy: AutoStrategy;
  autoStopHpPercent: number;
  reducedMotion: boolean;
  flashes: boolean;
  highContrast: boolean;
  textScale: "normal" | "large" | "xlarge";
  colorCues: boolean;
};

const STORAGE_KEY = "game-settings-v1";
const DEFAULTS: GameSettings = {
  autoStrategy: "balanced",
  autoStopHpPercent: 15,
  reducedMotion: false,
  flashes: true,
  highContrast: false,
  textScale: "normal",
  colorCues: false,
};

let current = DEFAULTS;
let hydrated = false;
const listeners = new Set<() => void>();

function sanitize(value: Partial<GameSettings> | null | undefined): GameSettings {
  const strategy = value?.autoStrategy;
  const textScale = value?.textScale;
  return {
    autoStrategy:
      strategy === "conservative" || strategy === "aggressive" || strategy === "balanced"
        ? strategy
        : DEFAULTS.autoStrategy,
    autoStopHpPercent: Math.min(50, Math.max(0, Number(value?.autoStopHpPercent) || 0)),
    reducedMotion: Boolean(value?.reducedMotion),
    flashes: value?.flashes !== false,
    highContrast: Boolean(value?.highContrast),
    textScale:
      textScale === "large" || textScale === "xlarge" ? textScale : "normal",
    colorCues: Boolean(value?.colorCues),
  };
}

function defaultsForBrowser(): GameSettings {
  if (typeof window === "undefined") return DEFAULTS;
  return {
    ...DEFAULTS,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

export function applyGameSettings(settings: GameSettings) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.dataset.reduceMotion = settings.reducedMotion ? "1" : "0";
  html.dataset.flashes = settings.flashes ? "1" : "0";
  html.dataset.highContrast = settings.highContrast ? "1" : "0";
  html.dataset.textScale = settings.textScale;
  html.dataset.colorCues = settings.colorCues ? "1" : "0";
}

/** Se ejecuta en head para aplicar preferencias antes del primer paint. */
export function gameSettingsEarlyScript(): string {
  return `(function(){try{var h=document.documentElement;var r=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});var s=r?JSON.parse(r):{};var reduce=typeof s.reducedMotion==='boolean'?s.reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches;h.dataset.reduceMotion=reduce?'1':'0';h.dataset.flashes=s.flashes===false?'0':'1';h.dataset.highContrast=s.highContrast?'1':'0';h.dataset.textScale=(s.textScale==='large'||s.textScale==='xlarge')?s.textScale:'normal';h.dataset.colorCues=s.colorCues?'1':'0';}catch(e){}})();`;
}

export function getGameSettings(): GameSettings {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      current = raw
        ? sanitize(JSON.parse(raw) as Partial<GameSettings>)
        : defaultsForBrowser();
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
  applyGameSettings(current);
  for (const listener of listeners) listener();
  return current;
}

export function subscribeGameSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
