"use client";

import { useRef, useState, type CSSProperties } from "react";
import { CdnImage as Image } from "@/components/cdn-image";
import { ParkDailyResetClock } from "@/components/park/park-daily-reset-clock";
import { FRONTIER_ENERGY_COST } from "@/lib/energy";
import { itemHdIconUrl } from "@/lib/item-hd-icons";
import type { FrontierFacility } from "@/lib/park/frontier";
import type { ParkFrontierView } from "@/lib/park/view";

const FIGHT_MS = 1400;
const RIZZO_ART = "/park/frontier/rizzo.png";
const COIN_ART = itemHdIconUrl("Gold Coin") ?? "/items/hd/gold-coin.png";
const FACILITY_ART: Record<FrontierFacility, string> = {
  palace: "/park/frontier/palace.png",
  dome: "/park/frontier/dome.png",
};
const MARQUEE_LAMPS = 9;
const ARENA_SPARKS = 8;

export type FrontierPlayResult =
  | { ok: true; won: boolean; coins: number; streak: number; energySpent: number }
  | { ok: false; error: string };

export type FrontierLabels = {
  idle: string;
  fighting: string;
  winLead: string;
  winStreak: (n: number) => string;
  lose: string;
  challenge: string;
  streak: (n: number) => string;
  wins: (n: number) => string;
  winsShort: (n: number) => string;
  lastWon: string;
  lastLost: string;
  palaceTitle: string;
  palaceBlurb: string;
  domeTitle: string;
  domeBlurb: string;
  resetIn: (time: string) => string;
};

export function ParkFrontier({
  facilities,
  busy,
  energy,
  energyIcon,
  resetAt,
  resetMs,
  labels,
  onPlay,
  onResetExpired,
}: {
  facilities: ParkFrontierView[];
  busy: boolean;
  energy: number;
  energyIcon: string;
  resetAt: string;
  resetMs: number;
  labels: FrontierLabels;
  onPlay: (facility: FrontierFacility) => Promise<FrontierPlayResult>;
  onResetExpired: () => void;
}) {
  const [fighting, setFighting] = useState<FrontierFacility | null>(null);
  const [last, setLast] = useState<{ facility: FrontierFacility; won: boolean; coins: number; streak: number } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const blocked = energy < FRONTIER_ENERGY_COST;

  async function run(facility: FrontierFacility) {
    if (busy || fighting || blocked) return;
    setFighting(facility);
    setLast(null);
    try {
      const [outcome] = await Promise.all([
        onPlay(facility),
        new Promise((resolve) => {
          timer.current = setTimeout(resolve, FIGHT_MS);
        }),
      ]);
      if (!outcome.ok) return;
      setLast({ facility, won: outcome.won, coins: outcome.coins, streak: outcome.streak });
    } finally {
      setFighting(null);
    }
  }

  const totalWins = facilities.reduce((sum, row) => sum + row.wins, 0);
  const bestStreak = facilities.reduce((max, row) => Math.max(max, row.streak), 0);

  return (
    <section
      className={`frontier${fighting ? " is-fighting" : ""}${last?.won ? " is-win" : last && !last.won ? " is-lose" : ""}`}
      data-facility={fighting ?? last?.facility ?? undefined}
    >
      <div className="frontier__stage">
        <header className="frontier__hud">
          <span className="frontier__stats">
            <b>{labels.streak(bestStreak)}</b>
            <i>{labels.wins(totalWins)}</i>
          </span>
          <ParkDailyResetClock
            resetAt={resetAt}
            resetMs={resetMs}
            visible
            label={labels.resetIn}
            onExpired={onResetExpired}
          />
        </header>

        <div className="frontier__arena">
          {/* Marquesina de luces: vive arriba del contenido, no detrás de las cartas. */}
          <div className="frontier__marquee" aria-hidden>
            {Array.from({ length: MARQUEE_LAMPS }, (_, i) => (
              <span key={i} className="frontier__lamp" style={{ animationDelay: `${i * 0.13}s` }} />
            ))}
          </div>

          <div className="frontier__backdrop" aria-hidden>
            <span className="frontier__sweep" />
            <div className="frontier__ambience">
              {Array.from({ length: ARENA_SPARKS }, (_, i) => (
                <span
                  key={i}
                  className="frontier__spark"
                  style={
                    {
                      "--i": i,
                      "--x": `${6 + ((i * 13) % 88)}%`,
                      "--y": `${18 + ((i * 19) % 62)}%`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            {fighting ? <span className="frontier__clash" /> : null}
            {last?.won ? <span className="frontier__burst" /> : null}
          </div>

          <div className="frontier__body">
            <div className="frontier__grid">
              {facilities.map((row, index) => (
                <FrontierCard
                  key={row.facility}
                  row={row}
                  index={index}
                  fighting={fighting === row.facility}
                  justWon={last?.facility === row.facility && last.won}
                  justLost={last?.facility === row.facility && !last.won}
                  winCoins={last?.facility === row.facility && last.won ? last.coins : 0}
                  disabled={busy || Boolean(fighting) || blocked}
                  energyIcon={energyIcon}
                  labels={labels}
                  onPlay={() => void run(row.facility)}
                />
              ))}
            </div>

            {/* Crew abajo / al costado: nunca encima de las cartas. */}
            <aside className="frontier__crew">
              <p
                key={fighting ? "fight" : last ? `${last.facility}-${last.won}-${last.streak}` : "idle"}
                className="frontier__bubble"
                aria-live="polite"
              >
                {fighting ? (
                  labels.fighting
                ) : last?.won ? (
                  <>
                    <b>{labels.winLead}</b>
                    <span className="frontier__prize">
                      +{last.coins}
                      <Image src={COIN_ART} alt="" width={16} height={16} />
                    </span>
                    <i>{labels.winStreak(last.streak)}</i>
                  </>
                ) : last ? (
                  labels.lose
                ) : (
                  labels.idle
                )}
              </p>
              <Image
                src={RIZZO_ART}
                alt=""
                width={250}
                height={390}
                className="frontier__rizzo"
                priority
                fadeIn
              />
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

function FrontierCard({
  row,
  index,
  fighting,
  justWon,
  justLost,
  winCoins,
  disabled,
  energyIcon,
  labels,
  onPlay,
}: {
  row: ParkFrontierView;
  index: number;
  fighting: boolean;
  justWon: boolean;
  justLost: boolean;
  winCoins: number;
  disabled: boolean;
  energyIcon: string;
  labels: FrontierLabels;
  onPlay: () => void;
}) {
  const title = row.facility === "palace" ? labels.palaceTitle : labels.domeTitle;
  const blurb = row.facility === "palace" ? labels.palaceBlurb : labels.domeBlurb;

  return (
    <article
      className={`frontier__card${fighting ? " is-on" : ""}${row.lastWon ? " is-hot" : ""}${justWon ? " is-win-flash" : ""}${justLost ? " is-lose-flash" : ""}`}
      data-facility={row.facility}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="frontier__card-art" aria-hidden>
        <Image
          src={FACILITY_ART[row.facility]}
          alt=""
          width={120}
          height={120}
          className="frontier__facility"
          fadeIn
        />
        <span className="frontier__card-glow" />
      </div>

      <div className="frontier__card-copy">
        <h2>{title}</h2>
        <p>{blurb}</p>
        <ul>
          <li>{labels.streak(row.streak)}</li>
          <li className="frontier__wins-full">{labels.wins(row.wins)}</li>
          <li className="frontier__wins-short">{labels.winsShort(row.wins)}</li>
          {row.played ? (
            <li className="frontier__last">{row.lastWon ? labels.lastWon : labels.lastLost}</li>
          ) : null}
        </ul>
      </div>

      <button type="button" className="frontier__act" disabled={disabled} onClick={onPlay}>
        {fighting ? (
          <span className="material-symbols-outlined" aria-hidden>
            sync
          </span>
        ) : (
          <Image src={energyIcon} alt="" width={18} height={18} />
        )}
        <span>{labels.challenge}</span>
        <em>−{FRONTIER_ENERGY_COST}</em>
      </button>

      {justWon && winCoins > 0 ? (
        <span className="frontier__coin-pop" aria-hidden>
          +{winCoins}
          <Image src={COIN_ART} alt="" width={16} height={16} />
        </span>
      ) : null}
    </article>
  );
}
