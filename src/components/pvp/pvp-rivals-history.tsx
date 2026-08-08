"use client";

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { FlagIcon } from "@/components/flag-icon";
import { AvatarImage } from "@/components/avatar-image";
import { PvpRematchForm } from "@/components/pvp/pvp-rematch-form";

export type PvpHubTeamMon = {
  id: string;
  name: string;
  spriteUrl: string;
  level: number;
  fainted: boolean;
};

export type PvpHubMatchCard = {
  id: string;
  foeId: string;
  foeName: string;
  foeCountry: string;
  foeAvatarSrc: string | null;
  selfName: string;
  selfAvatarSrc: string | null;
  mode: "RANKED" | "QUICK" | string;
  status: string;
  iWon: boolean;
  delta: number;
  myTeam: PvpHubTeamMon[];
  foeTeam: PvpHubTeamMon[];
  /** Ms restantes para volver a desafiar a este rival (0 = libre). */
  cooldownMsLeft: number;
};

type Labels = {
  rivalsTitle: string;
  emptyHistory: string;
  win: string;
  loss: string;
  forfeit: string;
  rematch: string;
  starting: string;
  modeRanked: string;
  modeQuick: string;
  vsShort: string;
  you: string;
  lastRival: string;
  viewMatch: string;
  fainted: string;
  levelShort: string;
  teamUnknown: string;
  paginationPrev: string;
  paginationNext: string;
  paginationPageOf: string;
};

type Props = {
  locale: string;
  labels: Labels;
  matches: PvpHubMatchCard[];
  canFight: boolean;
  page: number;
  totalPages: number;
};

export function PvpRivalsHistory({
  locale,
  labels: L,
  matches,
  canFight,
  page,
  totalPages,
}: Props) {
  const [selectedId, setSelectedId] = useState(matches[0]?.id ?? null);
  const selected = matches.find((m) => m.id === selectedId) ?? matches[0] ?? null;

  return (
    <section className="game-float-card overflow-hidden rounded-2xl">
      <div className="border-b border-white/8 px-3 pb-1 pt-4 sm:px-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {L.rivalsTitle}
        </p>

        {selected ? (
          <MatchSpotlight match={selected} L={L} locale={locale} canFight={canFight} />
        ) : (
          <p className="pb-4 text-[12px] text-white/50">{L.emptyHistory}</p>
        )}
      </div>

      {matches.length > 0 ? (
        <ul className="divide-y divide-white/8">
          {matches.map((m) => {
            const active = selected?.id === m.id;
            const resultLabel =
              m.status === "FORFEIT" && !m.iWon ? L.forfeit : m.iWon ? L.win : L.loss;

            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  aria-pressed={active}
                  title={resultLabel}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition sm:px-4 ${
                    active
                      ? "bg-white/[0.07] shadow-[inset_3px_0_0_0_var(--color-electric-yellow)]"
                      : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <FlagIcon
                        code={m.foeCountry}
                        className="h-3 w-auto shrink-0 rounded-xs"
                      />
                      <span className="truncate text-[13px] font-semibold text-white">
                        {m.foeName}
                      </span>
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">
                      {m.mode === "RANKED" ? L.modeRanked : L.modeQuick}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 font-mono text-[12px] font-bold tabular-nums tracking-tight sm:text-[13px] ${
                      m.delta > 0
                        ? "bg-tertiary/12 text-tertiary"
                        : m.delta < 0
                          ? "bg-error/12 text-error"
                          : "bg-white/6 text-white/50"
                    }`}
                    aria-label={resultLabel}
                  >
                    {m.delta > 0 ? "+" : ""}
                    {m.delta}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-2.5 text-[11px] text-white/45">
          {page > 1 ? (
            <Link href={`/pvp?page=${page - 1}`} className="hover:text-white">
              {L.paginationPrev}
            </Link>
          ) : (
            <span />
          )}
          <span>{L.paginationPageOf}</span>
          {page < totalPages ? (
            <Link href={`/pvp?page=${page + 1}`} className="hover:text-white">
              {L.paginationNext}
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </section>
  );
}

function MatchSpotlight({
  match,
  L,
  locale,
  canFight,
}: {
  match: PvpHubMatchCard;
  L: Labels;
  locale: string;
  canFight: boolean;
}) {
  return (
    <div className="pb-3">
      {/* Mobile: VS then team rows · sm+: teams flanking VS */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="pvp-vs-stage flex items-center justify-center gap-2">
          <SpotlightPortrait
            name={match.selfName}
            src={match.selfAvatarSrc}
            caption={L.you}
            accent="self"
          />
          <span className="page-title pvp-vs-neon shrink-0 px-0.5 text-[1.25rem] leading-none">
            {L.vsShort}
          </span>
          <SpotlightPortrait
            name={match.foeName}
            src={match.foeAvatarSrc}
            caption={L.lastRival}
            accent="rival"
            flag={match.foeCountry}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TeamRow team={match.myTeam} L={L} />
          <TeamRow team={match.foeTeam} L={L} />
        </div>
      </div>

      <div className="pvp-vs-stage hidden items-stretch justify-center gap-1.5 sm:flex sm:gap-2.5">
        <TeamColumn team={match.myTeam} align="end" L={L} />

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2.5">
          <SpotlightPortrait
            name={match.selfName}
            src={match.selfAvatarSrc}
            caption={L.you}
            accent="self"
          />
          <span className="page-title pvp-vs-neon shrink-0 px-0.5 text-[1.15rem] leading-none sm:text-[1.4rem]">
            {L.vsShort}
          </span>
          <SpotlightPortrait
            name={match.foeName}
            src={match.foeAvatarSrc}
            caption={L.lastRival}
            accent="rival"
            flag={match.foeCountry}
          />
        </div>

        <TeamColumn team={match.foeTeam} align="start" L={L} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Link
          href={`/pvp/${match.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/4 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/65 transition hover:border-white/25 hover:text-white"
        >
          <span className="material-symbols-outlined text-[14px]!">info</span>
          {L.viewMatch}
        </Link>
        <PvpRematchForm
          locale={locale}
          foeId={match.foeId}
          label={L.rematch}
          pendingLabel={L.starting}
          disabled={!canFight}
          cooldownMsLeft={match.cooldownMsLeft}
          className="inline-flex min-h-0! items-center rounded-md border border-white/12 bg-white/4 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/65 hover:border-white/25 hover:text-white"
        />
      </div>
    </div>
  );
}

function TeamRow({ team, L }: { team: PvpHubTeamMon[]; L: Labels }) {
  if (team.length === 0) {
    return <p className="text-center text-[9px] text-white/30">{L.teamUnknown}</p>;
  }
  return (
    <ul className="flex flex-wrap items-center justify-center gap-1">
      {team.map((mon) => (
        <TeamSprite key={mon.id} mon={mon} L={L} size="sm" />
      ))}
    </ul>
  );
}

function TeamColumn({
  team,
  align,
  L,
}: {
  team: PvpHubTeamMon[];
  align: "start" | "end";
  L: Labels;
}) {
  if (team.length === 0) {
    return (
      <div
        className={`flex w-10 shrink-0 flex-col justify-center sm:w-12 ${
          align === "end" ? "items-end" : "items-start"
        }`}
      >
        <span className="text-[8px] leading-tight text-white/30">{L.teamUnknown}</span>
      </div>
    );
  }

  return (
    <ul
      className={`flex w-10 shrink-0 flex-col gap-1 sm:w-12 ${
        align === "end" ? "items-end" : "items-start"
      }`}
    >
      {team.map((mon) => (
        <TeamSprite key={mon.id} mon={mon} L={L} size="md" />
      ))}
    </ul>
  );
}

function TeamSprite({
  mon,
  L,
  size,
}: {
  mon: PvpHubTeamMon;
  L: Labels;
  size: "sm" | "md";
}) {
  return (
    <li
      title={`${mon.name} · ${L.levelShort.replace("{level}", String(mon.level))}${
        mon.fainted ? ` · ${L.fainted}` : ""
      }`}
      className={`relative flex items-center justify-center ${
        size === "sm" ? "h-8 w-8" : "h-9 w-9 sm:h-10 sm:w-10"
      } ${mon.fainted ? "opacity-55" : ""}`}
    >
      {mon.spriteUrl ? (
        <Image
          src={mon.spriteUrl}
          alt={mon.name}
          width={40}
          height={40}
          className={`h-full w-full object-contain ${mon.fainted ? "grayscale" : ""}`}
          unoptimized
        />
      ) : (
        <span className="text-[9px] text-white/40">{mon.name.slice(0, 2)}</span>
      )}
      {mon.fainted ? (
        <span className="pointer-events-none absolute inset-0 rounded-full bg-black/25" />
      ) : null}
    </li>
  );
}

function SpotlightPortrait({
  name,
  src,
  caption,
  accent,
  flag,
}: {
  name: string;
  src: string | null;
  caption: string;
  accent: "self" | "rival";
  flag?: string;
}) {
  return (
    <div className="flex w-[4.5rem] flex-col items-center sm:w-[5.25rem]">
      <div className="relative flex h-[5.5rem] w-full items-center justify-center sm:h-[6.5rem]">
        {src ? (
          <AvatarImage
            src={src}
            alt={name}
            className={`h-full w-auto max-w-full object-contain object-center ${
              accent === "self"
                ? "drop-shadow-[0_0_18px_color-mix(in_srgb,var(--color-electric-yellow)_35%,transparent)]"
                : "drop-shadow-[0_0_18px_color-mix(in_srgb,var(--color-pokeball-red)_30%,transparent)]"
            }`}
          />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[16px] font-bold text-white/50">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <p className="mt-1 max-w-full truncate text-center text-[11px] font-semibold text-white">
        {name}
      </p>
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/40">
        {flag ? <FlagIcon code={flag} className="h-2.5 w-auto rounded-xs" /> : null}
        {caption}
      </p>
    </div>
  );
}
