"use client";

// Pantalla post-captura: ficha del Pokémon + apodo.
// Mobile: identidad en fila + bloques densos. Desktop: card ancha 2 columnas
// (sprite | stats+moves) + footer apodo/CTA en fila — sin scroll de página.

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { CapturedPokemonInfo } from "@/actions/attempt-capture";
import { ShinyMark } from "@/components/shiny-mark";
import { typeColor } from "@/lib/type-colors";
import { useTypeLabel } from "@/hooks/use-type-label";

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-secondary/10 px-2 py-1 text-left">
      <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-secondary/80 lg:text-[9px]">
        {label}
      </p>
      <p className="text-base font-bold tabular-nums leading-none text-white lg:text-lg">
        {value}
      </p>
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

  const typeBadges = info.types.map((ty) => {
    const color = typeColor(ty);
    return (
      <span
        key={ty}
        className="rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide lg:text-[10px]"
        style={{
          backgroundColor: `${color}28`,
          color,
          borderColor: `${color}55`,
        }}
      >
        {typeLabel(ty)}
      </span>
    );
  });

  const identityMeta = (
    <>
      <p className="page-title text-lg capitalize leading-tight text-white lg:text-headline-sm">
        {info.name}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 lg:justify-center">
        <p className="text-[11px] font-medium text-on-surface-variant lg:text-label-sm">
          {t("level", { level: info.level })}
        </p>
        {info.isShiny && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#FFCC00] lg:text-[11px]">
            <ShinyMark className="h-3.5 w-3.5" title={t("shinyBadge")} />
            {t("shinyBadge")}
          </span>
        )}
        {typeBadges}
      </div>
    </>
  );

  const sprite = (
    <div className="relative flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center sm:h-[5.25rem] sm:w-[5.25rem] lg:h-36 lg:w-36">
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-[-14%] rounded-full blur-2xl ${
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
          width={144}
          height={144}
          className="h-[85%] w-[85%] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
          unoptimized
        />
      </div>
    </div>
  );

  const statsGrid = (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-secondary/25 bg-gradient-to-b from-secondary/15 to-black/35 p-1.5 lg:gap-1.5 lg:p-2">
      <StatCell label={tTeam("stats.hp")} value={info.maxHp} />
      <StatCell label={tTeam("stats.atk")} value={info.stats.attack} />
      <StatCell label={tTeam("stats.def")} value={info.stats.defense} />
      <StatCell label={tTeam("stats.spAtk")} value={info.stats.spAtk} />
      <StatCell label={tTeam("stats.spDef")} value={info.stats.spDef} />
      <StatCell label={tTeam("stats.speed")} value={info.stats.speed} />
    </div>
  );

  const movesList = (
    <div className="min-h-0 overflow-hidden rounded-xl border border-secondary/20 bg-black/30 p-1.5 text-left lg:p-2">
      <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-secondary/90 lg:text-[10px]">
        {tTeam("moves")}
      </p>
      <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
        {info.moves.map((m) => {
          const color = typeColor(m.type);
          return (
            <div
              key={m.moveId}
              className="flex items-center justify-between gap-2 rounded-md bg-white/[0.04] px-2 py-0.5 lg:py-1"
            >
              <span className="truncate text-[11px] font-semibold capitalize text-white/95 lg:text-[12px]">
                {m.name}
              </span>
              <span
                className="shrink-0 text-[9px] font-bold uppercase tracking-wide lg:text-[10px]"
                style={{ color }}
              >
                {typeLabel(m.type)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden px-margin-mobile py-2 md:px-margin-desktop md:py-3 lg:max-w-4xl lg:justify-center">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-secondary/25 bg-black/40 shadow-[0_12px_40px_rgba(0,0,0,0.35)] lg:flex-none lg:max-h-full">
        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-secondary/15 px-3 py-2 lg:px-5 lg:py-2.5">
          <h1 className="page-title text-base text-secondary lg:text-headline-sm">
            {info.isShiny ? t("caughtShinyTitle") : t("caughtTitle")}
          </h1>
          {info.sentToPc && (
            <p className="text-[10px] font-medium leading-snug text-secondary/85 lg:text-[11px]">
              {t("sentToPcHint")}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2.5 lg:grid lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] lg:gap-4 lg:p-4">
          {/* Identity */}
          <div className="flex shrink-0 items-center gap-3 lg:flex-col lg:items-center lg:justify-center lg:gap-3 lg:text-center">
            {sprite}
            <div className="min-w-0 flex-1 text-left lg:flex-none lg:text-center">
              {identityMeta}
              {info.shinyReward && (
                <p className="mt-1.5 rounded-lg border border-electric-yellow/30 bg-electric-yellow/10 px-2 py-1 text-[10px] font-semibold text-electric-yellow lg:mt-2 lg:text-[11px]">
                  {t("shinyCatchReward", {
                    coins: info.shinyReward.coins,
                    gems: info.shinyReward.gems,
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Stats + moves */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden lg:justify-center">
            {statsGrid}
            {movesList}
          </div>
        </div>

        {/* Footer: nickname + confirm */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-secondary/20 px-3 py-2.5 lg:flex-row lg:items-end lg:gap-3 lg:px-5 lg:py-3">
          <div className="min-w-0 flex-1 text-left">
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-[0.1em] text-secondary/85 lg:text-[10px]">
              {t("nicknameLabel")}
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
              placeholder={info.name}
              maxLength={20}
              className="w-full rounded-xl border border-secondary/30 bg-black/40 px-3 py-2 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:border-secondary/70 focus:outline-none lg:py-2.5"
            />
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="game-cta game-cta--red w-full shrink-0 lg:w-auto lg:min-w-[10.5rem]"
          >
            {t("confirmCapture")}
          </button>
        </div>
      </div>
    </div>
  );
}
