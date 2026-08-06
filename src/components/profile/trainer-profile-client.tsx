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

      {/*
        Consola: el selector es la cabecera del panel, no una barra flotante
        arriba de él. Antes eran dos bloques sueltos separados por aire y la
        pantalla se leía como "banner + lista genérica"; pegados, el contenido
        cuelga de la pestaña que lo abre.

        También se fue el `sticky`: con el resumen en dos columnas la página
        entra casi entera en pantalla, y una barra que se despega al scrollear
        rompía justamente la unión que le da sentido.
      */}
      <section className="tp-console overflow-hidden rounded-2xl border border-white/10">
        <div
          role="tablist"
          aria-label="Profile sections"
          className="tp-console__tabs relative grid grid-cols-3"
        >
          <span
            aria-hidden
            className="profile-tab-indicator tp-console__pill pointer-events-none absolute inset-y-0"
            style={{
              width: "calc(100% / 3)",
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
                className={`relative z-[1] min-h-12 px-2 text-[12px] font-semibold tracking-tight transition-colors sm:text-[13px] ${
                  active ? "text-white" : "text-on-surface-variant hover:text-white/85"
                }`}
              >
                {hubLabels.tabs[id]}
              </button>
            );
          })}
        </div>

        {tab === "summary" && (
          <div role="tabpanel">
            <TrainerFacts rows={facts} />
          </div>
        )}
        {tab === "badges" && (
          <div role="tabpanel" className="p-3">
            {vault}
          </div>
        )}
        {tab === "team" && (
          <div role="tabpanel" className="flex flex-col gap-3 p-3">
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
      </section>
    </div>
  );
}
