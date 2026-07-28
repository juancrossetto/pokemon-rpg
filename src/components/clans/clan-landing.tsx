"use client";

import { useCallback, useMemo, useState } from "react";
import { ClanDiscovery, type DiscoveryClan } from "@/components/clans/clan-discovery";
import { ClanCreateWizard } from "@/components/clans/clan-create-wizard";
import { ClanCard, type ClanCardLabels } from "@/components/clans/clan-card";
import { ClanOverlay } from "@/components/clans/clan-overlay";

type WizardLabels = Parameters<typeof ClanCreateWizard>[0]["labels"];

type DiscoveryLabels = Parameters<typeof ClanDiscovery>[0]["labels"];

type LandingLabels = {
  title: string;
  subtitle: string;
  searchClan: string;
  createClan: string;
  recommendedTitle: string;
  whyJoinTitle: string;
  listTitle: string;
  close: string;
  benefits: string[];
  card: ClanCardLabels;
  empty: string;
};

type OverlayView = "discover" | "create";

export function ClanLanding({
  locale,
  coins,
  clans,
  wizardLabels,
  discoveryLabels,
  labels,
}: {
  locale: string;
  coins: number;
  clans: DiscoveryClan[];
  wizardLabels: WizardLabels;
  discoveryLabels: DiscoveryLabels;
  labels: LandingLabels;
}) {
  const [overlay, setOverlay] = useState<OverlayView | null>(null);
  const recommended = useMemo(() => clans.slice(0, 2), [clans]);
  const closeOverlay = useCallback(() => setOverlay(null), []);

  return (
    <>
      <div className="flex flex-col gap-5">
        <section className="rounded-2xl border border-white/10 bg-[#0c0f16]/90 p-4 md:p-5">
          <h2 className="text-headline-lg text-on-surface">{labels.title}</h2>
          <p className="mt-1 text-label-md text-on-surface-variant">{labels.subtitle}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setOverlay("discover")}
              className="min-h-11 rounded-xl bg-pokeball-red px-4 text-label-md text-white hover:bg-pokeball-red/85"
            >
              {labels.searchClan}
            </button>
            <button
              type="button"
              onClick={() => setOverlay("create")}
              className="min-h-11 rounded-xl border border-white/15 px-4 text-label-md text-on-surface hover:border-white/25"
            >
              {labels.createClan}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-glass-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-headline-md text-on-surface">{labels.recommendedTitle}</h3>
            <button
              type="button"
              onClick={() => setOverlay("discover")}
              className="min-h-11 px-3 text-label-sm text-tertiary hover:text-on-surface"
            >
              {labels.listTitle}
            </button>
          </div>
          {recommended.length === 0 ? (
            <p className="text-label-sm text-on-surface-variant">{labels.empty}</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {recommended.map((clan) => (
                <li key={clan.id}>
                  <ClanCard clan={clan} labels={labels.card} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-glass-surface p-4">
          <h3 className="text-label-md text-on-surface">{labels.whyJoinTitle}</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            {labels.benefits.map((benefit) => (
              <li key={benefit} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                <p className="text-label-sm text-on-surface-variant">{benefit}</p>
              </li>
            ))}
          </ul>
        </section>
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
