"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getBattleBgmVolume,
  isBattleBgmMuted,
  setBattleBgmMuted,
  setBattleBgmVolume,
} from "@/lib/battle-bgm";
import {
  getBattleSfxVolume,
  isBattleSfxMuted,
  setBattleSfxMuted,
  setBattleSfxVolume,
} from "@/lib/battle-sfx";
import { BATTLE_SPEEDS, getBattleSpeed, setBattleSpeed, type BattleSpeed } from "@/lib/battle-speed";
import { getGameSettings, updateGameSettings, type GameSettings } from "@/lib/game-settings";
import {
  getWorldBgmVolume,
  isWorldBgmMuted,
  setWorldBgmMuted,
  setWorldBgmVolume,
} from "@/lib/world-bgm";

type AudioState = { music: number; effects: number; musicMuted: boolean; effectsMuted: boolean };
const INITIAL_AUDIO: AudioState = { music: 0.28, effects: 0.4, musicMuted: false, effectsMuted: false };

export function GameSettingsPanel() {
  const t = useTranslations("settings");
  const [audio, setAudio] = useState(INITIAL_AUDIO);
  const [speed, setSpeed] = useState<BattleSpeed>(1);
  const [settings, setSettings] = useState<GameSettings>(() => ({
    autoStrategy: "balanced",
    autoStopHpPercent: 15,
    reducedMotion: false,
    flashes: true,
  }));

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setSettings(getGameSettings());
      setSpeed(getBattleSpeed());
      setAudio({
        music: Math.round(((getWorldBgmVolume() + getBattleBgmVolume()) / 2) * 100) / 100,
        effects: getBattleSfxVolume(),
        musicMuted: isWorldBgmMuted() && isBattleBgmMuted(),
        effectsMuted: isBattleSfxMuted(),
      });
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function patch(next: Partial<GameSettings>) {
    setSettings(updateGameSettings(next));
  }

  function setMusic(value: number) {
    setWorldBgmVolume(value);
    setBattleBgmVolume(value);
    setAudio((old) => ({ ...old, music: value }));
  }

  function setEffects(value: number) {
    setBattleSfxVolume(value);
    setAudio((old) => ({ ...old, effects: value }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SettingsCard icon="volume_up" title={t("audio.title")} subtitle={t("audio.subtitle")}>
        <RangeRow label={t("audio.music")} value={audio.music} muted={audio.musicMuted} onChange={setMusic} />
        <RangeRow label={t("audio.effects")} value={audio.effects} muted={audio.effectsMuted} onChange={setEffects} />
        <div className="grid grid-cols-2 gap-2">
          <ToggleButton
            active={!audio.musicMuted}
            label={t("audio.musicToggle")}
            onClick={() => {
              const muted = !audio.musicMuted;
              setWorldBgmMuted(muted);
              setBattleBgmMuted(muted);
              setAudio((old) => ({ ...old, musicMuted: muted }));
            }}
          />
          <ToggleButton
            active={!audio.effectsMuted}
            label={t("audio.effectsToggle")}
            onClick={() => {
              const muted = !audio.effectsMuted;
              setBattleSfxMuted(muted);
              setAudio((old) => ({ ...old, effectsMuted: muted }));
            }}
          />
        </div>
      </SettingsCard>

      <SettingsCard icon="swords" title={t("battle.title")} subtitle={t("battle.subtitle")}>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">{t("battle.speed")}</p>
          <div className="grid grid-cols-3 gap-2">
            {BATTLE_SPEEDS.map((value) => (
              <button key={value} type="button" onClick={() => { setBattleSpeed(value); setSpeed(value); }} className={`rounded-xl border px-3 py-2 text-sm font-black transition ${speed === value ? "border-primary/55 bg-primary/16 text-primary" : "border-white/10 bg-black/20 text-white/60 hover:bg-white/6"}`}>
                {value}×
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ToggleButton active={!settings.reducedMotion} label={t("battle.animations")} onClick={() => patch({ reducedMotion: !settings.reducedMotion })} />
          <ToggleButton active={settings.flashes} label={t("battle.flashes")} onClick={() => patch({ flashes: !settings.flashes })} />
        </div>
      </SettingsCard>

      <SettingsCard icon="autorenew" title={t("auto.title")} subtitle={t("auto.subtitle")} wide>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["conservative", "balanced", "aggressive"] as const).map((strategy) => (
            <button key={strategy} type="button" onClick={() => patch({ autoStrategy: strategy })} className={`rounded-xl border p-3 text-left transition ${settings.autoStrategy === strategy ? "border-secondary/55 bg-secondary/12" : "border-white/10 bg-black/20 hover:bg-white/5"}`}>
              <span className="block text-sm font-bold text-white">{t(`auto.${strategy}`)}</span>
              <span className="mt-1 block text-[11px] leading-snug text-white/45">{t(`auto.${strategy}Hint`)}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
          <span>
            <span className="block text-sm font-semibold text-white">{t("auto.stop")}</span>
            <span className="block text-[11px] text-white/40">{t("auto.stopHint")}</span>
          </span>
          <select value={settings.autoStopHpPercent} onChange={(event) => patch({ autoStopHpPercent: Number(event.target.value) })} className="rounded-lg border border-white/15 bg-[#11141a] px-2 py-1.5 text-sm font-bold text-white">
            {[0, 10, 15, 20, 30].map((value) => <option key={value} value={value}>{value === 0 ? t("auto.never") : `${value}%`}</option>)}
          </select>
        </label>
      </SettingsCard>
    </div>
  );
}

function SettingsCard({ icon, title, subtitle, wide = false, children }: { icon: string; title: string; subtitle: string; wide?: boolean; children: React.ReactNode }) {
  return <section className={`rounded-2xl border border-white/10 bg-[#15171d]/92 p-4 shadow-[0_18px_40px_rgba(0,0,0,.25)] sm:p-5 ${wide ? "lg:col-span-2" : ""}`}>
    <header className="mb-4 flex items-start gap-3 border-b border-white/8 pb-3">
      <span className="material-symbols-outlined rounded-xl bg-white/6 p-2 text-[20px]! text-primary">{icon}</span>
      <span><h2 className="text-base font-bold text-white">{title}</h2><p className="mt-0.5 text-xs text-white/45">{subtitle}</p></span>
    </header>
    <div className="space-y-4">{children}</div>
  </section>;
}

function RangeRow({ label, value, muted, onChange }: { label: string; value: number; muted: boolean; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1.5 flex justify-between text-xs font-semibold text-white/70"><span>{label}</span><span>{muted ? "OFF" : `${Math.round(value * 100)}%`}</span></span><input aria-label={label} type="range" min="0" max="1" step="0.05" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-primary" /></label>;
}

function ToggleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" role="switch" aria-checked={active} onClick={onClick} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${active ? "border-primary/35 bg-primary/10 text-white" : "border-white/10 bg-black/20 text-white/45"}`}><span>{label}</span><span className={`h-4 w-7 rounded-full p-0.5 transition ${active ? "bg-primary" : "bg-white/15"}`}><span className={`block h-3 w-3 rounded-full bg-white transition-transform ${active ? "translate-x-3" : ""}`} /></span></button>;
}
