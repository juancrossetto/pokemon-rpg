"use client";

import { useState, type ReactNode } from "react";
import { CurrentExpedition, type CurrentExpeditionProps } from "@/components/current-expedition";
import { ActiveTeamStrip } from "@/components/home/active-team-strip";
import { HomeSquadCards } from "@/components/home/home-squad-cards";
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
import type { HeldItemLabels, OwnedHeldItem } from "@/components/held-item-panel";
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
  dailyActions: {
    title: string;
    items: Record<string, string>;
    statusReady: string;
    statusHealthy: string;
    statusHealthyCooldown: string;
    statusRush: string;
  };
  eventsPanel: {
    progressTitle: string;
    objectivesTitle: string;
    rewardsTitle: string;
    emptyAdventure: string;
    emptyWeekly: string;
    emptyEvent: string;
    claimable: string;
    claimAction: string;
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
  routeHero,
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
  /** Hero mobile (Server Component armado en la page). */
  routeHero: ReactNode;
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
    ownedHeldItems: OwnedHeldItem[];
    heldLabels: HeldItemLabels;
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
    <div className="relative flex min-w-0 flex-col overflow-x-clip">
      <JourneyOnboarding />
      <div className="relative flex min-w-0 flex-col px-margin-mobile py-2 md:px-margin-desktop md:py-5">
        <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-2.5 md:gap-5 xl:max-w-6xl xl:gap-5 2xl:max-w-7xl">
          {/*
            Cabecera a todo el ancho del hub: en mobile sangra al viewport; en
            xl+ cubre rail + columna (más ancha que equipo/eventos de abajo).
          */}
          <div className="home-identity-wrap -mx-margin-mobile md:-mx-margin-desktop xl:mx-0">
            <HomeIdentityBanner
              identity={bannerIdentity}
              labels={hubLabels.identity}
              frameId={bannerIdentity.homeFrameId ?? undefined}
            />
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
                El `NextStepCard` también queda fuera de mobile: el hero ya es
                el llamado a la acción y dos compitiendo es justo lo que este
                rediseño vino a sacar.
              */}
              {routeHero}

              {expedition ? (
                <div className="hidden lg:block xl:hidden">
                  <CurrentExpedition {...expedition} />
                </div>
              ) : null}

              {nextStep && <div className="hidden shrink-0 lg:block">{nextStep}</div>}

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
                onCompanionTypesChange={setCompanionTypes}
              />

              <section className="home-ops-deck game-float-card hidden min-w-0 overflow-visible rounded-[1.25rem] p-2.5 sm:p-3 lg:block">
                {/* Quick access / acciones diarias: solo desktop; en mobile el
                    chrome ya cubre esos destinos y ocupaba demasiado el home. */}
                <div className="hidden xl:block">
                  <HomeDailyActions
                    actions={dailyActions}
                    labels={hubLabels.dailyActions}
                  />
                  <div className="home-ops-deck__rule my-2.5 sm:my-3" aria-hidden />
                </div>

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
                  onCompanionTypesChange={setCompanionTypes}
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
