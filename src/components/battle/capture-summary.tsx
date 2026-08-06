"use client";

// Pantalla post-captura: ficha del Pokémon + apodo.
// Cabe en el viewport sin scroll por layout (sin huecos muertos), no
// achicando tipografía ni el sprite.

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { CapturedPokemonInfo } from "@/actions/attempt-capture";
import { ShinyMark } from "@/components/shiny-mark";
import { typeColor } from "@/lib/type-colors";
import { useTypeLabel } from "@/hooks/use-type-label";

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-secondary/10 px-2 py-1.5 text-left">
      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-secondary/80">
        {label}
      </p>
      <p className="page-title text-[18px] leading-none text-white">{value}</p>
    </div>
  );
}

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
  const typeLabel = useTypeLabel();

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden px-margin-mobile py-3 md:px-margin-desktop md:py-4">
      <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden text-center sm:gap-2.5">
        <div className="shrink-0 space-y-0.5">
          <h1 className="page-title text-headline-sm text-secondary">
            {info.isShiny ? t("caughtShinyTitle") : t("caughtTitle")}
          </h1>
          {info.sentToPc && (
            <p className="text-[11px] font-medium leading-snug text-secondary/85">
              {t("sentToPcHint")}
            </p>
          )}
        </div>

        <div className="relative flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center sm:h-24 sm:w-24">
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-[-12%] rounded-full blur-2xl ${
              info.isShiny ? "bg-electric-yellow/30" : "bg-secondary/25"
            }`}
          />
          <div
            className={`relative flex h-full w-full items-center justify-center rounded-full border-2 bg-secondary/15 ${
              info.isShiny
                ? "border-electric-yellow/60 shadow-[0_0_28px_rgba(242,192,0,0.4)]"
                : "border-secondary/55 shadow-[0_0_28px_color-mix(in_srgb,var(--theme-secondary)_45%,transparent)]"
            }`}
          >
            <Image
              src={info.spriteUrl}
              alt={info.name}
              width={96}
              height={96}
              className="h-[85%] w-[85%] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
              unoptimized
            />
          </div>
        </div>

        <div className="shrink-0 space-y-1">
          <p className="page-title text-headline-md capitalize text-white">
            {info.name}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <p className="text-label-sm text-on-surface-variant">
              {t("level", { level: info.level })}
            </p>
            {info.isShiny && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#FFCC00]">
                <ShinyMark className="h-4 w-4" />
                {t("shinyBadge")}
              </span>
            )}
            {info.types.map((ty) => {
              const color = typeColor(ty);
              return (
                <span
                  key={ty}
                  className="rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    backgroundColor: `${color}28`,
                    color,
                    borderColor: `${color}55`,
                  }}
                >
                  {typeLabel(ty)}
                </span>
              );
            })}
          </div>
        </div>

        {info.shinyReward && (
          <p className="shrink-0 rounded-xl border border-electric-yellow/30 bg-electric-yellow/10 px-3 py-1.5 text-[12px] font-semibold text-electric-yellow">
            {t("shinyCatchReward", {
              coins: info.shinyReward.coins,
              gems: info.shinyReward.gems,
            })}
          </p>
        )}

        <div className="grid w-full shrink-0 grid-cols-3 gap-1.5 rounded-2xl border border-secondary/25 bg-gradient-to-b from-secondary/15 to-black/35 p-2.5">
          <StatCell label={tTeam("stats.hp")} value={info.maxHp} />
          <StatCell label={tTeam("stats.atk")} value={info.stats.attack} />
          <StatCell label={tTeam("stats.def")} value={info.stats.defense} />
          <StatCell label={tTeam("stats.spAtk")} value={info.stats.spAtk} />
          <StatCell label={tTeam("stats.spDef")} value={info.stats.spDef} />
          <StatCell label={tTeam("stats.speed")} value={info.stats.speed} />
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-secondary/20 bg-black/30 p-2.5 text-left">
          <p className="mb-1.5 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-secondary/90">
            {tTeam("moves")}
          </p>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 overflow-hidden">
            {info.moves.map((m) => {
              const color = typeColor(m.type);
              return (
                <div
                  key={m.moveId}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2 py-1"
                >
                  <span className="truncate text-[12px] font-semibold capitalize text-white/95">
                    {m.name}
                  </span>
                  <span
                    className="shrink-0 text-[10px] font-bold uppercase tracking-wide"
                    style={{ color }}
                  >
                    {typeLabel(m.type)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex shrink-0 flex-col gap-2 border-t border-secondary/20 pt-3">
        <div className="text-left">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-secondary/85">
            {t("nicknameLabel")}
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
            placeholder={info.name}
            maxLength={20}
            className="w-full rounded-xl border border-secondary/30 bg-black/40 px-3 py-2.5 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:border-secondary/70 focus:outline-none"
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="game-cta game-cta--red w-full"
        >
          {t("confirmCapture")}
        </button>
      </div>
    </div>
  );
}
