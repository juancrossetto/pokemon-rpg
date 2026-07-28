"use client";

/**
 * BGM de batalla (Matthew Pablo — "The Last Encounter", CC-BY-SA 3.0).
 * @see public/audio/battle/CREDITS.txt
 *
 * Temas de resultado (victoria / derrota): secuencias Web Audio locales —
 * sin assets externos, se detienen al salir del resumen.
 */

export type BattleBgmKind = "wild" | "boss";
export type ResultBgmKind = "victory" | "defeat";

const STORAGE_MUTE = "battle-bgm-muted";
const STORAGE_VOLUME = "battle-bgm-volume";
const DEFAULT_VOLUME = 0.22;

let audio: HTMLAudioElement | null = null;
let currentKind: BattleBgmKind | null = null;

let resultCtx: AudioContext | null = null;
let resultNodes: AudioNode[] = [];
let resultTimers: number[] = [];
let resultLoopTimer: number | null = null;
let resultKind: ResultBgmKind | null = null;
let resultAudio: HTMLAudioElement | null = null;

export function battleBgmUrl(kind: BattleBgmKind): string {
  return kind === "boss" ? "/audio/battle/boss-battle.m4a" : "/audio/battle/wild-battle.m4a";
}

export function isBattleBgmMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_MUTE) === "1";
}

export function getBattleBgmVolume(): number {
  if (typeof window === "undefined") return DEFAULT_VOLUME;
  const raw = window.localStorage.getItem(STORAGE_VOLUME);
  if (raw == null) return DEFAULT_VOLUME;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, n));
}

export function setBattleBgmMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_MUTE, muted ? "1" : "0");
  if (audio) {
    audio.muted = muted;
    if (!muted && audio.paused) void audio.play().catch(() => {});
  }
  if (resultAudio) {
    resultAudio.muted = muted;
    if (!muted && resultAudio.paused) void resultAudio.play().catch(() => {});
  }
  if (resultCtx && muted) stopResultBgm();
}

export function setBattleBgmVolume(volume: number) {
  if (typeof window === "undefined") return;
  const v = Math.min(1, Math.max(0, volume));
  window.localStorage.setItem(STORAGE_VOLUME, String(v));
  if (audio) {
    audio.volume = v;
    if (v > 0 && audio.muted && !isBattleBgmMuted()) {
      audio.muted = false;
    }
  }
  if (resultAudio) resultAudio.volume = v;
}

export function startBattleBgm(kind: BattleBgmKind) {
  if (typeof window === "undefined") return;
  stopResultBgm();
  const src = battleBgmUrl(kind);
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
  }
  audio.volume = getBattleBgmVolume();
  audio.muted = isBattleBgmMuted();
  if (currentKind !== kind || !audio.src.endsWith(src)) {
    currentKind = kind;
    audio.src = src;
  }
  void audio.play().catch(() => {
    // Autoplay bloqueado hasta gesto — se reintenta en unlock.
  });
}

export function stopBattleBgm() {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  currentKind = null;
}

/** Reanuda tras gesto del usuario (Luchar / menú). */
export function resumeBattleBgm() {
  if (!audio || isBattleBgmMuted()) return;
  void audio.play().catch(() => {});
}

function getResultCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!resultCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      resultCtx = new AC();
    }
    if (resultCtx.state === "suspended") void resultCtx.resume();
    return resultCtx;
  } catch {
    return null;
  }
}

function clearResultSchedule() {
  for (const t of resultTimers) window.clearTimeout(t);
  resultTimers = [];
  if (resultLoopTimer != null) {
    window.clearTimeout(resultLoopTimer);
    resultLoopTimer = null;
  }
  for (const n of resultNodes) {
    try {
      n.disconnect();
    } catch {
      /* already disconnected */
    }
  }
  resultNodes = [];
}

function playResultNote(
  audio: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  gain: number,
  type: OscillatorType = "triangle",
) {
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  g.gain.setValueAtTime(0.0001, startAt);
  g.gain.exponentialRampToValueAtTime(gain, startAt + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
  resultNodes.push(osc, g);
}

function scheduleVictoryPhrase(audio: AudioContext, when: number, vol: number) {
  // Fanfarria mayor alegre (C–E–G–C…), ~2.4s
  const notes: Array<[number, number, number]> = [
    [523.25, 0, 0.28],
    [659.25, 0.22, 0.28],
    [783.99, 0.44, 0.32],
    [1046.5, 0.72, 0.45],
    [783.99, 1.15, 0.22],
    [880.0, 1.35, 0.22],
    [987.77, 1.55, 0.22],
    [1046.5, 1.8, 0.55],
  ];
  for (const [freq, offset, dur] of notes) {
    playResultNote(audio, freq, when + offset, dur, vol * 0.55, "triangle");
    playResultNote(audio, freq / 2, when + offset, dur, vol * 0.2, "sine");
  }
}

function scheduleDefeatPhrase(audio: AudioContext, when: number, vol: number) {
  // Cadencia descendente triste (A–F–E–D…), ~2.8s
  const notes: Array<[number, number, number]> = [
    [440.0, 0, 0.45],
    [349.23, 0.4, 0.45],
    [329.63, 0.85, 0.5],
    [293.66, 1.35, 0.55],
    [261.63, 1.9, 0.7],
    [220.0, 2.4, 0.85],
  ];
  for (const [freq, offset, dur] of notes) {
    playResultNote(audio, freq, when + offset, dur, vol * 0.45, "sine");
    playResultNote(audio, freq * 0.5, when + offset, dur, vol * 0.18, "triangle");
  }
}

/** Para la BGM de pelea y reproduce el tema de victoria/derrota en loop suave. */
export function startResultBgm(kind: ResultBgmKind) {
  if (typeof window === "undefined") return;
  if (isBattleBgmMuted()) return;
  stopBattleBgm();
  stopResultBgm();

  // Victoria: usar clip dedicado (pedido del usuario).
  if (kind === "victory") {
    resultKind = kind;
    if (!resultAudio) {
      resultAudio = new Audio();
      resultAudio.preload = "auto";
    }
    resultAudio.loop = true;
    resultAudio.src = "/audio/battle/sfx/victory.wav";
    resultAudio.volume = getBattleBgmVolume();
    resultAudio.muted = isBattleBgmMuted();
    void resultAudio.play().catch(() => {});
    return;
  }

  const audioCtx = getResultCtx();
  if (!audioCtx) return;
  resultKind = kind;
  const vol = Math.max(0.05, getBattleBgmVolume());
  const phraseMs = kind === "victory" ? 2800 : 3600;

  const playOnce = () => {
    if (resultKind !== kind) return;
    const when = audioCtx.currentTime + 0.02;
    if (kind === "victory") scheduleVictoryPhrase(audioCtx, when, vol);
    else scheduleDefeatPhrase(audioCtx, when, vol);
    resultLoopTimer = window.setTimeout(playOnce, phraseMs);
  };
  playOnce();
}

export function stopResultBgm() {
  if (resultAudio) {
    resultAudio.pause();
    resultAudio.currentTime = 0;
  }
  clearResultSchedule();
  resultKind = null;
}
