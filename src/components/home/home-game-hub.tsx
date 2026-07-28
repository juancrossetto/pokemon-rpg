"use client";

import { CurrentExpedition, type CurrentExpeditionProps } from "@/components/current-expedition";
import { IdleRewardWidget, type IdleRewardLabels } from "@/components/home/idle-reward-widget";
import { ActiveTeamStrip } from "@/components/home/active-team-strip";
import { QuickGameActions, type QuickAction } from "@/components/home/quick-game-actions";
import { DailyGiftModal, type GiftModalLabels } from "@/components/events/daily-gift-modal";
import { CampaignDevPanel } from "@/components/campaign-dev-panel";
import type { HomeSquadMember } from "@/components/home/squad-types";
import type { DailyState, WeeklyState } from "@/lib/events/state";
import type { SquadBagCounts } from "@/lib/squad-bag";
import { JourneyOnboarding } from "@/components/journey-guidance";
import { HubRoleHint } from "@/components/hub-role-hint";
import { useTranslations } from "next-intl";

export function HomeGameHub({
  locale,
  expedition,
  events,
  giftLabels,
  idleLabels,
  squad,
  quickActions,
  quickTitle,
  isDev,
}: {
  locale: string;
  expedition: CurrentExpeditionProps | null;
  events: {
    daily: DailyState;
    weekly: WeeklyState;
    pendingCount: number;
    showDailyModal: boolean;
  };
  giftLabels: GiftModalLabels;
  idleLabels: IdleRewardLabels;
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
  quickActions: QuickAction[];
  quickTitle: string;
  isDev: boolean;
}) {
  const tUx = useTranslations("ux");

  return (
    <div className="relative flex-1 overflow-x-hidden">
      <JourneyOnboarding />
      <div className="relative px-margin-mobile py-3 md:px-margin-desktop md:py-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 xl:max-w-5xl">
          <HubRoleHint>{tUx("role.home")}</HubRoleHint>

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

          {/* Primera jugada: expedición + equipo. Recompensas y atajos debajo. */}
          {expedition ? <CurrentExpedition {...expedition} /> : null}

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

          <IdleRewardWidget
            locale={locale}
            daily={events.daily}
            weekly={events.weekly}
            pendingCount={events.pendingCount}
            labels={idleLabels}
          />

          <QuickGameActions title={quickTitle} actions={quickActions} />

          {isDev && <CampaignDevPanel locale={locale} />}
        </div>
      </div>
    </div>
  );
}
