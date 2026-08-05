"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { PvpRankBadge } from "@/components/pvp/pvp-rank-badge";
import { neonTypeColor } from "@/lib/type-colors";
import type { HomeIdentity } from "@/lib/home-hub";
import { homeBannerById } from "@/lib/home-banners";
import { divisionRoman, type PvpDivision, type PvpTier } from "@/lib/pvp/tiers";

/**
 * Banner de identidad del home.
 * `frameSrc` reserva el slot de marco (PNG con alfa) para premios cosméticos.
 */
export function HomeIdentityBanner({
  identity,
  labels,
  frameSrc = null,
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
  /** PNG de marco equipado; sin DB todavía — listo para rewards. */
  frameSrc?: string | null;
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
      className="home-identity relative isolate min-h-[6.75rem] overflow-hidden rounded-2xl sm:min-h-[8.75rem] xl:min-h-[9.5rem]"
      style={
        {
          "--hi-fluor-from": fluorFrom,
          "--hi-fluor-to": fluorTo,
        } as CSSProperties
      }
    >
      <div aria-hidden className="absolute inset-0">
        <Image
          src={homeBannerById(identity.homeBannerId).src}
          alt=""
          fill
          priority
          quality={92}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 100vw, 720px"
          className="object-cover object-[center_36%]"
        />
      </div>

      {/* Vignette liviana: el arte se lee; no tapa el paisaje. */}
      <div aria-hidden className="home-identity__wash" />

      {/* Scrim solo detrás del copy (izquierda). */}
      <div aria-hidden className="home-identity__scrim" />

      {/* Tinte de tipo del favorito, muy suave. */}
      <div aria-hidden className="home-identity__fluor" />

      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[10%] right-[6%] hidden h-3 w-[24%] rounded-[100%] bg-black/45 blur-md sm:block sm:right-[10%]"
      />

      {profileArt ? (
        <div className="pointer-events-none absolute inset-y-1 right-1 z-[3] flex w-[38%] items-end justify-center sm:inset-y-1.5 sm:right-3 sm:w-[34%] md:w-[30%]">
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

      {/* Marco base + slot PNG para premios futuros. */}
      <div aria-hidden className="home-identity__frame">
        {frameSrc ? (
          <Image
            src={frameSrc}
            alt=""
            fill
            sizes="(max-width: 1280px) 100vw, 720px"
            className="object-fill"
            unoptimized
          />
        ) : null}
      </div>

      {/* Mobile */}
      <Link
        href="/profile"
        className="relative z-[2] flex h-full min-h-[6.75rem] items-center gap-2 p-3.5 pr-[36%] sm:hidden"
        aria-label={labels.viewProfile}
      >
        <div className="home-identity__copy min-w-0 flex-1 space-y-1">
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
            <span className="shrink-0" title={`${standingLabel} · ${identity.pvpRating}`}>
              <PvpRankBadge
                tier={pvpTier}
                division={identity.pvpDivision as PvpDivision}
                label={pvpTierLabel}
                size="sm"
              />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums text-white/70">
            <span>
              {labels.level} {identity.level}
            </span>
            <span className="h-2.5 w-px bg-white/20" aria-hidden />
            <span
              className="font-bold"
              style={{ color: `color-mix(in srgb, ${fluorFrom} 58%, white)` }}
            >
              <span className="font-semibold opacity-70">{labels.combatPower}</span>{" "}
              {cpFormatted}
            </span>
            {identity.clanName ? (
              <>
                <span className="h-2.5 w-px bg-white/20" aria-hidden />
                <span className="inline-flex min-w-0 items-center gap-1 truncate text-white/75">
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

      {/* sm+ */}
      <Link
        href="/profile"
        className="relative z-[2] hidden h-full min-h-[8.75rem] flex-col justify-center gap-2 p-4 pr-[36%] sm:flex md:pr-[32%] xl:min-h-[9.5rem]"
        aria-label={labels.viewProfile}
      >
        <div className="home-identity__copy min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: `color-mix(in srgb, ${fluorFrom} 72%, white)` }}
          >
            {identity.regionLabel}
          </p>

          <div className="mt-1.5 min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="page-title truncate text-2xl tracking-tight text-white">
                {identity.username}
              </h2>
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

          <div className="mt-2 flex min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-none text-white/70">
            <span className="shrink-0 tabular-nums">
              {labels.level} {identity.level}
            </span>
            <span className="h-3 w-px shrink-0 bg-white/20" aria-hidden />
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
                <span className="text-white/80">{identity.clanName}</span>
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
        </div>
      </Link>
    </section>
  );
}
