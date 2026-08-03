"use client";

import { Link } from "@/i18n/navigation";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { ClanAffinityChip } from "@/components/clans/clan-affinity-chip";
import { ClanAffinityBuffMicro } from "@/components/clans/clan-affinity-buff-micro";
import { getAffinityBuff } from "@/lib/clan-affinity-buff";
import { CLAN_MAX_MEMBERS } from "@/lib/clan-rules";
import type { DiscoveryClan } from "@/components/clans/clan-discovery";

/** Solo datos serializables (nada de funciones) para el boundary server→client. */
export type ClanCardLabels = {
  affinities: Record<DiscoveryClan["affinity"], string>;
  focuses: Record<DiscoveryClan["focus"], string>;
  membersTemplate: string;
  powerTemplate: string;
  levelTemplate: string;
  viewClan: string;
  joinOpen: string;
  requestJoin: string;
  inviteOnly: string;
  full: string;
  buffLabel: string;
  buffHintTemplate: string;
};

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? `{${key}}` : String(vars[key]),
  );
}

function clanLevel(badges: number): number {
  return Math.max(1, Math.floor(badges / 5) + 1);
}

export function ClanCard({
  clan,
  labels,
  highlight,
  featuredReason,
}: {
  clan: DiscoveryClan;
  labels: ClanCardLabels;
  highlight?: boolean;
  featuredReason?: string;
}) {
  const full = clan.memberCount >= CLAN_MAX_MEMBERS;
  const level = clanLevel(clan.badges);
  const buff = getAffinityBuff(clan.affinity);
  const joinLabel = full
    ? labels.full
    : clan.joinPolicy === "OPEN"
      ? labels.joinOpen
      : clan.joinPolicy === "REQUEST"
        ? labels.requestJoin
        : labels.inviteOnly;

  return (
    <article
      className={`flex flex-col rounded-xl border p-3 transition-colors ${
        highlight
          ? "border-pokeball-red/35 bg-pokeball-red/5"
          : "border-white/10 bg-glass-surface hover:border-white/20"
      }`}
    >
      {featuredReason ? (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-tertiary">
          {featuredReason}
        </p>
      ) : null}

      <div className="flex gap-3">
        <ClanEmblemBadge emblem={clan.emblem} size={52} title={clan.name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-label-md font-semibold text-on-surface">{clan.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-label-sm text-on-surface-variant">
            <span className="font-mono text-[11px]">[{clan.tag}]</span>
            <span aria-hidden>·</span>
            <span>{fill(labels.levelTemplate, { level })}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-label-sm text-on-surface-variant">
            <span>{labels.focuses[clan.focus]}</span>
            <span aria-hidden>·</span>
            <ClanAffinityChip
              affinity={clan.affinity}
              label={labels.affinities[clan.affinity]}
              size="sm"
            />
            <ClanAffinityBuffMicro
              affinity={clan.affinity}
              label={labels.buffLabel}
              hint={fill(labels.buffHintTemplate, {
                leftLabel: buff.leftLabel,
                leftValue: buff.leftValue,
                rightLabel: buff.rightLabel,
                rightValue: buff.rightValue,
              })}
            />
          </p>
          <p className="mt-1 text-label-sm text-on-surface-variant">
            {fill(labels.membersTemplate, {
              count: clan.memberCount,
              max: CLAN_MAX_MEMBERS,
            })}
            {" · "}
            {fill(labels.powerTemplate, { value: clan.power })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/clans/${clan.id}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-white/15 px-3 text-label-sm text-on-surface hover:border-white/30"
        >
          {labels.viewClan}
        </Link>
        <Link
          href={`/clans/${clan.id}`}
          className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-label-sm ${
            full || clan.joinPolicy === "INVITE"
              ? "border border-white/10 text-on-surface-variant"
              : "ui-btn-primary"
          }`}
        >
          {joinLabel}
        </Link>
      </div>
    </article>
  );
}
