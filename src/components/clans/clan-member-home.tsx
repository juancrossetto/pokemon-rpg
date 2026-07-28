import { Link } from "@/i18n/navigation";
import { ClanAffinityChip } from "@/components/clans/clan-affinity-chip";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { CLAN_MAX_MEMBERS } from "@/lib/clan-rules";
import type { ClanAffinity, ClanFocus, ClanRoleId } from "@/lib/clan-types";
import type { DiscoveryClan } from "@/components/clans/clan-discovery";

export type ClanMemberHomeLabels = {
  directoryTitle: string;
  emptyDirectory: string;
  formatMemberCount: (count: number, max: number) => string;
  roles: Record<ClanRoleId, string>;
  affinities: Record<ClanAffinity, string>;
  focuses: Record<ClanFocus, string>;
  eyebrow: string;
  enterHub: string;
  yourRank: (rank: number) => string;
  statRank: string;
  statMembers: string;
  statPower: string;
  statFocus: string;
};

type MyClan = {
  id: string;
  name: string;
  tag: string;
  motto: string | null;
  emblem: unknown;
  affinity: ClanAffinity;
  focus: ClanFocus;
  role: ClanRoleId;
  memberCount: number;
  power: number;
  rank: number;
};

function rankTone(rank: number): string {
  if (rank === 1) return "text-electric-yellow";
  if (rank === 2) return "text-on-surface";
  if (rank === 3) return "text-amber-600";
  return "text-on-surface-variant";
}

function roleTone(role: ClanRoleId): string {
  if (role === "LEADER") return "text-electric-yellow border-electric-yellow/30 bg-electric-yellow/10";
  if (role === "OFFICER") return "text-tertiary border-tertiary/30 bg-tertiary/10";
  return "text-on-surface-variant border-white/10 bg-white/5";
}

export function ClanMemberHome({
  clan,
  ranking,
  labels,
}: {
  clan: MyClan;
  ranking: DiscoveryClan[];
  labels: ClanMemberHomeLabels;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/clans/${clan.id}`}
        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md transition-[border-color,transform] hover:-translate-y-0.5 hover:border-white/20"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 12% 0%, rgba(255,255,255,0.06), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(52,211,153,0.08), transparent 50%)",
          }}
          aria-hidden
        />

        <div className="relative flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-5 md:p-5">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <ClanEmblemBadge emblem={clan.emblem} size={64} title={clan.name} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                {labels.eyebrow}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-on-surface-variant">
                  [{clan.tag}]
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleTone(clan.role)}`}
                >
                  {labels.roles[clan.role]}
                </span>
              </div>
              <h2 className="mt-1 truncate text-headline-md text-white">{clan.name}</h2>
              {clan.motto ? (
                <p className="mt-0.5 truncate text-label-sm italic text-on-surface-variant">
                  “{clan.motto}”
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end md:gap-3">
            <ClanAffinityChip
              affinity={clan.affinity}
              label={labels.affinities[clan.affinity]}
              size="sm"
            />
            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-label-sm text-on-surface-variant transition-colors group-hover:border-tertiary/40 group-hover:text-on-surface">
              {labels.enterHub}
              <span className="material-symbols-outlined text-[18px]!">arrow_forward</span>
            </span>
          </div>
        </div>

        <div className="relative grid grid-cols-2 divide-x divide-white/5 border-t border-white/5 sm:grid-cols-4">
          <StatCell
            icon="leaderboard"
            label={labels.statRank}
            value={`#${clan.rank}`}
            accent={rankTone(clan.rank)}
          />
          <StatCell
            icon="group"
            label={labels.statMembers}
            value={labels.formatMemberCount(clan.memberCount, CLAN_MAX_MEMBERS)}
          />
          <StatCell
            icon="bolt"
            label={labels.statPower}
            value={String(clan.power)}
            accent="text-electric-yellow"
          />
          <StatCell icon="flag" label={labels.statFocus} value={labels.focuses[clan.focus]} />
        </div>
      </Link>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
            <span className="material-symbols-outlined text-tertiary text-[20px]!">leaderboard</span>
            {labels.directoryTitle}
          </h2>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            {labels.yourRank(clan.rank)}
          </span>
        </div>

        {ranking.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-on-surface-variant">
            {labels.emptyDirectory}
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {ranking.map((c) => {
              const isMine = c.id === clan.id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/clans/${c.id}`}
                    className={`group flex items-center gap-3 rounded-xl border px-3 py-3 transition-all ${
                      isMine
                        ? "border-tertiary/35 bg-tertiary/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        : "border-white/10 bg-[#0c0e14]/70 hover:border-white/20 hover:bg-white/[0.03]"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 font-mono text-label-md font-bold ${rankTone(c.rank)}`}
                    >
                      {c.rank}
                    </span>
                    <ClanEmblemBadge emblem={c.emblem} size={40} title={c.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-on-surface-variant">
                          [{c.tag}]
                        </span>
                        <span className="truncate text-label-md text-on-surface">{c.name}</span>
                        {isMine ? (
                          <span className="rounded-full border border-tertiary/30 bg-tertiary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-tertiary">
                            {labels.eyebrow}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <ClanAffinityChip
                          affinity={c.affinity}
                          label={labels.affinities[c.affinity]}
                          size="sm"
                        />
                        <span className="text-label-sm text-on-surface-variant">
                          {labels.formatMemberCount(c.memberCount, CLAN_MAX_MEMBERS)}
                          {" · "}
                          {c.power}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined shrink-0 text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100">
                      chevron_right
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function StatCell({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
        <span className="material-symbols-outlined text-[14px]!">{icon}</span>
        {label}
      </span>
      <span className={`truncate text-label-md font-semibold text-on-surface ${accent ?? ""}`}>
        {value}
      </span>
    </div>
  );
}
