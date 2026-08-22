"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FlagIcon } from "@/components/flag-icon";
import { AvatarImage } from "@/components/avatar-image";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { avatarById } from "@/lib/avatars";
import { PokemonImage } from "@/components/pokemon-image";
import type { HomeRailClanWars, HomeRailPvp, HomeRailPvpMatch } from "@/lib/home-hub";
import { divisionRoman, type PvpDivision, type PvpTier } from "@/lib/pvp/tiers";
import {
  CurrentExpedition,
  type CurrentExpeditionProps,
} from "@/components/current-expedition";
import { GameCtaButton } from "@/components/game-cta-button";

/** Filtro del escuadrón (opcional en ActiveTeamStrip). */
export type HomeSquadFilter = "all" | "favorites" | "injured" | "ready";

export type HomeRailRankEntry = {
  position: number;
  playerId: string;
  playerName: string;
  countryCode: string;
  avatarId: string | null;
  combatPower: number;
  isCurrentPlayer: boolean;
  featured: { name: string; image: string; isShiny: boolean } | null;
};

function RailAvatar({
  avatarId,
  name,
  glow,
}: {
  avatarId: string | null;
  name: string;
  glow?: boolean;
}) {
  const avatar = avatarById(avatarId);
  return (
    <div
      className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[#1a1c24] ${
        glow
          ? "shadow-[0_0_14px_color-mix(in_srgb,var(--color-pokeball-red)_35%,transparent)] ring-1 ring-pokeball-red/50"
          : "ring-1 ring-white/10"
      }`}
    >
      {avatar?.src ? (
        <AvatarImage
          src={avatar.src}
          alt={name}
          className="trainer-sprite-fill h-full w-full"
          size={40}
        />
      ) : (
        <span className="text-[11px] font-bold text-white/45">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function MatchCta({ href, label }: { href: string; label: string }) {
  return (
    <GameCtaButton
      href={href}
      variant="red"
      className="home-rail-cta mt-1.5 min-h-8 w-full px-3 py-1.5 text-[10px]!"
    >
      {label}
    </GameCtaButton>
  );
}

/**
 * Columna izquierda desktop del Home: expedición + match cards PvP/clan + top 5.
 */
export function HomeDesktopRail({
  pvp,
  clanWars,
  top,
  expedition,
}: {
  pvp: HomeRailPvp;
  clanWars: HomeRailClanWars;
  top: HomeRailRankEntry[];
  expedition?: CurrentExpeditionProps | null;
}) {
  const t = useTranslations("home.rail");
  const tPvp = useTranslations("pvp");
  const featured = pvp.recent[0] ?? null;
  const clanHref = clanWars.clanId ? `/clans/${clanWars.clanId}` : "/clans";
  const clanLabel = clanWars.clanName ?? t("clanGuest");
  const pvpTier = pvp.tier as PvpTier;
  const pvpTierLabel = tPvp(`tiers.${pvpTier}`);

  return (
    <aside className="sticky top-4 hidden h-fit w-[16.5rem] shrink-0 flex-col gap-2 xl:flex 2xl:w-[17.5rem]">
      {expedition ? <CurrentExpedition {...expedition} variant="rail" /> : null}

      {/* Match cards apiladas bajo la expedición. */}
      <div className="flex flex-col gap-2">
      {/* Match PvP */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#12141c]/95 px-2.5 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.32)]">
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-electric-yellow px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-on-tertiary">
            {t("matchBadge")}
          </span>
          <span className="text-[10px] font-semibold text-white/80">{t("pvpKind")}</span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <h3 className="page-title text-[0.98rem] leading-none text-white">
              {t("pvpTitle")}
            </h3>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/45">
              {pvpTierLabel} {divisionRoman(pvp.division as PvpDivision)} · {pvp.rating}
            </p>
          </div>
          {featured ? (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                featured.won
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-rose-400/15 text-rose-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  featured.won ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              {featured.won ? t("resultWin") : t("resultLoss")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-pokeball-red/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-pokeball-red">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-electric-yellow" />
              {t("statusOpen")}
            </span>
          )}
        </div>
        {!featured ? (
          <p className="mt-1 text-[10px] text-white/45">
            {t("pvpSubtitle", {
                wins: pvp.wins,
                losses: pvp.losses,
                rating: pvp.rating,
              })}
          </p>
        ) : null}

        {featured ? (
          <PvpVersus
            selfName={pvp.selfName}
            selfAvatarId={pvp.selfAvatarId}
            selfRating={pvp.rating}
            match={featured}
            labels={{
              scoreLabel: t("scoreLabel"),
              elo: t("elo"),
              you: t("you"),
            }}
          />
        ) : (
          <div className="mt-2 rounded-xl border border-dashed border-white/12 bg-white/[0.03] px-3 py-3 text-center text-[11px] text-white/50">
            {t("pvpEmpty")}
          </div>
        )}

        <MatchCta
          href={featured ? `/pvp/${featured.id}` : "/pvp"}
          label={featured ? t("matchDetails") : t("pvpPlay")}
        />

      </section>

      {/*
        Sin guerra en curso (`status: "none"`) la card completa era puro
        placeholder: marcador "— : —", rival con ícono de interrogación y la
        chapa PRÓXIMAMENTE. Una función que todavía no existe no justifica ~180px
        del rail, así que colapsa a una fila; cuando hay guerra real vuelve
        entera.
      */}
      {clanWars.status === "none" ? (
        <Link
          href={clanHref}
          className="flex items-center gap-2 rounded-[1.2rem] border border-white/10 bg-[#12141c]/95 px-2.5 py-2 transition hover:border-white/20"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#1a1c24] ring-1 ring-white/10">
            {clanWars.clanEmblem != null ? (
              <ClanEmblemBadge emblem={clanWars.clanEmblem} size={22} title={clanLabel} />
            ) : (
              <span className="material-symbols-outlined text-[16px]! text-white/35">
                groups
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold leading-tight text-white">
              {t("clanTitle")}
            </span>
            <span className="block truncate text-[9px] uppercase tracking-[0.12em] text-white/40">
              {t("clanPrepare")}
            </span>
          </span>
          <span className="material-symbols-outlined shrink-0 text-[16px]! text-white/30">
            chevron_right
          </span>
        </Link>
      ) : (
      <section className="overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#12141c]/95 px-2.5 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.32)]">
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-electric-yellow px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-on-tertiary">
            {t("matchBadge")}
          </span>
          <span className="text-[10px] font-semibold text-white/80">{t("clanKind")}</span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <h3 className="page-title text-[0.98rem] leading-none text-white">
            {t("clanTitle")}
          </h3>
          <span className="inline-flex items-center gap-1 rounded-md bg-pokeball-red/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-pokeball-red">
            <span className="h-1.5 w-1.5 rounded-full bg-electric-yellow/70" />
            {clanWars.status === "active"
              ? t("statusLive")
              : clanWars.status === "completed"
                ? t("statusDone")
                : t("statusSoon")}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-white/45">{t("clanSubtitle")}</p>

        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
          <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#1a1c24] shadow-[0_0_14px_color-mix(in_srgb,var(--color-pokeball-red)_30%,transparent)] ring-1 ring-pokeball-red/45">
              {clanWars.clanEmblem != null ? (
                <ClanEmblemBadge
                  emblem={clanWars.clanEmblem}
                  size={34}
                  title={clanLabel}
                />
              ) : (
                <span className="material-symbols-outlined text-[20px]! text-white/35">
                  groups
                </span>
              )}
            </div>
            <p className="w-full truncate text-[10px] font-semibold text-white">
              {clanLabel}
            </p>
            <p className="inline-flex items-center gap-0.5 text-[9px] text-electric-yellow">
              <span className="material-symbols-outlined text-[11px]!">star</span>
              {clanWars.clanTag ? `#${clanWars.clanTag}` : "—"}
            </p>
          </div>

          <div className="flex flex-col items-center px-0.5 text-center">
            <p
              className={`text-[1.05rem] font-bold tabular-nums leading-none ${
                clanWars.scoreSelf != null ? "text-white" : "text-white/35"
              }`}
            >
              {clanWars.scoreSelf != null && clanWars.scoreRival != null
                ? `${clanWars.scoreSelf} : ${clanWars.scoreRival}`
                : "— : —"}
            </p>
            <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-white/35">
              {t("scoreLabel")}
            </p>
            <p className="mt-0.5 font-mono text-[10px] tabular-nums text-white/40">
              {clanWars.status === "active"
                ? t("statusLive")
                : clanWars.status === "completed"
                  ? t("statusDone")
                  : t("statusSoon")}
            </p>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#1a1c24] ring-1 ring-white/10">
              {clanWars.rivalEmblem != null ? (
                <ClanEmblemBadge
                  emblem={clanWars.rivalEmblem}
                  size={34}
                  title={clanWars.rivalName ?? undefined}
                />
              ) : (
                <span className="material-symbols-outlined text-[20px]! text-white/30">
                  help
                </span>
              )}
            </div>
            <p className="w-full truncate text-[10px] font-semibold text-white/45">
              {clanWars.rivalName ?? t("clanRivalSoon")}
            </p>
            <p className="inline-flex items-center gap-0.5 text-[9px] text-white/30">
              <span className="material-symbols-outlined text-[11px]!">star</span>
              {clanWars.rivalTag ? `#${clanWars.rivalTag}` : "—"}
            </p>
          </div>
        </div>

        <MatchCta
          href={clanHref}
          label={clanWars.clanId ? t("clanOpen") : t("clanFind")}
        />
      </section>
      )}

      {/* Top 5 */}
      <section className="overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#12141c]/95 px-2.5 py-2.5">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">
            {t("topTitle")}
          </p>
          <Link
            href="/ranking"
            className="text-[10px] font-semibold text-pokeball-red transition hover:text-electric-yellow"
          >
            {t("topViewAll")}
          </Link>
        </div>
        {top.length === 0 ? (
          <p className="text-[11px] text-on-surface-variant/80">{t("topEmpty")}</p>
        ) : (
          <ol className="flex flex-col">
            {top.slice(0, 3).map((row, i) => {
              const avatar = avatarById(row.avatarId);
              const featuredMon = row.featured;
              return (
                <li
                  key={row.playerId}
                  className={`flex items-center gap-2 py-1 ${
                    i > 0 ? "border-t border-white/[0.06]" : ""
                  } ${row.isCurrentPlayer ? "rounded-md bg-pokeball-red/10 px-1" : ""}`}
                >
                  <span className="w-3.5 shrink-0 text-center font-mono text-[10px] font-bold tabular-nums text-white/55">
                    {row.position}
                  </span>
                  <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-[26%] bg-[#12141a]">
                    {avatar?.src ? (
                      <AvatarImage
                        src={avatar.src}
                        alt={row.playerName}
                        className="trainer-sprite-fill h-full w-full"
                        size={24}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[8px] font-bold text-white/50">
                        {row.playerName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="truncate text-[11px] font-semibold text-white">
                        {row.playerName}
                      </span>
                      <FlagIcon code={row.countryCode} className="h-2.5 w-3.5 shrink-0" />
                    </span>
                    <span className="font-mono text-[9px] tabular-nums text-white/45">
                      {t("cp")} {row.combatPower.toLocaleString()}
                    </span>
                  </span>
                  {featuredMon ? (
                    <PokemonImage
                      src={featuredMon.image}
                      speciesName={featuredMon.name}
                      isShiny={featuredMon.isShiny}
                      alt={featuredMon.name}
                      width={28}
                      height={28}
                      className="h-6 w-6 shrink-0 object-contain"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
      </div>
    </aside>
  );
}

function PvpVersus({
  selfName,
  selfAvatarId,
  selfRating,
  match,
  labels,
}: {
  selfName: string;
  selfAvatarId: string | null;
  selfRating: number;
  match: HomeRailPvpMatch;
  labels: { scoreLabel: string; elo: string; you: string };
}) {
  const selfScore = match.won ? 1 : 0;
  const foeScore = match.won ? 0 : 1;
  const delta =
    match.ratingDelta > 0
      ? `+${match.ratingDelta}`
      : String(match.ratingDelta);

  return (
    <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1">
      <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
        <RailAvatar avatarId={selfAvatarId} name={selfName} glow={match.won} />
        <p className="w-full truncate text-[10px] font-semibold text-white">
          {labels.you}
        </p>
        <p className="inline-flex items-center gap-0.5 text-[9px] text-electric-yellow">
          <span className="material-symbols-outlined text-[11px]!">star</span>
          {selfRating}
        </p>
      </div>

      <div className="flex flex-col items-center px-0.5 text-center">
        <p className="text-[1.15rem] font-bold tabular-nums leading-none text-white">
          {selfScore}
          <span className="mx-0.5 text-white/35">:</span>
          {foeScore}
        </p>
        <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">
          {labels.scoreLabel}
        </p>
        <p
          className={`mt-0.5 font-mono text-[11px] font-bold tabular-nums ${
            match.ratingDelta > 0
              ? "text-emerald-300"
              : match.ratingDelta < 0
                ? "text-rose-300"
                : "text-white/40"
          }`}
        >
          {delta} {labels.elo}
        </p>
      </div>

      <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
        <RailAvatar
          avatarId={match.opponentAvatarId}
          name={match.opponentName}
          glow={!match.won}
        />
        <p className="flex w-full items-center justify-center gap-0.5 truncate text-[10px] font-semibold text-white">
          <span className="truncate">{match.opponentName}</span>
          {match.opponentCountry ? (
            <FlagIcon code={match.opponentCountry} className="h-2 w-3 shrink-0" />
          ) : null}
        </p>
        <p className="inline-flex items-center gap-0.5 text-[9px] text-electric-yellow/70">
          <span className="material-symbols-outlined text-[11px]!">star</span>
          —
        </p>
      </div>
    </div>
  );
}
