"use client";

import { useState, type ReactNode } from "react";
import { CurrentExpedition, type CurrentExpeditionProps } from "@/components/current-expedition";
import { ActiveTeamStrip } from "@/components/home/active-team-strip";
import { DailyGiftModal, type GiftModalLabels } from "@/components/events/daily-gift-modal";
import { HomeIdentityBanner } from "@/components/home/home-identity-banner";
import {
  HomeDailyActions,
  HomeEventsProgress,
  type HomeEventsAdventure,
  type HomeEventsLimited,
  type HomeEventsWeekly,
} from "@/components/home/home-world-panels";
import type { HomeSquadMember } from "@/components/home/squad-types";
import type { DailyState } from "@/lib/events/state";
import type { SquadBagCounts } from "@/lib/squad-bag";
import type {
  HomeDailyAction,
  HomeIdentity,
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
    pvpTiers: Record<string, string>;
    lastAchievement: string;
    achievements: Record<string, string>;
  };
  dailyActions: { title: string; items: Record<string, string> };
  eventsPanel: {
    progressTitle: string;
    emptyAdventure: string;
    emptyWeekly: string;
    emptyEvent: string;
    claimable: string;
    claimed: string;
    openCampaign: string;
    openEvents: string;
    tabAdventure: string;
    tabWeekly: string;
    tabEvent: string;
    weeklyReady: string;
    objectiveLabels: Record<string, string>;
    weeklyLabels: Record<string, string>;
    missionLabels: Record<string, string>;
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
  adventure,
  weekly,
  limited,
  dailyActions,
  hubLabels,
}: {
  locale: string;
  expedition: CurrentExpeditionProps | null;
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
  adventure: HomeEventsAdventure;
  weekly: HomeEventsWeekly;
  limited: HomeEventsLimited;
  dailyActions: HomeDailyAction[];
  hubLabels: HomeHubLabels;
}) {
  // Acento del banner = tipos del favorito. Vive en estado local para
  // cambiar al marcar estrella, sin esperar el RSC refresh del home.
  const [companionTypes, setCompanionTypes] = useState(identity.companionTypes);
  const [lastServerTypes, setLastServerTypes] = useState(identity.companionTypes);
  if (lastServerTypes !== identity.companionTypes) {
    setLastServerTypes(identity.companionTypes);
    setCompanionTypes(identity.companionTypes);
  }

  const bannerIdentity: HomeIdentity = {
    ...identity,
    companionTypes,
  };

  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
      <JourneyOnboarding />
      <div className="relative flex min-w-0 flex-col px-margin-mobile py-2 md:px-margin-desktop md:py-5">
        <div className="mx-auto flex w-full min-w-0 max-w-3xl gap-4 md:gap-5 xl:max-w-6xl 2xl:max-w-7xl">
          <HomeDesktopRail
            pvp={rail.pvp}
            clanWars={rail.clanWars}
            top={rail.top}
            expedition={expedition}
          />

          <div className="mx-auto flex min-w-0 flex-1 flex-col gap-2.5 md:gap-6 xl:gap-5">
            <HomeIdentityBanner identity={bannerIdentity} labels={hubLabels.identity} />

            {events.showDailyModal && (
              <DailyGiftModal
                days={events.daily.days}
                currentDay={events.daily.currentDay}
                total={events.daily.length}
                labels={giftLabels}
                locale={locale}
                showChip={false}
              />
            )}

            {expedition ? (
              <div className="xl:hidden">
                <CurrentExpedition {...expedition} />
              </div>
            ) : null}

            {nextStep && <div className="shrink-0">{nextStep}</div>}

            <HomeDailyActions
              actions={dailyActions}
              labels={hubLabels.dailyActions}
            />

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
              onCompanionTypesChange={setCompanionTypes}
            />

            <HomeEventsProgress
              adventure={adventure}
              weekly={weekly}
              limited={limited}
              labels={hubLabels.eventsPanel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
