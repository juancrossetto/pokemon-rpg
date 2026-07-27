"use client";

/**
 * SFX de batalla con Web Audio (sin assets).
 * Silencioso si el browser bloquea audio hasta un gesto del usuario.
 */

export type SfxKind =
  | "hit"
  | "damage"
  | "fire"
  | "water"
  | "electric"
  | "grass"
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

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

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

function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === audio.sampleRate) return noiseBuffer;
  const length = Math.floor(audio.sampleRate * 0.25);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
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

/** Burst de ruido filtrado — cuerpo de impactos / fuego / agua. */
function noiseBurst(
  durationMs: number,
  filterFreq: number,
  filterType: BiquadFilterType = "bandpass",
  gain = 0.1,
) {
  const audio = getCtx();
  if (!audio) return;
  const now = audio.currentTime;
  const src = audio.createBufferSource();
  src.buffer = getNoiseBuffer(audio);
  const filter = audio.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, now);
  filter.Q.setValueAtTime(1.1, now);
  const g = audio.createGain();
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  src.connect(filter);
  filter.connect(g);
  g.connect(audio.destination);
  src.start(now);
  src.stop(now + durationMs / 1000 + 0.02);
}

/** Golpe “thud” al recibir daño — siempre encima del SFX tipado. */
function damageThud() {
  noiseBurst(90, 280, "lowpass", 0.16);
  tone(95, 110, "square", 0.12, 45);
  setTimeout(() => noiseBurst(50, 900, "bandpass", 0.08), 30);
}

export function playBattleSfx(kind: SfxKind) {
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
    case "grass":
      noiseBurst(110, 1600, "bandpass", 0.1);
      tone(380, 90, "triangle", 0.12, 560);
      setTimeout(() => tone(520, 100, "sine", 0.1), 55);
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

/** Desbloquea AudioContext tras el primer click del menú de pelea. */
export function unlockBattleAudio() {
  getCtx();
}
