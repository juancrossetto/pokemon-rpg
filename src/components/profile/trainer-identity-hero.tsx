"use client";

import { FlagIcon } from "@/components/flag-icon";
import { AvatarPicker, type AvatarPickerLabels } from "@/components/avatar-picker";
import { ProgressRail } from "@/components/trainer-profile-parts";
import { TrainerProfileScene } from "@/components/profile/trainer-profile-scene";
import type { RankProgress } from "@/lib/trainer-profile";
import type { TrainerAppearance } from "@/lib/trainer-appearance";

export type IdentityHeroLabels = {
  rank: Record<string, string>;
  title: Record<string, string>;
  power: string;
  badges: string;
  startDate: string;
  toNextRank: string;
  maxRank: string;
};

/**
 * Hero identidad (dark, principios GO):
 * nombre → escena → PC → barra de rango → meta.
 */
export function TrainerIdentityHero({
  username,
  companionLine,
  sceneLabel,
  country,
  title,
  rank,
  power,
  badges,
  totalGyms,
  memberSince,
  trainerSpriteUrl,
  companionSpriteUrl,
  companionName,
  companionAccent,
  appearance,
  canEdit,
  currentAvatarId,
  avatarLabels,
  labels,
}: {
  username: string;
  companionLine: string | null;
  sceneLabel: string;
  country: string;
  title: string;
  rank: RankProgress;
  power: number;
  badges: number;
  totalGyms: number;
  memberSince: string;
  trainerSpriteUrl: string | null;
  companionSpriteUrl: string | null;
  companionName: string | null;
  companionAccent: string;
  appearance?: TrainerAppearance | null;
  canEdit: boolean;
  currentAvatarId: string | null;
  avatarLabels: AvatarPickerLabels;
  labels: IdentityHeroLabels;
}) {
  const titleText = labels.title[title] ?? title;
  const rankText = labels.rank[rank.tier.id] ?? rank.tier.id;
  const progressValue = Math.round(rank.pct * 100);

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#0b0d12]">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(85% 60% at 50% 18%, ${companionAccent}30 0%, transparent 58%), linear-gradient(180deg, #141821 0%, #0b0d12 52%, #080a0e 100%)`,
        }}
      />

      <div className="relative flex flex-col lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-4">
        <div className="relative px-3 pt-5 sm:px-5">
          <div className="mb-1 px-1 text-center lg:text-left">
            <h1 className="text-[1.35rem] font-black leading-tight tracking-tight text-white sm:text-2xl">
              {username}
            </h1>
            {companionLine ? (
              <p className="mt-0.5 text-[13px] font-medium text-white/65 sm:text-sm">
                {companionLine}
              </p>
            ) : null}
          </div>

          <div className="relative">
            <TrainerProfileScene
              username={username}
              trainerSpriteUrl={trainerSpriteUrl}
              companionSpriteUrl={companionSpriteUrl}
              companionName={companionName}
              accent={companionAccent}
              appearance={appearance}
              sceneLabel={sceneLabel}
            />
            {canEdit && (
              <div className="absolute bottom-2 right-1 z-10 sm:right-3">
                <AvatarPicker
                  currentAvatarId={currentAvatarId}
                  labels={avatarLabels}
                  showAffordance={false}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#14161c]/95 text-on-surface-variant shadow-lg backdrop-blur-md transition hover:border-white/40 hover:text-white">
                    <span className="material-symbols-outlined text-[18px]!">edit</span>
                  </span>
                </AvatarPicker>
              </div>
            )}
          </div>
        </div>

        <div className="relative px-4 pb-5 pt-2 sm:px-6 sm:pb-6 lg:pt-10">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5 lg:justify-start">
            <span
              className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: `${companionAccent}55`,
                color: companionAccent,
                background: `${companionAccent}14`,
              }}
            >
              {titleText}
            </span>
            <span
              className="tp-sheen relative overflow-hidden rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-black/80"
              style={{ background: rank.tier.metal }}
            >
              {rankText}
            </span>
          </div>

          <div className="text-center lg:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-electric-yellow/90">
              {labels.power}
            </p>
            <p className="mt-1 font-mono text-[2.75rem] font-black tabular-nums leading-none tracking-tight text-white sm:text-5xl">
              {power.toLocaleString()}
            </p>
          </div>

          <div className="mt-3.5">
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[11px]">
              <span className="font-semibold text-white/85">
                {rank.next ? labels.toNextRank : labels.maxRank}
              </span>
              <span className="font-mono tabular-nums text-white/50">{progressValue}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressValue}
              aria-label={rank.next ? labels.toNextRank : labels.maxRank}
            >
              <ProgressRail pct={rank.pct} color={rank.tier.accent} height={7} delayMs={160} />
            </div>
            <p className="mt-1.5 text-center font-mono text-[11px] tabular-nums text-white/45 lg:text-left">
              {badges}/{totalGyms} {labels.badges}
            </p>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-on-surface-variant lg:justify-start">
            <span className="inline-flex items-center gap-1.5">
              <FlagIcon code={country} className="h-3.5 w-5 rounded-[2px]" />
              <span className="font-medium text-white/80">{username}</span>
            </span>
            <span className="opacity-70">
              {labels.startDate} {memberSince}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
