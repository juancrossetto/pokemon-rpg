"use client";

/**
 * SFX cortos del PC (Web Audio): intercambio, guardar, retirar, reordenar.
 * Usa el volumen de efectos; el mute de batalla no los apaga.
 */

import { getUiSfxVolume } from "@/lib/battle-sfx";

export type PcSfxKind = "swap" | "store" | "withdraw" | "reorder" | "select";

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
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

/** Desbloquea AudioContext en el primer gesto de arrastre. */
export function unlockPcAudio() {
  getCtx();
}

export function playPcSfx(kind: PcSfxKind) {
  const audio = getCtx();
  if (!audio) return;

  const vol = getUiSfxVolume() * 0.55;
  if (vol <= 0) return;
  const now = audio.currentTime + 0.01;

  if (kind === "swap") {
    tone(audio, 520, now, 0.08, vol * 0.45, "triangle");
    tone(audio, 780, now + 0.07, 0.1, vol * 0.5, "sine");
    tone(audio, 620, now + 0.14, 0.12, vol * 0.35, "triangle");
    return;
  }

  if (kind === "store") {
    tone(audio, 640, now, 0.07, vol * 0.4, "sine");
    tone(audio, 420, now + 0.06, 0.14, vol * 0.45, "triangle");
    return;
  }

  if (kind === "withdraw") {
    tone(audio, 380, now, 0.07, vol * 0.4, "triangle");
    tone(audio, 680, now + 0.06, 0.12, vol * 0.5, "sine");
    return;
  }

  if (kind === "select") {
    tone(audio, 540, now, 0.05, vol * 0.32, "triangle");
    tone(audio, 720, now + 0.04, 0.07, vol * 0.28, "sine");
    return;
  }

  // reorder
  tone(audio, 480, now, 0.05, vol * 0.3, "sine");
  tone(audio, 560, now + 0.045, 0.06, vol * 0.28, "triangle");
}
