"use client";

import { CurrentExpedition, type CurrentExpeditionProps } from "@/components/current-expedition";
import { ActiveTeamStrip } from "@/components/home/active-team-strip";
import { DailyGiftModal, type GiftModalLabels } from "@/components/events/daily-gift-modal";
import { CampaignDevPanel } from "@/components/campaign-dev-panel";
import type { HomeSquadMember } from "@/components/home/squad-types";
import type { DailyState } from "@/lib/events/state";
import type { SquadBagCounts } from "@/lib/squad-bag";
import { JourneyOnboarding } from "@/components/journey-guidance";

export function HomeGameHub({
  locale,
  expedition,
  events,
  giftLabels,
  squad,
  isDev,
}: {
  locale: string;
  expedition: CurrentExpeditionProps | null;
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
    manageLabel: string;
    title: string;
    bagCounts: SquadBagCounts;
    layoutKey: string;
  };
  isDev: boolean;
}) {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
      <JourneyOnboarding />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col px-margin-mobile py-3 md:px-margin-desktop md:py-5">
        <div className="mx-auto flex w-full min-h-0 min-w-0 max-w-3xl flex-1 flex-col gap-3 md:gap-4 xl:max-w-5xl">
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

          {/* Primera jugada: expedición + equipo. Los atajos que había debajo
              (Batalla, Tienda, Gimnasios) duplicaban destinos que ya están en
              la barra de navegación; Eventos volvió a la nav, que es donde
              corresponde que viva un destino. */}
          {expedition ? (
            <div className="shrink-0">
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
            manageLabel={squad.manageLabel}
            title={squad.title}
            initialBagCounts={squad.bagCounts}
          />

          {isDev && (
            <div className="shrink-0">
              <CampaignDevPanel locale={locale} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
