"use client";

// Pantalla post-captura: ficha del Pokémon atrapado + apodo opcional.
// battle-arena.tsx la muestra a pantalla completa cuando la captura confirma.

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { CapturedPokemonInfo } from "@/actions/attempt-capture";
import { typeColor } from "@/lib/type-colors";
import { StatCell } from "@/components/battle/arena-panels";

export function CaptureSummary({
  info,
  nickname,
  onNicknameChange,
  saving,
  onConfirm,
}: {
  info: CapturedPokemonInfo;
  nickname: string;
  onNicknameChange: (value: string) => void;
  saving: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations("battle");
  const tTeam = useTranslations("team");

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-md flex flex-col items-center gap-4 text-center">
        <p className="text-label-sm uppercase text-tertiary">{t("caughtTitle")}</p>
        {info.sentToPc && (
          <p className="text-label-md text-electric-yellow/90">{t("sentToPcHint")}</p>
        )}

        <div className="w-28 h-28 rounded-full flex items-center justify-center bg-tertiary/10 border-2 border-tertiary/50 shadow-[0_0_20px_rgba(52,211,153,0.3)]">
          <Image src={info.spriteUrl} alt={info.name} width={96} height={96} className="w-24 h-24 object-contain" />
        </div>

        <div>
          <p className="text-headline-md text-on-surface capitalize">{info.name}</p>
          <p className="text-label-sm text-on-surface-variant">{t("level", { level: info.level })}</p>
        </div>

        <div className="flex gap-2">
          {info.types.map((ty) => {
            const color = typeColor(ty);
            return (
              <span
                key={ty}
                className="px-3 py-1 rounded text-label-sm uppercase border"
                style={{ backgroundColor: `${color}33`, color, borderColor: `${color}55` }}
              >
                {ty}
              </span>
            );
          })}
        </div>

        <div className="glass-panel rounded-xl border border-white/10 p-4 w-full grid grid-cols-3 gap-3 text-left">
          <StatCell label={tTeam("stats.hp")} value={info.maxHp} />
          <StatCell label={tTeam("stats.atk")} value={info.stats.attack} />
          <StatCell label={tTeam("stats.def")} value={info.stats.defense} />
          <StatCell label={tTeam("stats.spAtk")} value={info.stats.spAtk} />
          <StatCell label={tTeam("stats.spDef")} value={info.stats.spDef} />
          <StatCell label={tTeam("stats.speed")} value={info.stats.speed} />
        </div>

        <div className="glass-panel rounded-xl border border-white/10 p-4 w-full text-left">
          <p className="text-label-sm uppercase text-on-surface-variant mb-2">{tTeam("moves")}</p>
          <div className="flex flex-col gap-1">
            {info.moves.map((m) => {
              const color = typeColor(m.type);
              return (
                <div key={m.moveId} className="flex justify-between items-center text-label-sm">
                  <span className="text-on-surface">{m.name}</span>
                  <span className="uppercase" style={{ color }}>
                    {m.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full text-left">
          <label className="text-label-sm uppercase text-on-surface-variant mb-1 block">{t("nicknameLabel")}</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
            placeholder={info.name}
            maxLength={20}
            className="w-full glass-panel border border-white/10 rounded-lg px-3 py-2 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50"
          />
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="w-full rounded-lg bg-pokeball-red px-6 py-3 text-label-md text-white font-bold hover:bg-pokeball-red/80 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {t("confirmCapture")}
        </button>
      </div>
    </div>
  );
}
