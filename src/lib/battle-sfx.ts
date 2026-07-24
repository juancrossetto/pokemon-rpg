"use client";

/**
 * SFX de batalla con Web Audio (sin assets).
 * Silencioso si el browser bloquea audio hasta un gesto del usuario.
 */

type SfxKind = "hit" | "superEffective" | "miss" | "faint" | "ball" | "badge" | "status" | "crit";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  frequency: number,
  durationMs: number,
  type: OscillatorType,
  gain = 0.08,
  slideTo?: number,
) {
  const audio = getCtx();
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + durationMs / 1000);
  }
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

export function playBattleSfx(kind: SfxKind) {
  switch (kind) {
    case "hit":
      tone(180, 90, "square", 0.07, 90);
      break;
    case "crit":
      tone(320, 70, "square", 0.08);
      setTimeout(() => tone(420, 80, "square", 0.07), 60);
      break;
    case "superEffective":
      tone(260, 80, "sawtooth", 0.07);
      setTimeout(() => tone(390, 100, "sawtooth", 0.06), 70);
      break;
    case "miss":
      tone(140, 120, "triangle", 0.04, 60);
      break;
    case "faint":
      tone(220, 180, "sine", 0.06, 70);
      break;
    case "ball":
      tone(480, 60, "sine", 0.05);
      setTimeout(() => tone(620, 80, "sine", 0.05), 90);
      break;
    case "badge":
      tone(523, 100, "sine", 0.06);
      setTimeout(() => tone(659, 100, "sine", 0.06), 110);
      setTimeout(() => tone(784, 160, "sine", 0.07), 220);
      break;
    case "status":
      tone(300, 140, "triangle", 0.05, 200);
      break;
  }
}

/** Desbloquea AudioContext tras el primer click del menú de pelea. */
export function unlockBattleAudio() {
  getCtx();
}
