"use client";

import { getBattleSfxVolume, isBattleSfxMuted } from "@/lib/battle-sfx";

export type NativeFeedbackKind = "tap" | "confirm" | "navigation" | "reward" | "error";

let audioContext: AudioContext | null = null;
let lastFeedbackAt = 0;

function context(): AudioContext | null {
  if (typeof window === "undefined" || isBattleSfxMuted()) return null;
  try {
    if (!audioContext) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContext = new AudioCtor();
    }
    if (audioContext.state === "suspended") void audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  frequency: number,
  endFrequency: number,
  durationMs: number,
  gain: number,
  delayMs = 0,
) {
  const start = ctx.currentTime + delayMs / 1000;
  const end = start + durationMs / 1000;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), end);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(envelope);
  envelope.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.01);
}

/** Sonidos sintéticos mínimos: respuesta de UI, no una segunda banda sonora. */
export function playNativeFeedback(kind: NativeFeedbackKind) {
  if (typeof window === "undefined") return;
  const now = performance.now();
  if (kind === "tap" && now - lastFeedbackAt < 42) return;
  lastFeedbackAt = now;

  const ctx = context();
  if (!ctx) return;
  const volume = getBattleSfxVolume();
  if (volume <= 0) return;

  switch (kind) {
    case "tap":
      tone(ctx, 720, 560, 34, 0.018 * volume);
      break;
    case "confirm":
      tone(ctx, 520, 680, 58, 0.026 * volume);
      tone(ctx, 760, 920, 68, 0.018 * volume, 38);
      break;
    case "navigation":
      tone(ctx, 300, 480, 90, 0.018 * volume);
      break;
    case "reward":
      tone(ctx, 520, 700, 88, 0.032 * volume);
      tone(ctx, 780, 1040, 120, 0.025 * volume, 62);
      break;
    case "error":
      tone(ctx, 180, 120, 120, 0.028 * volume);
      break;
  }
}

export function vibrateNativeFeedback(kind: NativeFeedbackKind) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const touchDevice =
    navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
  if (!touchDevice) return;
  const pattern: Record<NativeFeedbackKind, number | number[]> = {
    tap: 6,
    navigation: 8,
    confirm: 12,
    reward: [14, 28, 20],
    error: [18, 35, 18],
  };
  navigator.vibrate(pattern[kind]);
}

export function nativeFeedback(kind: NativeFeedbackKind) {
  playNativeFeedback(kind);
  vibrateNativeFeedback(kind);
}
