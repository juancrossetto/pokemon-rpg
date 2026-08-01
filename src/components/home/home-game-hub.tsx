"use client";

import type { ReactNode } from "react";
import { CurrentExpedition, type CurrentExpeditionProps } from "@/components/current-expedition";
import { ActiveTeamStrip } from "@/components/home/active-team-strip";
import { DailyGiftModal, type GiftModalLabels } from "@/components/events/daily-gift-modal";
import { CampaignDevPanel } from "@/components/campaign-dev-panel";
import { HomeIdentityBanner } from "@/components/home/home-identity-banner";
import {
  HomeMissionsCarousel,
  HomeQuickAccess,
} from "@/components/home/home-world-panels";
import type { HomeSquadMember } from "@/components/home/squad-types";
import type { DailyState } from "@/lib/events/state";
import type { SquadBagCounts } from "@/lib/squad-bag";
import type {
  HomeIdentity,
  HomeObjective,
  HomeQuickLink,
  HomeRailClanWars,
  HomeRailPvp,
} from "@/lib/home-hub";
import { JourneyOnboarding } from "@/components/journey-guidance";
import {
  HomeDesktopRail,
  type HomeRailRankEntry,
} from "@/components/home/home-desktop-rail";

export type HomeHubLabels = {
  identity: {
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
  quickAccess: { title: string; items: Record<string, string> };
  objectives: {
    title: string;
    empty: string;
    rewards: string;
    claimable: string;
    claimed: string;
    go: string;
    openCampaign: string;
    objectiveLabels: Record<string, string>;
  };
};

export function HomeGameHub({
  locale,
  expedition,
  nextStep,
  events,
  giftLabels,
  squad,
  rail,
  identity,
  objectives,
  objectiveZoneName,
  quickLinks,
  hubLabels,
  isDev,
}: {
  locale: string;
  expedition: CurrentExpeditionProps | null;
  /**
   * Card de "próximo paso", ya renderizada en el servidor. Llega como slot
   * porque este componente es de cliente y el copy se resuelve con
   * `getTranslations`; viene `null` mientras el hero de expedición alcance.
   */
  nextStep: ReactNode;
  events: {
    daily: DailyState;
    showDailyModal: boolean;
  };
  giftLabels: GiftModalLabels;
  squad: {
    members: HomeSquadMember[];
    emptySlotLabel: string;
    leadLabel: string;
    slotLabels: string[];
    bagCounts: SquadBagCounts;
    layoutKey: string;
    title: string;
    manageHref: string;
    manageLabel: string;
  };
  rail: {
    pvp: HomeRailPvp;
    clanWars: HomeRailClanWars;
    top: HomeRailRankEntry[];
  };
  identity: HomeIdentity;
  objectives: HomeObjective[];
  objectiveZoneName: string | null;
  quickLinks: HomeQuickLink[];
  hubLabels: HomeHubLabels;
  isDev: boolean;
}) {
  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
      <JourneyOnboarding />
      <div className="relative flex min-w-0 flex-col px-margin-mobile py-3 md:px-margin-desktop md:py-5">
        <div className="mx-auto flex w-full min-w-0 max-w-3xl gap-4 md:gap-5 xl:max-w-6xl 2xl:max-w-7xl">
          <HomeDesktopRail
            pvp={rail.pvp}
            clanWars={rail.clanWars}
            top={rail.top}
            expedition={expedition}
          />

          <div className="mx-auto flex min-w-0 flex-1 flex-col gap-5 md:gap-6 xl:gap-5">
            {/* Reserva la altura de la expedición del rail; Quick Access llena el hueco. */}
            <div className="flex flex-col gap-4 xl:min-h-[12.25rem]">
              <HomeIdentityBanner identity={identity} labels={hubLabels.identity} />
              <HomeQuickAccess links={quickLinks} labels={hubLabels.quickAccess} />
            </div>

            {events.showDailyModal && (
              <DailyGiftModal
                days={events.daily.days}
                currentDay={events.daily.currentDay}
                total={events.daily.length}
                labels={giftLabels}
                locale={locale}
                showChip
              />
            )}

            {nextStep && <div className="shrink-0">{nextStep}</div>}

            {/* Mobile / tablet: el rail está oculto, acá va la expedición. */}
            {expedition ? (
              <div className="xl:hidden">
                <CurrentExpedition {...expedition} />
              </div>
            ) : null}

            <ActiveTeamStrip
              key={squad.layoutKey}
              locale={locale}
              initialMembers={squad.members}
              emptySlotLabel={squad.emptySlotLabel}
              leadLabel={squad.leadLabel}
              slotLabels={squad.slotLabels}
              initialBagCounts={squad.bagCounts}
              title={squad.title}
              manageHref={squad.manageHref}
              manageLabel={squad.manageLabel}
            />

            <HomeMissionsCarousel
              zoneName={objectiveZoneName}
              objectives={objectives}
              labels={hubLabels.objectives}
            />

            {isDev ? (
              <div className="shrink-0 opacity-80">
                <CampaignDevPanel locale={locale} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
