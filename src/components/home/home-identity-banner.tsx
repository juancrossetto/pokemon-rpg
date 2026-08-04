"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { FlagIcon } from "@/components/flag-icon";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { PvpRankBadge } from "@/components/pvp/pvp-rank-badge";
import { neonTypeColor } from "@/lib/type-colors";
import type { HomeIdentity } from "@/lib/home-hub";
import { divisionRoman, type PvpDivision, type PvpTier } from "@/lib/pvp/tiers";

export function HomeIdentityBanner({
  identity,
  labels,
}: {
  identity: HomeIdentity;
  labels: {
    level: string;
    combatPower: string;
    clan: string;
    noClan: string;
    streak: string;
    streakDays: string;
    viewProfile: string;
    titles: Record<string, string>;
    pvpTiers: Record<string, string>;
    lastAchievement: string;
    achievements: Record<string, string>;
  };
}) {
  const pvpTier = identity.pvpTier as PvpTier;
  const pvpTierLabel = labels.pvpTiers[identity.pvpTier] ?? identity.pvpTier;
  const standingLabel = `${pvpTierLabel} ${divisionRoman(identity.pvpDivision as PvpDivision)}`;
  const profileArt =
    identity.avatarStageSrc ?? identity.avatarProfileSrc ?? identity.avatarSrc;

  const mainType = (identity.companionTypes[0] ?? "normal").toLowerCase();
  const fluorFrom = neonTypeColor(mainType);
  const fluorTo = identity.companionTypes[1]
    ? neonTypeColor(identity.companionTypes[1])
    : neonTypeColor(mainType, 28);

  const cpFormatted = identity.combatPower.toLocaleString();

  return (
    <section
      className="home-identity relative isolate min-h-[5.5rem] overflow-hidden rounded-2xl sm:min-h-[8.25rem] xl:min-h-[9rem]"
      style={
        {
          "--hi-fluor-from": fluorFrom,
          "--hi-fluor-to": fluorTo,
        } as CSSProperties
      }
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--hi-fluor-from) 22%, transparent) 0%, transparent 55%),
            radial-gradient(90% 80% at 100% 10%, color-mix(in srgb, var(--hi-fluor-to) 16%, transparent) 0%, transparent 50%),
            radial-gradient(70% 60% at 70% 100%, color-mix(in srgb, var(--hi-fluor-from) 10%, transparent) 0%, transparent 55%),
            linear-gradient(135deg, #161822 0%, #10131c 48%, #0c0e16 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(255,255,255,0.06),0_12px_32px_rgba(0,0,0,0.4)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-1/4 top-0 hidden h-full w-1/2 rotate-12 bg-linear-to-r from-transparent via-white/4 to-transparent sm:block"
      />
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-[36%] sm:w-[42%] md:w-[30%]"
        style={{
          background: `
            radial-gradient(ellipse 70% 85% at 70% 55%, color-mix(in srgb, var(--hi-fluor-from) 28%, transparent) 0%, transparent 70%),
            linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.35) 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[12%] right-[6%] hidden h-3 w-[24%] rounded-[100%] bg-black/50 blur-md sm:block sm:right-[10%]"
      />

      {profileArt ? (
        <div className="pointer-events-none absolute inset-y-1 right-1 flex w-[38%] items-end justify-center sm:inset-y-1.5 sm:right-3 sm:w-[34%] md:w-[30%]">
          <Image
            src={profileArt}
            alt=""
            width={280}
            height={360}
            priority
            className="h-full w-auto max-w-full object-contain object-bottom drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] sm:drop-shadow-[0_16px_28px_rgba(0,0,0,0.55)]"
            unoptimized
          />
        </div>
      ) : null}

      {/* Mobile: compacto pero con región + clan */}
      <Link
        href="/profile"
        className="relative z-[1] flex h-full min-h-[5.5rem] items-center gap-2 p-3 pr-[36%] sm:hidden"
        aria-label={labels.viewProfile}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p
            className="text-[9px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: `color-mix(in srgb, ${fluorFrom} 72%, white)` }}
          >
            {identity.regionLabel}
          </p>
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="page-title truncate text-[19px] leading-none tracking-tight text-white">
              {identity.username}
            </h2>
            {identity.country ? (
              <FlagIcon code={identity.country} className="h-3.5 w-[1.1rem] shrink-0" />
            ) : null}
            <span className="shrink-0" title={`${standingLabel} · ${identity.pvpRating}`}>
              <PvpRankBadge
                tier={pvpTier}
                division={identity.pvpDivision as PvpDivision}
                label={pvpTierLabel}
                size="sm"
              />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums text-white/55">
            <span>
              {labels.level} {identity.level}
            </span>
            <span className="h-2.5 w-px bg-white/15" aria-hidden />
            <span
              className="font-bold"
              style={{ color: `color-mix(in srgb, ${fluorFrom} 58%, white)` }}
            >
              <span className="font-semibold opacity-70">{labels.combatPower}</span>{" "}
              {cpFormatted}
            </span>
            {identity.clanName ? (
              <>
                <span className="h-2.5 w-px bg-white/15" aria-hidden />
                <span className="inline-flex min-w-0 items-center gap-1 truncate text-white/65">
                  {identity.clanEmblem != null ? (
                    <ClanEmblemBadge
                      emblem={identity.clanEmblem}
                      size={12}
                      title={identity.clanName}
                      className="shrink-0"
                    />
                  ) : null}
                  <span className="truncate">{identity.clanName}</span>
                </span>
              </>
            ) : null}
          </div>
        </div>
      </Link>

      {/* sm+: banner completo */}
      <Link
        href="/profile"
        className="relative z-[1] hidden h-full min-h-[8.25rem] flex-col justify-center gap-2 p-4 pr-[36%] sm:flex md:pr-[32%] xl:min-h-[9rem]"
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: `color-mix(in srgb, ${fluorFrom} 72%, white)` }}
        >
          {identity.regionLabel}
        </p>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="page-title truncate text-2xl tracking-tight text-white">
              {identity.username}
            </h2>
            {identity.country ? (
              <FlagIcon
                code={identity.country}
                className="h-3.5 w-[1.15rem] shrink-0"
              />
            ) : null}
            <span
              className="group/rank relative shrink-0"
              title={`${standingLabel} · ${identity.pvpRating}`}
            >
              <PvpRankBadge
                tier={pvpTier}
                division={identity.pvpDivision as PvpDivision}
                label={pvpTierLabel}
                size="sm"
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-black/90 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/85 opacity-0 shadow-lg transition duration-150 group-hover/rank:opacity-100 group-focus-within/rank:opacity-100"
              >
                {standingLabel}
                <span className="mx-1 text-white/30">·</span>
                <span className="font-mono tabular-nums text-electric-yellow">
                  {identity.pvpRating}
                </span>
              </span>
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-none text-white/60">
          <span className="shrink-0 tabular-nums">
            {labels.level} {identity.level}
          </span>
          <span className="h-3 w-px shrink-0 bg-white/15" aria-hidden />
          {identity.clanName ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              {identity.clanEmblem != null ? (
                <ClanEmblemBadge
                  emblem={identity.clanEmblem}
                  size={14}
                  title={identity.clanName}
                  className="translate-y-px shrink-0"
                />
              ) : null}
              <span className="text-white/75">{identity.clanName}</span>
            </span>
          ) : (
            <span className="shrink-0">{labels.noClan}</span>
          )}
          <span
            className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold tabular-nums tracking-tight"
            style={{ color: `color-mix(in srgb, ${fluorFrom} 58%, white)` }}
          >
            <span className="opacity-75">{labels.combatPower}</span>
            <span>{cpFormatted}</span>
          </span>
        </div>
      </Link>
    </section>
  );
}
