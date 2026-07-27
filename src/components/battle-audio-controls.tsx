"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getBattleBgmVolume,
  isBattleBgmMuted,
  resumeBattleBgm,
  setBattleBgmMuted,
  setBattleBgmVolume,
  startBattleBgm,
  type BattleBgmKind,
} from "@/lib/battle-bgm";
import { unlockBattleAudio } from "@/lib/battle-sfx";

/**
 * Mute al click; slider de volumen al hover/focus (estilo reproductor).
 * Compacto — no ocupa una barra completa.
 */
export function BattleAudioControls({ bgmKind }: { bgmKind: BattleBgmKind }) {
  const t = useTranslations("battle");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.22);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMuted(isBattleBgmMuted());
    setVolume(getBattleBgmVolume());
    setReady(true);
  }, []);

  function ensurePlaying() {
    unlockBattleAudio();
    startBattleBgm(bgmKind);
    resumeBattleBgm();
  }

  function onToggleMute() {
    ensurePlaying();
    const next = !muted;
    setMuted(next);
    setBattleBgmMuted(next);
  }

  function onVolumeChange(value: number) {
    ensurePlaying();
    setVolume(value);
    setBattleBgmVolume(value);
    if (value > 0 && muted) {
      setMuted(false);
      setBattleBgmMuted(false);
    }
  }

  if (!ready) return null;

  const effectiveMuted = muted || volume === 0;

  return (
    <div
      className="battle-audio-control group absolute top-3 left-3 z-30 flex items-center"
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
        title={effectiveMuted ? t("unmuteMusic") : t("muteMusic")}
        aria-label={effectiveMuted ? t("unmuteMusic") : t("muteMusic")}
        aria-pressed={effectiveMuted}
      >
        <span className="material-symbols-outlined text-[20px]!">
          {effectiveMuted ? "volume_off" : volume < 0.35 ? "volume_down" : "volume_up"}
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          open ? "ml-2 max-w-[9rem] opacity-100" : "max-w-0 opacity-0 pointer-events-none"
        }`}
      >
        <label className="flex h-9 items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 backdrop-blur-sm">
          <span className="sr-only">{t("musicVolume")}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
            className="battle-bgm-slider w-24"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(volume * 100)}
          />
        </label>
      </div>
    </div>
  );
}
