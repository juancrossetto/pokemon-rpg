"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { SpeciesFragmentArt } from "@/components/species-fragment-art";
import { ParkDailyResetClock } from "@/components/park/park-daily-reset-clock";
import { useEffect, useRef, useState } from "react";
import { itemHdIconUrl } from "@/lib/item-hd-icons";
import {
  FOSSIL_KINDS,
  FOSSIL_RARITY,
  FOSSIL_SPECIES,
  MINE_DIGS_PER_DAY,
  MINE_DROP_SHOW,
  type MineBag,
  type MineCell,
  type MineDropKind,
  type MineLoot,
} from "@/lib/park/mine";

/**
 * Cara visible de cada botín que no es fósil.
 *
 * Los fósiles son fragmentos de especie (Omanyte / Kabuto / Aerodactyl) y
 * se dibujan como cristal, no como el Pokémon entero. El resto usa el icono
 * HD del objeto que realmente entrega `digMineCell`.
 */
const ITEM_LOOT_ART: Record<"coins" | "potion" | "stone", string> = {
  coins: itemHdIconUrl("Gold Coin") ?? "/items/hd/gold-coin.png",
  potion: itemHdIconUrl("Potion") ?? "/items/hd/potion.png",
  stone: itemHdIconUrl("Water Stone") ?? "/items/hd/water-stone.png",
};

function isFossilLoot(loot: MineLoot): loot is "helix" | "dome" | "amber" {
  return loot === "helix" || loot === "dome" || loot === "amber";
}

function LootFace({
  loot,
  size,
  className,
  alt = "",
}: {
  loot: Exclude<MineLoot, "empty">;
  size: number;
  className?: string;
  alt?: string;
}) {
  if (isFossilLoot(loot)) {
    return (
      <SpeciesFragmentArt
        speciesId={FOSSIL_SPECIES[loot]}
        speciesName=""
        size={size}
        rarity={FOSSIL_RARITY[loot]}
        className={className}
        alt={alt}
      />
    );
  }
  return (
    <Image src={ITEM_LOOT_ART[loot]} alt={alt} width={size} height={size} className={className} />
  );
}

/*
  Celda sin nada: una roca, no el pico.

  El pico es la herramienta (animación de picar). Lo que queda en el
  hueco excavado es escombro — si el mismo PNG de pala apareciera 42% de las
  veces, el muro se leería como si el premio fuera picar.
*/
const PICK_ART = "/park/mine/empty.png";
const EMPTY_ART = "/park/mine/rock.png";

/** El minero que atiende la mina. Sólo decorativo. */
const MINER_ART = "/park/mine/miner.png";

/** Cuánto dura el picado antes de que se vea el botín. */
const DIG_MS = 520;

export type DigResult = { ok: true; loot: MineLoot } | { ok: false; error: string };

export type MineLabels = {
  digsLeft: (left: number, total: number) => string;
  /** Cupo diario y qué puede salir, para lectores de pantalla. */
  dailyHint: string;
  resetIn: (time: string) => string;
  drops: string;
  dropName: (loot: MineDropKind) => string;
  empty: string;
  lootName: (loot: MineLoot) => string;
  idle: string;
  bagTitle: string;
  revive: string;
  progress: (have: number, need: number) => string;
  fossil: (kind: keyof MineBag) => string;
  noFossils: string;
};

export function ParkMine({
  grid,
  bag,
  digsLeft,
  resetMs,
  resetAt,
  coinDrop,
  fragmentsNeed,
  labels,
  busy,
  onDig,
  onRevive,
  onResetExpired,
}: {
  grid: MineCell[];
  bag: MineBag;
  digsLeft: number;
  resetMs: number;
  resetAt: string;
  coinDrop: number;
  fragmentsNeed: number;
  labels: MineLabels;
  busy: boolean;
  onDig: (index: number) => Promise<DigResult>;
  onRevive: (kind: keyof MineBag) => void;
  onResetExpired: () => void;
}) {
  /*
    Índice que se está picando ahora.

    El servidor resuelve el botín, pero si esperáramos su respuesta para animar,
    el pico se sentiría con retardo. Se pica al instante en el cliente y el
    resultado aparece cuando llega — la celda ya viene marcada como excavada
    desde el servidor, así que no hay estado que reconciliar.
  */
  const [digging, setDigging] = useState<number | null>(null);
  const [found, setFound] = useState<MineLoot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const spent = MINE_DIGS_PER_DAY - digsLeft;

  return (
    <section className="mine">
      <div className="mine__stage">
      {/* Picos restantes en vez de un número suelto: se lee de un vistazo
          cuánto queda, como la munición de un juego. */}
      <header className="mine__hud">
        <span className="mine__picks" aria-label={labels.digsLeft(digsLeft, MINE_DIGS_PER_DAY)}>
          {Array.from({ length: MINE_DIGS_PER_DAY }, (_, i) => (
            <i key={i} className={i < spent ? "is-spent" : undefined} aria-hidden>
              <span className="material-symbols-outlined">hardware</span>
            </i>
          ))}
        </span>
        <b>{labels.digsLeft(digsLeft, MINE_DIGS_PER_DAY)}</b>
        {digsLeft > 0 ? (
          <span className="mine__nudge">{labels.idle}</span>
        ) : null}
        <ParkDailyResetClock
          resetAt={resetAt}
          resetMs={resetMs}
          visible={digsLeft <= 0}
          label={labels.resetIn}
          onExpired={onResetExpired}
        />
      </header>
      <ul className="mine__drops" aria-label={labels.dailyHint}>
        <li className="mine__drops-label">{labels.drops}</li>
        {MINE_DROP_SHOW.map((loot) => (
          <li key={loot} title={labels.dropName(loot)}>
            <LootFace loot={loot} size={32} />
            <span>{labels.dropName(loot)}</span>
          </li>
        ))}
      </ul>

      <div className="mine__board">
        <div className="mine__pit">
        <div className="mine__wall">
        {grid.map((cell, index) => {
          const isDigging = digging === index;
          const state = cell.dug ? (cell.loot === "empty" ? "empty" : "loot") : "rock";
          return (
            <button
              key={index}
              type="button"
              className={`mine-cell is-${state}${isDigging ? " is-digging" : ""}`}
              disabled={busy || cell.dug || digsLeft <= 0}
              onClick={() => {
                setDigging(index);
                setFound(null);
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => setDigging(null), DIG_MS);
                void onDig(index).then((result) => {
                  if (result.ok) setFound(result.loot);
                });
              }}
            >
              {/* Vetas de la roca. Cada celda arranca su patrón en un punto
                  distinto para que el muro no se lea como un mosaico repetido. */}
              <span className="mine-cell__rock" style={{ backgroundPosition: `${(index % 5) * 37}% ${Math.floor(index / 5) * 41}%` }} aria-hidden />
              <span className="mine-cell__cracks" aria-hidden />

              {cell.dug ? (
                cell.loot === "empty" ? (
                  <Image src={EMPTY_ART} alt="" width={72} height={72} className="mine-cell__empty" />
                ) : (
                  <LootFace loot={cell.loot} size={72} className="mine-cell__loot" />
                )
              ) : null}

              {/* Pico que entra, golpea y sale. Es lo que hace que el clic se
                  lea como picar y no como destapar una casilla. */}
              {isDigging ? (
                <Image
                  src={PICK_ART}
                  alt=""
                  width={72}
                  height={72}
                  className="mine-cell__pick"
                />
              ) : null}

              {/* Polvo del picotazo: seis motas que salen y se apagan. */}
              {isDigging ? (
                <span className="mine-cell__dust" aria-hidden>
                  {Array.from({ length: 6 }, (_, i) => (
                    <i key={i} style={{ "--dust": i } as React.CSSProperties} />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
        </div>
        </div>

        {/*
          El minero es un adorno del escenario, no un compañero de layout.
          Los PNG de modo van en las pestañas; acá sólo asoma en la esquina.
        */}
        <aside className="mine__crew">
          {found ? (
            <p
              key={found}
              className={`mine__bubble${found === "empty" ? " is-empty" : ""}`}
              aria-live="polite"
            >
              {found === "empty" ? (
                <Image src={EMPTY_ART} alt="" width={40} height={40} className="mine__bubble-empty" />
              ) : (
                <LootFace loot={found} size={48} />
              )}
              <b>
                {found === "empty"
                  ? labels.empty
                  : found === "coins"
                    ? `+${coinDrop}`
                    : labels.lootName(found)}
              </b>
            </p>
          ) : null}
          <Image src={MINER_ART} alt="" width={250} height={359} className="mine__miner" priority />
        </aside>
      </div>

      <footer className="mine__bag">
        <p className="mine__bag-head">{labels.bagTitle}</p>
        <ul>
          {FOSSIL_KINDS.map((kind) => {
            const have = bag[kind];
            const ready = have >= fragmentsNeed;
            return (
              <li key={kind}>
                <LootFace loot={kind} size={42} alt={labels.fossil(kind)} />
                <span>
                  <b>{labels.fossil(kind)}</b>
                  <em>{labels.progress(have, fragmentsNeed)}</em>
                </span>
                <button type="button" disabled={busy || !ready} onClick={() => onRevive(kind)}>
                  {labels.revive}
                </button>
              </li>
            );
          })}
        </ul>
      </footer>
      </div>
    </section>
  );
}

