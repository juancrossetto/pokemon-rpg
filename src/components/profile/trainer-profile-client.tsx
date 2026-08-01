"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { TrainerIdentityHero } from "@/components/profile/trainer-identity-hero";
import {
  TrainerFacts,
  type ProfileHubLabels,
  type ProfileTabId,
} from "@/components/profile/trainer-profile-hub";
import type { StatRow } from "@/components/profile/trainer-stat-rows";

export function TrainerProfileClient({
  hero,
  hubLabels,
  facts,
  vault,
  team,
}: {
  /* Derivado del componente: repetir el shape a mano lo dejaba desincronizado
     cada vez que el banner sumaba un dato. */
  hero: ComponentProps<typeof TrainerIdentityHero>;
  hubLabels: ProfileHubLabels;
  facts: StatRow[];
  vault: ReactNode;
  team: ReactNode;
}) {
  const [tab, setTab] = useState<ProfileTabId>("summary");
  const tabs: ProfileTabId[] = ["summary", "badges", "team"];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 md:gap-5">
      <TrainerIdentityHero {...hero} />

      <div className="flex flex-col gap-4">
        {/*
          Control segmentado con indicador que se desliza, en vez de la píldora
          roja que saltaba de una pestaña a otra. El rojo es el color de acción
          de la app y acá pintaba de marca un simple selector de sección; el
          indicador neutro deja que el contenido tenga el color.

          Las pestañas ocupan una columna exacta de la grilla, así que al
          indicador le alcanza con un `translateX` de múltiplos de 100% — sin
          medir nodos ni efectos.
        */}
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-1 bg-background/90 px-1 py-1.5 backdrop-blur-xl xl:top-14">
          <div
            role="tablist"
            aria-label="Profile sections"
            className="relative grid grid-cols-3 rounded-xl border border-white/10 bg-[#10131a]/95 p-1"
          >
            <span
              aria-hidden
              className="profile-tab-indicator pointer-events-none absolute bottom-1 left-1 top-1 rounded-lg border border-white/12 bg-white/[0.09]"
              style={{
                width: "calc((100% - 0.5rem) / 3)",
                transform: `translateX(${tabs.indexOf(tab) * 100}%)`,
              }}
            />
            {tabs.map((id) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`relative z-[1] min-h-10 rounded-lg px-2 text-[12px] font-semibold tracking-tight transition-colors sm:text-[13px] ${
                    active ? "text-white" : "text-on-surface-variant hover:text-white/85"
                  }`}
                >
                  {hubLabels.tabs[id]}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "summary" && (
          <div role="tabpanel">
            <TrainerFacts sectionLabel={hubLabels.facts} rows={facts} />
          </div>
        )}
        {tab === "badges" && <div role="tabpanel">{vault}</div>}
        {tab === "team" && (
          <div className="flex flex-col gap-3" role="tabpanel">
            <div className="flex justify-end">
              <Link
                href="/team"
                className="rounded-lg border border-white/12 px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant transition hover:border-white/25 hover:text-white"
              >
                {hubLabels.manageTeam}
              </Link>
            </div>
            {team}
          </div>
        )}
      </div>
    </div>
  );
}
