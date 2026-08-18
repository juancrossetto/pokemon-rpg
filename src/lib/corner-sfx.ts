"use client";

/**
 * Jingle de la ruleta: un loop corto de feria (organillo + ticks de rodillo)
 * mientras giran, y un cierre al frenar. Usa el volumen/mute de música; los
 * ticks de frenada también, porque es parte de la misma pista, no un SFX de
 * combate. Si el jugador silenció la música, la máquina no pita.
 */

import { duckWorldBgm, getWorldBgmVolume, isWorldBgmMuted, unduckWorldBgm } from "@/lib/world-bgm";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let loopTimer: ReturnType<typeof setTimeout> | null = null;
let nextBeat = 0;
let phrase = 0;
let playing = false;

const STEP = 0.105;
/** Do mayor de feria: C E G C' G E D G */
const MELODY = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 587.33, 392];
const BASS = [130.81, 98, 146.83, 130.81];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    document.documentElement.dataset.reduceMotion === "1" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
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

function musicVol(): number {
  if (isWorldBgmMuted()) return 0;
  return getWorldBgmVolume() * 0.85;
}

function tone(
  audio: AudioContext,
  dest: AudioNode,
  freq: number,
  when: number,
  dur: number,
  vol: number,
  type: OscillatorType = "square",
) {
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

function click(audio: AudioContext, dest: AudioNode, when: number, vol: number) {
  tone(audio, dest, 1680, when, 0.028, vol * 0.22, "square");
  tone(audio, dest, 2400, when, 0.016, vol * 0.12, "triangle");
}

function ensureMaster(audio: AudioContext): GainNode {
  if (!master) {
    master = audio.createGain();
    master.gain.value = 1;
    master.connect(audio.destination);
  }
  return master;
}

function schedulePhrase(audio: AudioContext, dest: GainNode, vol: number) {
  const start = nextBeat;
  for (let i = 0; i < MELODY.length; i += 1) {
    const t = start + i * STEP;
    nextBeat = t + STEP;
    const note = MELODY[(i + (phrase % 2) * 2) % MELODY.length]!;
    tone(audio, dest, note, t, 0.09, vol * (i % 2 === 0 ? 0.22 : 0.16), "square");
    tone(audio, dest, note * 2, t, 0.05, vol * 0.05, "triangle");
    if (i % 2 === 0) {
      tone(audio, dest, BASS[(i / 2) % BASS.length]!, t, 0.18, vol * 0.2, "triangle");
    }
    click(audio, dest, t, vol * (i % 2 === 0 ? 1 : 0.55));
  }
  phrase += 1;
}

function pump() {
  const audio = ctx;
  if (!audio || !playing || !master) return;
  const vol = musicVol();
  if (vol <= 0) {
    loopTimer = setTimeout(pump, 80);
    return;
  }
  while (nextBeat < audio.currentTime + 0.28) {
    schedulePhrase(audio, master, vol);
  }
  loopTimer = setTimeout(pump, 90);
}

function cutLoop() {
  playing = false;
  if (loopTimer != null) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
}

/** Arranca el loop del giro y baja el BGM del mundo. */
export function startCornerSpinMusic() {
  const audio = getCtx();
  if (!audio) return;
  cutLoop();
  if (prefersReducedMotion()) return;
  const vol = musicVol();
  if (vol <= 0) return;

  duckWorldBgm(0.18);
  const dest = ensureMaster(audio);
  dest.gain.cancelScheduledValues(audio.currentTime);
  dest.gain.setValueAtTime(1, audio.currentTime);

  playing = true;
  phrase = 0;
  nextBeat = audio.currentTime + 0.02;
  // Subidita de arranque, típica de palanca.
  tone(audio, dest, 220, nextBeat, 0.09, vol * 0.18, "sawtooth");
  tone(audio, dest, 330, nextBeat + 0.06, 0.1, vol * 0.2, "square");
  tone(audio, dest, 440, nextBeat + 0.12, 0.12, vol * 0.16, "triangle");
  pump();
}

/** Clic de un rodillo al caer. */
export function playCornerReelStop() {
  const audio = getCtx();
  if (!audio || prefersReducedMotion()) return;
  const vol = musicVol();
  if (vol <= 0) return;
  const now = audio.currentTime + 0.005;
  tone(audio, audio.destination, 620, now, 0.05, vol * 0.28, "square");
  tone(audio, audio.destination, 310, now + 0.03, 0.07, vol * 0.18, "triangle");
}

export type CornerSpinTune = "win" | "jackpot" | "lose" | "abort";

/** Corta el loop y, si hubo resultado, toca el cierre. */
export function stopCornerSpinMusic(tune: CornerSpinTune = "abort") {
  const audio = getCtx() ?? ctx;
  cutLoop();
  unduckWorldBgm();
  if (!audio) return;

  const now = audio.currentTime;
  if (master) {
    const current = Math.max(master.gain.value, 0.0001);
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(current, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    master.gain.setValueAtTime(1, now + 0.5);
  }

  if (tune === "abort") return;

  const vol = musicVol();
  if (vol <= 0) return;

  const dest = audio.destination;
  const t = now + 0.09;
  if (tune === "jackpot") {
    tone(audio, dest, 523.25, t, 0.12, vol * 0.28, "square");
    tone(audio, dest, 659.25, t + 0.1, 0.12, vol * 0.3, "square");
    tone(audio, dest, 783.99, t + 0.2, 0.14, vol * 0.32, "square");
    tone(audio, dest, 1046.5, t + 0.32, 0.32, vol * 0.38, "triangle");
    tone(audio, dest, 1318.5, t + 0.36, 0.28, vol * 0.18, "sine");
  } else if (tune === "win") {
    tone(audio, dest, 523.25, t, 0.1, vol * 0.24, "square");
    tone(audio, dest, 659.25, t + 0.09, 0.12, vol * 0.26, "triangle");
    tone(audio, dest, 783.99, t + 0.18, 0.2, vol * 0.22, "sine");
  } else {
    tone(audio, dest, 392, t, 0.1, vol * 0.16, "triangle");
    tone(audio, dest, 293.66, t + 0.1, 0.16, vol * 0.14, "sine");
  }
}
