"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DEFAULT_BATTLE_BGM_VOLUME,
  getBattleBgmVolume,
  isBattleBgmMuted,
  resumeBattleBgm,
  setBattleBgmMuted,
  setBattleBgmVolume,
  startBattleBgm,
  type BattleBgmKind,
} from "@/lib/battle-bgm";
import {
  DEFAULT_BATTLE_SFX_VOLUME,
  getBattleSfxVolume,
  isBattleSfxMuted,
  setBattleSfxMuted,
  setBattleSfxVolume,
  unlockBattleAudio,
} from "@/lib/battle-sfx";

/**
 * Mute al click; slider de volumen al hover/focus (estilo reproductor).
 * Compacto — no ocupa una barra completa.
 */
export function BattleAudioControls({ bgmKind }: { bgmKind: BattleBgmKind }) {
  const t = useTranslations("battle");
  // Defaults estables (SSR = cliente) — localStorage se aplica post-mount.
  const [musicMuted, setMusicMuted] = useState(false);
  const [musicVolume, setMusicVolume] = useState(DEFAULT_BATTLE_BGM_VOLUME);
  const [sfxMuted, setSfxMutedState] = useState(false);
  const [sfxVolume, setSfxVolumeState] = useState(DEFAULT_BATTLE_SFX_VOLUME);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMusicMuted(isBattleBgmMuted());
    setMusicVolume(getBattleBgmVolume());
    setSfxMutedState(isBattleSfxMuted());
    setSfxVolumeState(getBattleSfxVolume());
  }, []);

  function ensurePlaying() {
    unlockBattleAudio();
    startBattleBgm(bgmKind);
    resumeBattleBgm();
  }

  function onToggleMute() {
    ensurePlaying();
    const next = !musicMuted;
    setMusicMuted(next);
    setBattleBgmMuted(next);
  }

  function onVolumeChange(value: number) {
    ensurePlaying();
    setMusicVolume(value);
    setBattleBgmVolume(value);
    if (value > 0 && musicMuted) {
      setMusicMuted(false);
      setBattleBgmMuted(false);
    }
  }

  function onToggleSfxMute() {
    ensurePlaying();
    const next = !sfxMuted;
    setSfxMutedState(next);
    setBattleSfxMuted(next);
  }

  function onSfxVolumeChange(value: number) {
    ensurePlaying();
    setSfxVolumeState(value);
    setBattleSfxVolume(value);
    if (value > 0 && sfxMuted) {
      setSfxMutedState(false);
      setBattleSfxMuted(false);
    }
  }

  const effectiveMusicMuted = musicMuted || musicVolume === 0;
  const effectiveSfxMuted = sfxMuted || sfxVolume === 0;

  return (
    <div
      className="battle-audio-control group absolute top-16 left-2 z-30 flex items-center md:top-[4.5rem] md:left-3"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={onToggleMute}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/90 backdrop-blur-sm hover:bg-black/70 hover:border-white/30 transition-colors"
        title={effectiveMusicMuted ? t("unmuteMusic") : t("muteMusic")}
        aria-label={effectiveMusicMuted ? t("unmuteMusic") : t("muteMusic")}
        aria-pressed={effectiveMusicMuted}
      >
        <span className="material-symbols-outlined text-[20px]!">
          {effectiveMusicMuted ? "volume_off" : musicVolume < 0.35 ? "volume_down" : "volume_up"}
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          open ? "ml-2 max-w-[13rem] opacity-100" : "max-w-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-black/55 p-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/90 hover:bg-black/65 hover:border-white/30 transition-colors"
              title={effectiveMusicMuted ? t("unmuteMusic") : t("muteMusic")}
              aria-label={effectiveMusicMuted ? t("unmuteMusic") : t("muteMusic")}
              aria-pressed={effectiveMusicMuted}
            >
              <span className="material-symbols-outlined text-[17px]!">
                {effectiveMusicMuted ? "volume_off" : "music_note"}
              </span>
            </button>
            <label className="flex items-center">
              <span className="sr-only">{t("musicVolume")}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(musicVolume * 100)}
                onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
                className="battle-bgm-slider w-24"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(musicVolume * 100)}
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleSfxMute}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/90 hover:bg-black/65 hover:border-white/30 transition-colors"
              title={effectiveSfxMuted ? t("unmuteSfx") : t("muteSfx")}
              aria-label={effectiveSfxMuted ? t("unmuteSfx") : t("muteSfx")}
              aria-pressed={effectiveSfxMuted}
            >
              <span className="material-symbols-outlined text-[17px]!">
                {effectiveSfxMuted ? "volume_off" : "graphic_eq"}
              </span>
            </button>
            <label className="flex items-center">
              <span className="sr-only">{t("sfxVolume")}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(sfxVolume * 100)}
                onChange={(e) => onSfxVolumeChange(Number(e.target.value) / 100)}
                className="battle-bgm-slider w-24"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(sfxVolume * 100)}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
