/**
 * Chime descendente al gastar energía/gemas (inverso del collect de loot).
 * Respeta mute/volumen de SFX de batalla.
 */
import { getBattleSfxVolume, isBattleSfxMuted } from "@/lib/battle-sfx";

let sfxCtx: AudioContext | null = null;

function getSfxCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sfxCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      sfxCtx = new AC();
    }
    if (sfxCtx.state === "suspended") void sfxCtx.resume();
    return sfxCtx;
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

export function playResourceSpendSfx(): void {
  if (isBattleSfxMuted()) return;
  const audio = getSfxCtx();
  if (!audio) return;
  const vol = getBattleSfxVolume() * 0.42;
  if (vol <= 0) return;
  const now = audio.currentTime + 0.01;
  tone(audio, 720, now, 0.06, vol * 0.3, "triangle");
  tone(audio, 480, now + 0.05, 0.08, vol * 0.28, "sine");
  tone(audio, 320, now + 0.1, 0.1, vol * 0.22, "sine");
}
