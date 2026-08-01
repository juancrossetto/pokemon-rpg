"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { FlagIcon } from "@/components/flag-icon";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { neonTypeColor } from "@/lib/type-colors";
import type { HomeIdentity } from "@/lib/home-hub";

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
    ranks: Record<string, string>;
    lastAchievement: string;
    achievements: Record<string, string>;
  };
}) {
  const rank = labels.ranks[identity.rankTierId] ?? identity.rankTierId;
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
      className="home-identity relative isolate min-h-[7.5rem] overflow-hidden rounded-2xl sm:min-h-[8.25rem] xl:min-h-[9rem]"
      style={
        {
          "--hi-fluor-from": fluorFrom,
          "--hi-fluor-to": fluorTo,
        } as CSSProperties
      }
    >
      {/* Base + mesh moderno */}
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
      {/* Brillo superior / borde glass */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(255,255,255,0.06),0_12px_32px_rgba(0,0,0,0.4)]"
      />
      {/* Sheen diagonal sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-1/4 top-0 h-full w-1/2 rotate-12 bg-linear-to-r from-transparent via-white/4 to-transparent"
      />
      {/* Escenario del avatar */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-[48%] sm:w-[42%]"
        style={{
          background: `
            radial-gradient(ellipse 70% 85% at 70% 55%, color-mix(in srgb, var(--hi-fluor-from) 28%, transparent) 0%, transparent 70%),
            linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.35) 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[12%] right-[8%] h-3 w-[28%] rounded-[100%] bg-black/50 blur-md sm:right-[10%] sm:w-[24%]"
      />

      {profileArt ? (
        <div className="pointer-events-none absolute inset-y-1.5 right-2 flex w-[38%] items-end justify-center sm:right-3 sm:w-[34%] md:w-[30%]">
          <Image
            src={profileArt}
            alt=""
            width={280}
            height={360}
            priority
            className="h-full w-auto max-w-full object-contain object-bottom drop-shadow-[0_16px_28px_rgba(0,0,0,0.55)]"
            unoptimized
          />
        </div>
      ) : null}

      <Link
        href="/profile"
        className="relative z-[1] flex h-full min-h-[7.5rem] flex-col justify-center gap-2 p-3.5 pr-[40%] sm:min-h-[8.25rem] sm:gap-1.5 sm:p-4 sm:pr-[36%] md:pr-[32%]"
      >
        <p
          className="font-[family-name:var(--font-identity)] text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: `color-mix(in srgb, ${fluorFrom} 72%, white)` }}
        >
          {rank}
          <span className="mx-1.5 text-white/25">·</span>
          <span className="text-white/55">{identity.regionLabel}</span>
        </p>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="truncate font-[family-name:var(--font-identity)] text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {identity.username}
          </h2>
          {identity.country ? (
            <FlagIcon code={identity.country} className="h-3.5 w-[1.15rem] shrink-0" />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 text-[12px] leading-snug text-white/60 sm:h-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1 sm:text-[13px] sm:leading-none">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span className="shrink-0 tabular-nums">
              {labels.level} {identity.level}
            </span>

            <span className="h-3 w-px shrink-0 bg-white/15" aria-hidden />

            {identity.clanName ? (
              <span className="inline-flex min-w-0 max-w-[70%] items-center gap-1.5 sm:max-w-[42%]">
                {identity.clanEmblem != null ? (
                  <ClanEmblemBadge
                    emblem={identity.clanEmblem}
                    size={14}
                    title={identity.clanName}
                    className="translate-y-px"
                  />
                ) : null}
                <span className="truncate text-white/75">{identity.clanName}</span>
              </span>
            ) : (
              <span className="shrink-0">{labels.noClan}</span>
            )}
          </div>

          <span
            className="inline-flex shrink-0 items-center gap-1 font-[family-name:var(--font-identity)] text-[13px] font-bold tabular-nums tracking-tight sm:text-[13px]"
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
