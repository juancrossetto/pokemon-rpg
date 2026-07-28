"use client";

/**
 * SFX de batalla: samples cortos por tipo (`/audio/battle/sfx/*.wav`),
 * lazy-load al entrar en combate. Fallback Web Audio si el sample falla.
 */

export type SfxKind =
  | "hit"
  | "damage"
  | "fire"
  | "water"
  | "electric"
  | "ice"
  | "grass"
  | "rock"
  | "ground"
  | "wind"
  | "psychic"
  | "ghost"
  | "poison"
  | "steel"
  | "dragon"
  | "fairy"
  | "dark"
  | "bug"
  | "contact"
  | "energy"
  | "superEffective"
  | "miss"
  | "faint"
  | "ball"
  | "badge"
  | "status"
  | "crit"
  | "levelUp"
  | "evolve"
  | "heal"
  | "restorePp";

const SAMPLE_BASE = "/audio/battle/sfx";
const SAMPLE_EXT = "wav";
const STORAGE_MUTE = "battle-sfx-muted";
const STORAGE_VOLUME = "battle-sfx-volume";
const DEFAULT_SFX_VOLUME = 0.4;

/** Clips que conviene tener listos al abrir la arena (tipos + impacto). */
const BATTLE_PRELOAD: SfxKind[] = [
  "electric",
  "fire",
  "water",
  "ice",
  "grass",
  "rock",
  "ground",
  "wind",
  "psychic",
  "ghost",
  "poison",
  "steel",
  "dragon",
  "fairy",
  "dark",
  "bug",
  "contact",
  "hit",
  "damage",
  "energy",
  "crit",
  "superEffective",
  "miss",
  "faint",
  "status",
  "ball",
];

type SampleState =
  | { status: "loading"; promise: Promise<HTMLAudioElement | null> }
  | { status: "ready"; el: HTMLAudioElement }
  | { status: "missing" };

const sampleCache = new Map<SfxKind, SampleState>();

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

export function isBattleSfxMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_MUTE) === "1";
}

export function setBattleSfxMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_MUTE, muted ? "1" : "0");
}

export function getBattleSfxVolume(): number {
  if (typeof window === "undefined") return DEFAULT_SFX_VOLUME;
  const raw = window.localStorage.getItem(STORAGE_VOLUME);
  if (raw == null) return DEFAULT_SFX_VOLUME;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_SFX_VOLUME;
  return Math.min(1, Math.max(0, n));
}

export function setBattleSfxVolume(volume: number) {
  if (typeof window === "undefined") return;
  const v = Math.min(1, Math.max(0, volume));
  window.localStorage.setItem(STORAGE_VOLUME, String(v));
}

function currentSfxVolume(): number {
  if (isBattleSfxMuted()) return 0;
  return getBattleSfxVolume();
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function battleSfxUrl(kind: SfxKind): string {
  return `${SAMPLE_BASE}/${kind}.${SAMPLE_EXT}`;
}

function loadSample(kind: SfxKind): Promise<HTMLAudioElement | null> {
  const cached = sampleCache.get(kind);
  if (cached?.status === "ready") return Promise.resolve(cached.el);
  if (cached?.status === "missing") return Promise.resolve(null);
  if (cached?.status === "loading") return cached.promise;

  const promise = new Promise<HTMLAudioElement | null>((resolve) => {
    if (typeof window === "undefined") {
      sampleCache.set(kind, { status: "missing" });
      resolve(null);
      return;
    }
    const el = new Audio();
    el.preload = "auto";
    el.src = battleSfxUrl(kind);
    const done = (ok: boolean) => {
      if (ok) {
        sampleCache.set(kind, { status: "ready", el });
        resolve(el);
      } else {
        sampleCache.set(kind, { status: "missing" });
        resolve(null);
      }
    };
    el.addEventListener("canplaythrough", () => done(true), { once: true });
    el.addEventListener("error", () => done(false), { once: true });
    // Safari a veces no dispara canplaythrough sin load().
    el.load();
  });

  sampleCache.set(kind, { status: "loading", promise });
  return promise;
}

function playSample(kind: SfxKind): boolean {
  const cached = sampleCache.get(kind);
  if (cached?.status !== "ready") return false;
  try {
    const volume = currentSfxVolume();
    if (volume <= 0) return true;
    const node = cached.el.cloneNode(true) as HTMLAudioElement;
    node.volume = volume;
    void node.play().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Precarga diferida: no bloquea la UI; se llama al entrar a batalla. */
export function preloadBattleSfx(kinds: SfxKind[] = BATTLE_PRELOAD) {
  if (typeof window === "undefined") return;
  for (const kind of kinds) void loadSample(kind);
}

function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === audio.sampleRate) return noiseBuffer;
  const length = Math.floor(audio.sampleRate * 0.25);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

function tone(
  frequency: number,
  durationMs: number,
  type: OscillatorType,
  gain = 0.14,
  slideTo?: number,
) {
  const audio = getCtx();
  if (!audio) return;
  const volume = currentSfxVolume();
  if (volume <= 0) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + durationMs / 1000);
  }
  g.gain.setValueAtTime(gain * volume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

function noiseBurst(
  durationMs: number,
  filterFreq: number,
  filterType: BiquadFilterType = "bandpass",
  gain = 0.1,
) {
  const audio = getCtx();
  if (!audio) return;
  const volume = currentSfxVolume();
  if (volume <= 0) return;
  const now = audio.currentTime;
  const src = audio.createBufferSource();
  src.buffer = getNoiseBuffer(audio);
  const filter = audio.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, now);
  filter.Q.setValueAtTime(1.1, now);
  const g = audio.createGain();
  g.gain.setValueAtTime(gain * volume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  src.connect(filter);
  filter.connect(g);
  g.connect(audio.destination);
  src.start(now);
  src.stop(now + durationMs / 1000 + 0.02);
}

function damageThud() {
  noiseBurst(90, 280, "lowpass", 0.16);
  tone(95, 110, "square", 0.12, 45);
  setTimeout(() => noiseBurst(50, 900, "bandpass", 0.08), 30);
}

function hiss(durationMs = 140, gain = 0.1) {
  noiseBurst(durationMs, 2600, "highpass", gain);
}

function shimmer(base = 700) {
  tone(base, 70, "sine", 0.08);
  setTimeout(() => tone(base * 1.25, 80, "triangle", 0.08), 40);
  setTimeout(() => tone(base * 1.5, 90, "sine", 0.08), 90);
}

/** Fallback sintético si el sample aún no cargó o falló. */
function playSynth(kind: SfxKind) {
  switch (kind) {
    case "damage":
      damageThud();
      break;
    case "hit":
      damageThud();
      tone(200, 80, "square", 0.1, 100);
      break;
    case "fire":
      noiseBurst(180, 550, "lowpass", 0.14);
      tone(240, 120, "sawtooth", 0.12, 130);
      setTimeout(() => tone(170, 100, "sawtooth", 0.1, 80), 55);
      setTimeout(() => noiseBurst(80, 400, "lowpass", 0.08), 90);
      break;
    case "water":
      noiseBurst(150, 1200, "bandpass", 0.12);
      tone(480, 100, "sine", 0.11, 260);
      setTimeout(() => tone(360, 110, "triangle", 0.1, 180), 60);
      break;
    case "electric":
      noiseBurst(70, 2800, "highpass", 0.13);
      tone(920, 45, "square", 0.14);
      setTimeout(() => tone(1400, 60, "square", 0.12), 40);
      setTimeout(() => tone(700, 90, "sawtooth", 0.1, 180), 90);
      break;
    case "ice":
      tone(1180, 70, "triangle", 0.1, 760);
      setTimeout(() => tone(980, 85, "sine", 0.09, 620), 45);
      setTimeout(() => hiss(95, 0.07), 50);
      break;
    case "grass":
      noiseBurst(110, 1600, "bandpass", 0.1);
      tone(380, 90, "triangle", 0.12, 560);
      setTimeout(() => tone(520, 100, "sine", 0.1), 55);
      break;
    case "rock":
      noiseBurst(140, 450, "lowpass", 0.13);
      tone(130, 100, "square", 0.12, 70);
      setTimeout(() => noiseBurst(90, 700, "bandpass", 0.09), 50);
      break;
    case "ground":
      noiseBurst(150, 340, "lowpass", 0.14);
      tone(100, 120, "square", 0.12, 45);
      setTimeout(() => tone(72, 130, "square", 0.1, 40), 55);
      break;
    case "wind":
      hiss(150, 0.1);
      tone(420, 100, "sine", 0.08, 680);
      setTimeout(() => tone(560, 90, "triangle", 0.08, 820), 40);
      break;
    case "psychic":
      tone(520, 120, "sine", 0.1, 840);
      setTimeout(() => tone(840, 90, "triangle", 0.09, 620), 40);
      setTimeout(() => shimmer(760), 80);
      break;
    case "ghost":
      tone(260, 170, "triangle", 0.1, 120);
      hiss(110, 0.08);
      setTimeout(() => tone(180, 140, "sine", 0.08, 90), 70);
      break;
    case "poison":
      tone(300, 120, "sawtooth", 0.1, 190);
      setTimeout(() => tone(190, 140, "triangle", 0.09, 130), 45);
      setTimeout(() => hiss(80, 0.06), 65);
      break;
    case "steel":
      tone(760, 50, "square", 0.1);
      setTimeout(() => tone(1020, 70, "square", 0.09, 680), 20);
      setTimeout(() => noiseBurst(55, 2400, "bandpass", 0.08), 30);
      break;
    case "dragon":
      tone(180, 120, "sawtooth", 0.12, 420);
      setTimeout(() => tone(320, 130, "sawtooth", 0.11, 800), 70);
      setTimeout(() => hiss(90, 0.07), 80);
      break;
    case "fairy":
      shimmer(920);
      setTimeout(() => tone(1120, 120, "sine", 0.08), 70);
      break;
    case "dark":
      tone(220, 130, "square", 0.1, 80);
      setTimeout(() => hiss(120, 0.08), 25);
      setTimeout(() => tone(140, 110, "triangle", 0.09, 70), 70);
      break;
    case "bug":
      tone(620, 60, "square", 0.08);
      setTimeout(() => tone(680, 55, "square", 0.08), 40);
      setTimeout(() => tone(560, 65, "square", 0.08), 85);
      break;
    case "contact":
      damageThud();
      tone(140, 80, "square", 0.13, 55);
      break;
    case "energy":
      noiseBurst(130, 1000, "bandpass", 0.11);
      tone(320, 120, "sine", 0.12, 560);
      setTimeout(() => tone(580, 100, "triangle", 0.11), 75);
      break;
    case "crit":
      tone(360, 80, "square", 0.15);
      setTimeout(() => tone(480, 90, "square", 0.13), 55);
      noiseBurst(100, 1400, "bandpass", 0.1);
      break;
    case "superEffective":
      tone(280, 90, "sawtooth", 0.14);
      setTimeout(() => tone(420, 110, "sawtooth", 0.12), 70);
      noiseBurst(120, 1800, "bandpass", 0.12);
      break;
    case "miss":
      tone(150, 140, "triangle", 0.08, 55);
      break;
    case "faint":
      tone(240, 200, "sine", 0.12, 60);
      noiseBurst(160, 350, "lowpass", 0.08);
      break;
    case "ball":
      tone(500, 70, "sine", 0.1);
      setTimeout(() => tone(640, 90, "sine", 0.1), 90);
      break;
    case "badge":
      tone(523, 110, "sine", 0.12);
      setTimeout(() => tone(659, 110, "sine", 0.12), 110);
      setTimeout(() => tone(784, 180, "sine", 0.14), 220);
      break;
    case "status":
      tone(320, 160, "triangle", 0.1, 210);
      break;
    case "levelUp":
      tone(392, 100, "sine", 0.12);
      setTimeout(() => tone(523, 110, "sine", 0.13), 90);
      setTimeout(() => tone(659, 120, "sine", 0.13), 190);
      setTimeout(() => tone(784, 200, "triangle", 0.15), 300);
      break;
    case "evolve":
      tone(220, 180, "sine", 0.1, 440);
      setTimeout(() => tone(440, 150, "triangle", 0.12, 660), 180);
      setTimeout(() => tone(660, 130, "sine", 0.13), 340);
      setTimeout(() => tone(880, 240, "triangle", 0.15), 480);
      break;
    case "heal":
      tone(440, 80, "sine", 0.1);
      setTimeout(() => tone(554, 100, "sine", 0.11), 70);
      setTimeout(() => tone(659, 130, "triangle", 0.12), 150);
      break;
    case "restorePp":
      tone(540, 70, "triangle", 0.09);
      setTimeout(() => tone(640, 90, "sine", 0.1), 80);
      setTimeout(() => tone(760, 110, "triangle", 0.11), 160);
      break;
  }
}

export function playBattleSfx(kind: SfxKind) {
  getCtx();
  if (playSample(kind)) return;

  // Sample aún no listo: pide carga y usa synth esta vez.
  void loadSample(kind).then((el) => {
    // Si llegó tarde al mismo frame no importa; el próximo hit ya tendrá sample.
    if (el) sampleCache.set(kind, { status: "ready", el });
  });
  playSynth(kind);
}

export function battleSfxForMove(
  moveType: string,
  category?: "PHYSICAL" | "SPECIAL" | "STATUS",
): SfxKind {
  if (category === "PHYSICAL") {
    const physicalByType: Record<string, SfxKind> = {
      rock: "rock",
      ground: "ground",
      steel: "steel",
      bug: "bug",
      flying: "wind",
      poison: "poison",
      ghost: "ghost",
      dragon: "dragon",
      dark: "dark",
      fire: "fire",
      water: "water",
      electric: "electric",
      grass: "grass",
      ice: "ice",
      fairy: "fairy",
      psychic: "psychic",
    };
    return physicalByType[moveType.toLowerCase()] ?? "contact";
  }

  const byType: Record<string, SfxKind> = {
    fire: "fire",
    water: "water",
    electric: "electric",
    grass: "grass",
    ice: "ice",
    rock: "rock",
    ground: "ground",
    flying: "wind",
    psychic: "psychic",
    ghost: "ghost",
    poison: "poison",
    steel: "steel",
    dragon: "dragon",
    fairy: "fairy",
    dark: "dark",
    bug: "bug",
    normal: "hit",
    fighting: "contact",
  };
  return byType[moveType.toLowerCase()] ?? "energy";
}

/** Desbloquea AudioContext y arranca la precarga de samples de pelea. */
export function unlockBattleAudio() {
  getCtx();
  preloadBattleSfx();
}
