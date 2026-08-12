"use client";

/**
 * SFX cortos de toasts de UI (desbloqueo de zona, feedback de campaña).
 * Respeta el volumen de efectos; el mute de batalla no los apaga.
 */

import { getUiSfxVolume, playUiSfx } from "@/lib/battle-sfx";

let ctx: AudioContext | null = null;

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

function tone(
  audio: AudioContext,
  freq: number,
  when: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine",
) {
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

/** Chime al aparecer el cartel de desbloqueo. */
export function playUnlockToastAppear() {
  playUiSfx("badge");
}

/** Whoosh suave al salir el cartel. */
export function playUnlockToastDismiss() {
  const audio = getCtx();
  if (!audio) return;
  const vol = getUiSfxVolume() * 0.4;
  if (vol <= 0) return;
  const now = audio.currentTime + 0.01;
  tone(audio, 720, now, 0.08, vol * 0.35, "triangle");
  tone(audio, 480, now + 0.05, 0.12, vol * 0.28, "sine");
  tone(audio, 320, now + 0.1, 0.14, vol * 0.18, "triangle");
}
