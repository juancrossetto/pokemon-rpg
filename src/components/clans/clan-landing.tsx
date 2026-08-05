"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ClanDiscovery, type DiscoveryClan } from "@/components/clans/clan-discovery";
import { ClanCreateWizard } from "@/components/clans/clan-create-wizard";
import { ClanCard, type ClanCardLabels } from "@/components/clans/clan-card";
import { ClanOverlay } from "@/components/clans/clan-overlay";
import { CLAN_MAX_MEMBERS } from "@/lib/clan-rules";

type WizardLabels = Parameters<typeof ClanCreateWizard>[0]["labels"];

type DiscoveryLabels = Parameters<typeof ClanDiscovery>[0]["labels"];

type LandingLabels = {
  eyebrow: string;
  title: string;
  subtitle: string;
  searchClan: string;
  createClan: string;
  actionsTitle: string;
  recommendedTitle: string;
  whyJoinTitle: string;
  listTitle: string;
  close: string;
  heroStatus: string;
  heroHint: string;
  statClans: string;
  statOpen: string;
  statInvites: string;
  benefits: string[];
  card: ClanCardLabels;
  empty: string;
};

type OverlayView = "discover" | "create";

const BENEFIT_ICONS = ["flag", "trending_up", "swords", "forum"] as const;

export function ClanLanding({
  locale,
  coins,
  clans,
  inviteCount = 0,
  wizardLabels,
  discoveryLabels,
  labels,
  alerts,
}: {
  locale: string;
  coins: number;
  clans: DiscoveryClan[];
  inviteCount?: number;
  wizardLabels: WizardLabels;
  discoveryLabels: DiscoveryLabels;
  labels: LandingLabels;
  /** Invites / solicitud pendiente — ya con markup del page. */
  alerts?: ReactNode;
}) {
  const [overlay, setOverlay] = useState<OverlayView | null>(null);
  const recommended = useMemo(() => clans.slice(0, 3), [clans]);
  const openCount = useMemo(
    () =>
      clans.filter(
        (c) => c.joinPolicy === "OPEN" && c.memberCount < CLAN_MAX_MEMBERS,
      ).length,
    [clans],
  );
  const closeOverlay = useCallback(() => setOverlay(null), []);

  return (
    <>
      <div className="clans-arena relative isolate flex-1 overflow-x-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,color-mix(in_srgb,var(--color-pokeball-red)_18%,transparent),transparent_45%),radial-gradient(ellipse_at_95%_8%,color-mix(in_srgb,var(--color-electric-yellow)_10%,transparent),transparent_40%)]"
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-3 py-3 pb-6 sm:px-margin-desktop sm:py-6 sm:pb-8">
          <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
            <div className="min-w-0">
              <p className="mb-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em]">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-pokeball-red shadow-[0_0_8px_color-mix(in_srgb,var(--color-pokeball-red)_55%,transparent)]"
                />
                <span className="text-pokeball-red/90">{labels.eyebrow}</span>
              </p>
              <h1 className="page-title text-[clamp(1.45rem,5vw,2.4rem)] font-semibold leading-none tracking-tight text-white">
                {labels.title}
              </h1>
              <p className="mt-1.5 max-w-xl text-[13px] text-white/45">{labels.subtitle}</p>
            </div>
          </div>

          {alerts}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)] lg:gap-5 lg:items-start">
            <div className="flex min-w-0 flex-col gap-4">
              {/* Mobile: acciones primero */}
              <div className="lg:hidden">
                <ActionsPanel
                  title={labels.actionsTitle}
                  searchLabel={labels.searchClan}
                  createLabel={labels.createClan}
                  onSearch={() => setOverlay("discover")}
                  onCreate={() => setOverlay("create")}
                />
              </div>

              <section className="game-float-card relative overflow-hidden rounded-2xl">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,color-mix(in_srgb,var(--color-pokeball-red)_14%,transparent),transparent_55%)]"
                />
                <div className="relative flex flex-col gap-5 p-4 sm:p-5 md:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                      {labels.heroStatus}
                    </p>
                    <button
                      type="button"
                      onClick={() => setOverlay("discover")}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45 transition hover:text-white"
                    >
                      <span className="material-symbols-outlined text-[14px]!">group</span>
                      {labels.listTitle}
                    </button>
                  </div>

                  <div className="flex items-end gap-4 sm:gap-5">
                    <div className="min-w-0 flex-1">
                      <p className="page-title pt-0.5 text-[clamp(2.75rem,10vw,4.5rem)] leading-[1.05] tracking-wide text-white">
                        {clans.length}
                      </p>
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
                        {labels.heroHint}
                      </p>
                    </div>
                    <span
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 sm:h-[4.5rem] sm:w-[4.5rem]"
                      aria-hidden
                    >
                      <span className="material-symbols-outlined text-[2rem]! text-pokeball-red sm:text-[2.25rem]!">
                        groups
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 border-y border-white/8 py-3 sm:gap-2">
                    <Kpi label={labels.statClans} value={String(clans.length)} />
                    <Kpi label={labels.statOpen} value={String(openCount)} />
                    <Kpi
                      label={labels.statInvites}
                      value={String(inviteCount)}
                      hot={inviteCount > 0}
                    />
                  </div>
                </div>
              </section>

              <section className="game-float-card rounded-2xl p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                      {labels.recommendedTitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOverlay("discover")}
                    className="shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45 transition hover:text-white"
                  >
                    {labels.listTitle}
                  </button>
                </div>
                {recommended.length === 0 ? (
                  <p className="text-[13px] text-white/40">{labels.empty}</p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-1 md:grid-cols-1">
                    {recommended.map((clan) => (
                      <li key={clan.id}>
                        <ClanCard clan={clan} labels={labels.card} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="game-float-card rounded-2xl p-4 sm:p-5">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  {labels.whyJoinTitle}
                </p>
                <ul className="grid grid-cols-2 gap-2">
                  {labels.benefits.map((benefit, i) => (
                    <li
                      key={benefit}
                      className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-black/25 p-3"
                    >
                      <span className="material-symbols-outlined mt-0.5 text-[18px]! text-pokeball-red">
                        {BENEFIT_ICONS[i] ?? "check_circle"}
                      </span>
                      <p className="text-[12px] leading-snug text-white/70">{benefit}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="hidden min-w-0 flex-col gap-4 lg:flex">
              <ActionsPanel
                title={labels.actionsTitle}
                searchLabel={labels.searchClan}
                createLabel={labels.createClan}
                onSearch={() => setOverlay("discover")}
                onCreate={() => setOverlay("create")}
              />
            </aside>
          </div>
        </div>
      </div>

      {overlay === "discover" ? (
        <ClanOverlay
          open
          onClose={closeOverlay}
          title={labels.listTitle}
          closeLabel={labels.close}
          size="xl"
        >
          <ClanDiscovery
            clans={clans}
            labels={discoveryLabels}
            showCreateHref
            compact
            onCreateClick={() => setOverlay("create")}
          />
        </ClanOverlay>
      ) : null}

      {overlay === "create" ? (
        <ClanOverlay
          open
          onClose={closeOverlay}
          title={labels.createClan}
          closeLabel={labels.close}
          size="xl"
        >
          <ClanCreateWizard locale={locale} coins={coins} labels={wizardLabels} inModal />
        </ClanOverlay>
      ) : null}
    </>
  );
}

function ActionsPanel({
  title,
  searchLabel,
  createLabel,
  onSearch,
  onCreate,
}: {
  title: string;
  searchLabel: string;
  createLabel: string;
  onSearch: () => void;
  onCreate: () => void;
}) {
  return (
    <section className="game-float-card rounded-2xl p-3.5 sm:p-5">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {title}
      </p>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onSearch}
          className="ui-btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-[12px] font-semibold uppercase tracking-[0.06em]"
        >
          <span className="material-symbols-outlined text-[18px]!">search</span>
          {searchLabel}
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/4 px-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/85 transition hover:border-white/28 hover:bg-white/8"
        >
          <span className="material-symbols-outlined text-[18px]!">add</span>
          {createLabel}
        </button>
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  hot,
}: {
  label: string;
  value: string;
  hot?: boolean;
}) {
  return (
    <div className="min-w-0 text-center sm:text-left">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
      <p
        className={`mt-1 font-mono text-[1.05rem] font-bold tabular-nums leading-none sm:text-[1.2rem] ${
          hot ? "text-electric-yellow" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
