"use client";

/**
 * BGM de batalla (Matthew Pablo — "The Last Encounter", CC-BY-SA 3.0).
 * Victoria: fanfarria corta de cynicmusic (CC0). Derrota: frase Web Audio.
 * @see public/audio/battle/CREDITS.txt
 */

export type BattleBgmKind = "wild" | "boss";
export type ResultBgmKind = "victory" | "defeat";

const STORAGE_MUTE = "battle-bgm-muted";
const STORAGE_VOLUME = "battle-bgm-volume";
export const DEFAULT_BATTLE_BGM_VOLUME = 0.22;
/** La fanfarria de victoria: un poco por debajo del loop de pelea (era 1.6, muy alta). */
const RESULT_BGM_VOLUME_BOOST = 0.8;
const VICTORY_BGM_SRC = "/audio/battle/victory.m4a?v=2";


let audio: HTMLAudioElement | null = null;
let currentKind: BattleBgmKind | null = null;

let resultCtx: AudioContext | null = null;
let resultNodes: AudioNode[] = [];
let resultTimers: number[] = [];
let resultLoopTimer: number | null = null;
let resultKind: ResultBgmKind | null = null;
let resultAudio: HTMLAudioElement | null = null;
/** Generación de la fanfarria activa — evita que el cleanup de Strict Mode
 *  mate el play del remount siguiente. */
let resultPlayGen = 0;

export function battleBgmUrl(kind: BattleBgmKind): string {
  return kind === "boss" ? "/audio/battle/boss-battle.m4a" : "/audio/battle/wild-battle.m4a";
}

export function isBattleBgmMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_MUTE) === "1";
}

export function getBattleBgmVolume(): number {
  if (typeof window === "undefined") return DEFAULT_BATTLE_BGM_VOLUME;
  const raw = window.localStorage.getItem(STORAGE_VOLUME);
  if (raw == null) return DEFAULT_BATTLE_BGM_VOLUME;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_BATTLE_BGM_VOLUME;
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
    // Solo reanuda si el clip todavía no terminó (victoria es one-shot).
    if (!muted && resultAudio.paused && !resultAudio.ended) {
      void resultAudio.play().catch(() => {});
    }
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
  if (resultAudio) {
    resultAudio.volume = Math.min(1, v * RESULT_BGM_VOLUME_BOOST);
  }
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
  // Precarga la fanfarria para que suene al instante al ganar.
  const warm = new Audio();
  warm.preload = "auto";
  warm.src = VICTORY_BGM_SRC;
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

/** Para la BGM de pelea y reproduce el tema de victoria/derrota una sola vez.
 *  Devuelve un id de generación para que `stopResultBgm(id)` solo detenga
 *  esa reproducción (Strict Mode / remounts). */
export function startResultBgm(kind: ResultBgmKind): number {
  if (typeof window === "undefined") return 0;
  stopBattleBgm();
  // Invalidar play anterior sin exigir id (arranque limpio).
  resultPlayGen += 1;
  const playGen = resultPlayGen;
  if (resultAudio) {
    resultAudio.pause();
    resultAudio = null;
  }
  clearResultSchedule();
  resultKind = null;

  if (isBattleBgmMuted()) return playGen;

  // Victoria: fanfarria dedicada — una sola pasada, no loop de pantalla de resultado.
  if (kind === "victory") {
    resultKind = kind;
    const el = new Audio();
    resultAudio = el;
    el.preload = "auto";
    el.loop = false;
    el.volume = Math.min(1, getBattleBgmVolume() * RESULT_BGM_VOLUME_BOOST);
    el.src = VICTORY_BGM_SRC;

    const tryPlay = () => {
      if (playGen !== resultPlayGen || resultAudio !== el) return;
      void el.play().catch(() => {});
    };
    el.addEventListener("canplaythrough", tryPlay, { once: true });
    tryPlay();
    return playGen;
  }

  // Derrota: fanfarria Web Audio (una frase, sin repetir).
  const audioCtx = getResultCtx();
  if (!audioCtx) return playGen;
  resultKind = kind;
  const vol = Math.max(0.05, getBattleBgmVolume());
  scheduleDefeatPhrase(audioCtx, audioCtx.currentTime + 0.02, vol);
  return playGen;
}

/** Detiene la fanfarria. Si pasás `playGen`, solo corta si sigue siendo esa. */
export function stopResultBgm(playGen?: number) {
  if (playGen != null && playGen !== resultPlayGen) return;
  resultPlayGen += 1;
  if (resultAudio) {
    resultAudio.pause();
    resultAudio = null;
  }
  clearResultSchedule();
  resultKind = null;
}

/*
  Tema de evolución: pieza corta sintetizada (scripts/generate-evolution-theme.py)
  alineada a las fases del popup. Una sola pasada, sin loop, y con su propia
  referencia para que abrir dos evoluciones seguidas no deje dos sonando.
*/
const EVOLUTION_BGM_SRC = "/audio/battle/evolution.m4a";
const EVOLUTION_BGM_VOLUME_BOOST = 1.15;
let evolutionAudio: HTMLAudioElement | null = null;

export function startEvolutionBgm() {
  if (typeof window === "undefined") return;
  stopEvolutionBgm();
  if (isBattleBgmMuted()) return;

  const el = new Audio();
  evolutionAudio = el;
  el.preload = "auto";
  el.loop = false;
  el.volume = Math.min(1, getBattleBgmVolume() * EVOLUTION_BGM_VOLUME_BOOST);
  el.src = EVOLUTION_BGM_SRC;

  const tryPlay = () => {
    if (evolutionAudio !== el) return;
    void el.play().catch(() => {});
  };
  el.addEventListener("canplaythrough", tryPlay, { once: true });
  tryPlay();
}

export function stopEvolutionBgm() {
  if (!evolutionAudio) return;
  evolutionAudio.pause();
  evolutionAudio = null;
}

/*
  Ascenso de rango PvP: reusa la fanfarria de victoria. El popup aparece al
  entrar al hub o al home (nunca sobre la pantalla de resultado), así que no
  compite con `startResultBgm` — pero lleva su propia referencia para no
  depender del `resultPlayGen` compartido. El corte es con fade porque el
  clip dura ~12 s y el popup mucho menos: cortarlo en seco se nota.
*/
const RANK_UP_BGM_VOLUME_BOOST = 0.9;
let rankUpAudio: HTMLAudioElement | null = null;
let rankUpFade: number | null = null;

export function startRankUpBgm() {
  if (typeof window === "undefined") return;
  stopRankUpBgm();
  if (isBattleBgmMuted()) return;

  const el = new Audio();
  rankUpAudio = el;
  el.preload = "auto";
  el.loop = false;
  el.volume = Math.min(1, getBattleBgmVolume() * RANK_UP_BGM_VOLUME_BOOST);
  el.src = VICTORY_BGM_SRC;

  const tryPlay = () => {
    if (rankUpAudio !== el) return;
    void el.play().catch(() => {});
  };
  el.addEventListener("canplaythrough", tryPlay, { once: true });
  tryPlay();
}

/** `fadeMs` > 0 baja el volumen antes de cortar. */
export function stopRankUpBgm(fadeMs = 0) {
  if (rankUpFade != null) {
    window.clearInterval(rankUpFade);
    rankUpFade = null;
  }
  const el = rankUpAudio;
  if (!el) return;
  if (fadeMs <= 0) {
    el.pause();
    rankUpAudio = null;
    return;
  }
  const step = 50;
  const drop = el.volume / Math.max(1, fadeMs / step);
  rankUpFade = window.setInterval(() => {
    if (rankUpAudio !== el) {
      if (rankUpFade != null) window.clearInterval(rankUpFade);
      rankUpFade = null;
      return;
    }
    el.volume = Math.max(0, el.volume - drop);
    if (el.volume <= 0.01) {
      el.pause();
      rankUpAudio = null;
      if (rankUpFade != null) window.clearInterval(rankUpFade);
      rankUpFade = null;
    }
  }, step);
}
