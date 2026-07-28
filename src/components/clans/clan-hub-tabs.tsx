"use client";

import { Link } from "@/i18n/navigation";

export type ClanHubTab =
  | "overview"
  | "members"
  | "chat"
  | "admin";

export function ClanHubTabs({
  clanId,
  active,
  labels,
  showAdmin,
}: {
  clanId: string;
  active: ClanHubTab;
  showAdmin: boolean;
  labels: Record<ClanHubTab, string>;
}) {
  const tabs: ClanHubTab[] = showAdmin
    ? ["overview", "members", "chat", "admin"]
    : ["overview", "members", "chat"];

  return (
    <nav
      className="mb-4 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      aria-label="Clan sections"
    >
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <Link
            key={tab}
            href={`/clans/${clanId}?tab=${tab}`}
            aria-current={isActive ? "page" : undefined}
            className={`min-h-11 shrink-0 inline-flex items-center px-3 rounded-lg border text-label-sm transition-colors ${
              isActive
                ? "border-pokeball-red/50 bg-pokeball-red/15 text-on-surface"
                : "border-transparent text-on-surface-variant hover:border-white/15"
            }`}
          >
            {labels[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
