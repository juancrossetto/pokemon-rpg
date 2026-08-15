"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CurrentExpedition, type CurrentExpeditionProps } from "@/components/current-expedition";
import { ActiveTeamStrip } from "@/components/home/active-team-strip";
import { HomeSquadCards } from "@/components/home/home-squad-cards";
import { DailyGiftModal, type GiftModalLabels } from "@/components/events/daily-gift-modal";
import {
  HomeEventsProgress,
  type HomeEventsAdventure,
  type HomeEventsLimited,
  type HomeEventsWeekly,
} from "@/components/home/home-world-panels";
import type { HomeSquadMember } from "@/components/home/squad-types";
import type { HeldItemLabels, OwnedHeldItem } from "@/components/held-item-panel";
import type { DailyState } from "@/lib/events/state";
import type { SquadBagCounts } from "@/lib/squad-bag";
import type {
  HomeRailClanWars,
  HomeRailPvp,
} from "@/lib/home-hub";
import {
  HomeEventCarousel,
  HomeEventHero,
  type HomeEventShowcaseData,
} from "@/components/home/home-event-showcase";
import { HealTutorial, JourneyOnboarding } from "@/components/journey-guidance";
import { hasSeen } from "@/lib/journey-ux";
import {
  HomeDesktopRail,
  type HomeRailRankEntry,
} from "@/components/home/home-desktop-rail";

export type HomeHubLabels = {
  eventsPanel: {
    progressTitle: string;
    objectivesTitle: string;
    rewardsTitle: string;
    emptyAdventure: string;
    emptyWeekly: string;
    emptyEvent: string;
    claimable: string;
    claimAction: string;
    fightAction: string;
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
    rewardCoins: string;
  };
};

export function HomeGameHub({
  locale,
  expedition,
  routeHero,
  eventShowcase,
  events,
  giftLabels,
  squad,
  rail,
  adventure,
  weekly,
  limited,
  hubLabels,
}: {
  locale: string;
  expedition: CurrentExpeditionProps | null;
  /** Hero mobile (Server Component armado en la page). */
  routeHero: ReactNode;
  /** Hero superior + carrusel de eventos activos. */
  eventShowcase: HomeEventShowcaseData;
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
    ownedHeldItems: OwnedHeldItem[];
    heldLabels: HeldItemLabels;
    layoutKey: string;
    title: string;
    manageHref: string;
    manageLabel: string;
    heal?: {
      needsHealing: boolean;
      cooldownMsLeft: number;
      rushCost: number;
      coins: number;
      teamMaxLevel: number;
    } | null;
  };
  rail: {
    pvp: HomeRailPvp;
    clanWars: HomeRailClanWars;
    top: HomeRailRankEntry[];
  };
  adventure: HomeEventsAdventure;
  weekly: HomeEventsWeekly;
  limited: HomeEventsLimited;
  hubLabels: HomeHubLabels;
}) {
  const [healTutorialArmed, setHealTutorialArmed] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setHealTutorialArmed(hasSeen("journey-onboarding"));
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  const hasFainted = squad.members.some((m) => m.currentHp <= 0);

  return (
    <div className="relative flex min-w-0 flex-col overflow-x-clip">
      <JourneyOnboarding onDismiss={() => setHealTutorialArmed(true)} />
      <HealTutorial active={hasFainted && healTutorialArmed} />
      <div className="relative flex min-w-0 flex-col px-margin-mobile py-2 md:px-margin-desktop md:py-5">
        <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-2.5 md:gap-5 xl:max-w-6xl xl:gap-5 2xl:max-w-7xl">
          {/* El hero es un banner panorámico: en mobile ocupaba media pantalla
              antes de llegar a cualquier acción. Ahí el carrusel de eventos ya
              cumple esa función. */}
          <div className="hidden md:-mx-margin-desktop md:block xl:mx-0">
            <HomeEventHero data={eventShowcase} locale={locale} />
          </div>

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

          <div className="flex min-w-0 gap-4 md:gap-5">
            <HomeDesktopRail
              pvp={rail.pvp}
              clanWars={rail.clanWars}
              top={rail.top}
              expedition={expedition}
            />

            <div className="home-body-stack mx-auto flex min-w-0 flex-1 flex-col gap-2.5 md:gap-6 xl:gap-5">
              {/*
                Mobile lleva el hero de ruta (arte de mapa + CTA único); de lg
                para arriba sigue `CurrentExpedition`, que aprovecha el ancho.
                La card de "próximo paso" salió del home: la aventura ya se
                traza en la card de zona del rail, y dos CTA compitiendo era
                justo lo que este rediseño vino a sacar.
              */}
              {routeHero}

              {expedition ? (
                <div className="hidden lg:block xl:hidden">
                  <CurrentExpedition {...expedition} />
                </div>
              ) : null}

              <HomeEventCarousel data={eventShowcase} />

              {/*
                Mobile: squad suelto — las cards ya son el frame. El glass
                `home-ops-deck` sólo tiene sentido en lg+ (strip + diarias xl).
              */}
              <HomeSquadCards
                locale={locale}
                initialMembers={squad.members}
                title={squad.title}
                manageHref={squad.manageHref}
                manageLabel={squad.manageLabel}
                leadLabel={squad.leadLabel}
                initialBagCounts={squad.bagCounts}
                ownedHeldItems={squad.ownedHeldItems}
                heldLabels={squad.heldLabels}
                heal={squad.heal}
              />

              <section className="home-ops-deck game-float-card hidden min-w-0 overflow-visible rounded-[1.25rem] p-2.5 sm:p-3 lg:block">
                <ActiveTeamStrip
                  key={squad.layoutKey}
                  locale={locale}
                  initialMembers={squad.members}
                  emptySlotLabel={squad.emptySlotLabel}
                  leadLabel={squad.leadLabel}
                  slotLabels={squad.slotLabels}
                  initialBagCounts={squad.bagCounts}
                  ownedHeldItems={squad.ownedHeldItems}
                  heldLabels={squad.heldLabels}
                  title={squad.title}
                  manageHref={squad.manageHref}
                  manageLabel={squad.manageLabel}
                />
              </section>

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
    </div>
  );
}
