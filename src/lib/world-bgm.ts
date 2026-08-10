"use client";

/**
 * BGM ambiental fuera de combate.
 * - `home`: casi toda la app (persiste al cambiar de menú; no reinicia la pista).
 * - `store`: mercado / tienda.
 * - `null`: batalla / auth — corta el ambiental (la pelea usa su BGM).
 *
 * Mute = pause + volume 0 (más fiable que sólo `audio.muted` en iOS).
 */

export type WorldBgmKind = "home" | "store";

const STORAGE_MUTE = "world-bgm-muted";
const STORAGE_VOLUME = "world-bgm-volume";
export const DEFAULT_WORLD_BGM_VOLUME = 0.28;
export const WORLD_BGM_MUTE_EVENT = "world-bgm-mute-change";

const TRACK: Record<WorldBgmKind, string> = {
  home: "/audio/music_home.mp3",
  store: "/audio/music_store.mp3",
};

let audio: HTMLAudioElement | null = null;
let currentKind: WorldBgmKind | null = null;
let unlocked = false;

export function worldBgmUrl(kind: WorldBgmKind): string {
  return TRACK[kind];
}

export function isWorldBgmMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_MUTE) === "1";
}

export function getWorldBgmVolume(): number {
  if (typeof window === "undefined") return DEFAULT_WORLD_BGM_VOLUME;
  const raw = window.localStorage.getItem(STORAGE_VOLUME);
  if (raw == null) return DEFAULT_WORLD_BGM_VOLUME;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_WORLD_BGM_VOLUME;
  return Math.min(1, Math.max(0, n));
}

function emitMuteChange(muted: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(WORLD_BGM_MUTE_EVENT, { detail: { muted } }),
  );
}

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
  }
  return audio;
}

function applyMuteToElement(el: HTMLAudioElement, muted: boolean) {
  el.muted = muted;
  if (muted) {
    el.pause();
    el.volume = 0;
  } else {
    el.volume = getWorldBgmVolume();
  }
}

export function setWorldBgmMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_MUTE, muted ? "1" : "0");
  if (audio) {
    applyMuteToElement(audio, muted);
    if (!muted && unlocked && currentKind) {
      void audio.play().catch(() => {});
    }
  }
  emitMuteChange(muted);
}

export function setWorldBgmVolume(volume: number) {
  if (typeof window === "undefined") return;
  const v = Math.min(1, Math.max(0, volume));
  window.localStorage.setItem(STORAGE_VOLUME, String(v));
  if (audio && !isWorldBgmMuted()) {
    audio.volume = v;
    audio.muted = false;
  }
}

/** Primer gesto del usuario — obligatorio por autoplay policies. */
export function unlockWorldBgm() {
  unlocked = true;
  if (!audio || isWorldBgmMuted() || !currentKind) return;
  applyMuteToElement(audio, false);
  void audio.play().catch(() => {});
}

function isSameTrack(el: HTMLAudioElement, kind: WorldBgmKind): boolean {
  if (currentKind !== kind) return false;
  const src = el.currentSrc || el.src || "";
  return src.includes(TRACK[kind]);
}

export function startWorldBgm(kind: WorldBgmKind) {
  if (typeof window === "undefined") return;
  const el = ensureAudio();
  const muted = isWorldBgmMuted();

  if (!isSameTrack(el, kind)) {
    currentKind = kind;
    el.src = worldBgmUrl(kind);
  } else {
    currentKind = kind;
  }

  applyMuteToElement(el, muted);
  if (muted || !unlocked) return;

  if (el.paused) {
    void el.play().catch(() => {
      /* autoplay bloqueado hasta unlockWorldBgm */
    });
  }
}

export function stopWorldBgm() {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  currentKind = null;
}

/** Pausa sin perder la pista (p. ej. al entrar a batalla). */
export function pauseWorldBgm() {
  if (!audio) return;
  audio.pause();
}

export function resumeWorldBgm() {
  if (!audio || !currentKind || isWorldBgmMuted() || !unlocked) return;
  applyMuteToElement(audio, false);
  void audio.play().catch(() => {});
}

/**
 * Home music en toda la app salvo tienda (otra pista) y batalla/auth.
 */
export function worldBgmKindForPath(pathname: string): WorldBgmKind | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/login" || path === "/register") return null;
  if (path === "/battle" || path.startsWith("/battle/")) return null;
  if (path === "/market" || path.startsWith("/market/")) return "store";
  if (path === "/shop" || path.startsWith("/shop/")) return "store";
  return "home";
}
