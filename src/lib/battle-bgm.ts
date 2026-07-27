"use client";

/**
 * BGM de batalla (Matthew Pablo — "The Last Encounter", CC-BY-SA 3.0).
 * @see public/audio/battle/CREDITS.txt
 */

export type BattleBgmKind = "wild" | "boss";

const STORAGE_MUTE = "battle-bgm-muted";
const STORAGE_VOLUME = "battle-bgm-volume";
const DEFAULT_VOLUME = 0.22;

let audio: HTMLAudioElement | null = null;
let currentKind: BattleBgmKind | null = null;

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
}

export function setBattleBgmVolume(volume: number) {
  if (typeof window === "undefined") return;
  const v = Math.min(1, Math.max(0, volume));
  window.localStorage.setItem(STORAGE_VOLUME, String(v));
  if (audio) {
    audio.volume = v;
    // Bajar a 0 ≈ mute práctico, pero no pisa el flag de mute explícito.
    if (v > 0 && audio.muted && !isBattleBgmMuted()) {
      audio.muted = false;
    }
  }
}

export function startBattleBgm(kind: BattleBgmKind) {
  if (typeof window === "undefined") return;
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
