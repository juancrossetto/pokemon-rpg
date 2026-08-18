"use client";

import { useEffect, useState } from "react";
import { CdnImage as Image } from "@/components/cdn-image";
import { itemDisplayUrl } from "@/lib/item-sprites";
import { FARM_GROW_MS } from "@/lib/park/farm";
import type { ParkPlot } from "@/lib/park/view";

export type FarmBerry = { itemId: string; name: string; quantity: number };

const GARDENER_ART = "/park/gardener.png";

export type FarmLabels = {
  /** Voz del jardinero: qué está pasando en el huerto. */
  idle: string;
  planted: string;
  readyBubble: string;
  harvested: (n: number) => string;
  plot: (n: number) => string;
  ready: string;
  growing: string;
  harvest: string;
  plant: string;
  pickBerry: string;
  noBerries: string;
  timeLeftHm: (h: number, m: number) => string;
  timeLeftM: (m: number) => string;
  hint: string;
  seeds: string;
  occupancy: (planted: number, total: number) => string;
};

/**
 * Etapa de crecimiento por progreso.
 *
 * Tres etapas y no una barra: la parcela tiene que decir de un vistazo cuánto
 * falta sin leer un número. El brote crece, la mata se llena, y recién al final
 * aparece la baya.
 */
function growthStage(progress: number): 1 | 2 | 3 {
  if (progress < 0.4) return 1;
  if (progress < 0.85) return 2;
  return 3;
}

export function ParkFarm({
  plots,
  berries,
  labels,
  busy,
  bubble,
  onPlant,
  onHarvest,
}: {
  /** Lo que dice el jardinero ahora. Lo decide el hub, que ve los resultados. */
  bubble?: string | null;
  plots: ParkPlot[];
  berries: FarmBerry[];
  labels: FarmLabels;
  busy: boolean;
  onPlant: (slot: number, itemId: string) => void;
  onHarvest: (slot: number) => void;
}) {
  const [picking, setPicking] = useState<number | null>(null);
  const available = berries.filter((berry) => berry.quantity > 0);

  /*
    El jardinero comenta el estado del huerto cuando nadie le dice nada: si hay
    una parcela lista avisa, y si no invita a plantar. Así el globito nunca
    queda vacío, que es lo que lo volvería un cartel de error intermitente.
  */
  const anyReady = plots.some((plot) => plot.ready);
  const says = bubble ?? (anyReady ? labels.readyBubble : labels.idle);
  const planted = plots.filter((plot) => plot.berryName != null).length;

  return (
    <section className="farm">
      <div className="farm__stage">
      <header className="farm__hud">
        <b>{labels.occupancy(planted, plots.length)}</b>
        <span className="farm__nudge">{labels.hint}</span>
      </header>
      <ul className="farm__seeds" aria-label={labels.seeds}>
        <li className="farm__seeds-label">{labels.seeds}</li>
        {berries.map((berry) => (
          <li key={berry.itemId} className={berry.quantity <= 0 ? "is-empty" : undefined}>
            <Image src={itemDisplayUrl(berry.name)} alt="" width={28} height={28} />
            <span>{berry.name}</span>
            <em>×{berry.quantity}</em>
          </li>
        ))}
      </ul>
      {available.length === 0 ? <p className="farm__empty">{labels.noBerries}</p> : null}

      <div className="farm__grid">
        {plots.map((plot) => (
          <FarmPlot
            key={plot.slot}
            plot={plot}
            labels={labels}
            busy={busy}
            picking={picking === plot.slot}
            canPlant={available.length > 0}
            onOpenPicker={() => setPicking(picking === plot.slot ? null : plot.slot)}
            onHarvest={() => onHarvest(plot.slot)}
          >
            {picking === plot.slot ? (
              /*
                El selector de bayas se abre en la parcela que tocaste, no en
                todas a la vez. Antes cada parcela listaba el inventario entero
                —cuatro parcelas × las bayas que tengas— y la pantalla era una
                pared de botones repetidos.
              */
              <div className="farm__picker" role="menu">
                <p>{labels.pickBerry}</p>
                {available.map((berry) => (
                  <button
                    key={berry.itemId}
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => {
                      setPicking(null);
                      onPlant(plot.slot, berry.itemId);
                    }}
                  >
                    <Image src={itemDisplayUrl(berry.name)} alt="" width={28} height={28} />
                    <span>{berry.name}</span>
                    <b>×{berry.quantity}</b>
                  </button>
                ))}
              </div>
            ) : null}
          </FarmPlot>
        ))}
      </div>

      {/* Jardinero en el borde del huerto, con su globito. Mismo patrón que el
          minero y el pescador. */}
      <aside className="farm__crew">
        <p key={says} className="farm__bubble" aria-live="polite">
          {says}
        </p>
        <Image
          src={GARDENER_ART}
          alt=""
          width={180}
          height={346}
          sizes="180px"
          unoptimized
          className="farm__gardener"
          priority
        />
      </aside>
      </div>
    </section>
  );
}

function FarmPlot({
  plot,
  labels,
  busy,
  picking,
  canPlant,
  onOpenPicker,
  onHarvest,
  children,
}: {
  plot: ParkPlot;
  labels: FarmLabels;
  busy: boolean;
  picking: boolean;
  canPlant: boolean;
  onOpenPicker: () => void;
  onHarvest: () => void;
  children: React.ReactNode;
}) {
  /*
    Cuenta regresiva viva.

    El valor inicial es el que mandó el servidor —renderizar `Date.now()` daría
    distinto en servidor y cliente y rompería la hidratación—, y a partir del
    montaje baja sola. Los ticks van dentro del callback del `setInterval`, no
    sueltos en el cuerpo del efecto, que sería error de lint en este repo
    (`react-hooks/set-state-in-effect`).

    El descuento se calcula contra `Date.now()` de cada tick y no restando 1000
    por vez: si la pestaña queda en segundo plano el navegador estira los
    intervalos, y acumulando restas la cuenta se atrasa varios minutos.
  */
  const [msLeft, setMsLeft] = useState(plot.msLeft);
  // Estado y no un ref para recordar el último valor del servidor: leer o
  // escribir un ref durante el render es error de lint acá (`react-hooks/refs`).
  // Es el mismo ajuste-durante-el-render que usa `battle-sprite.tsx`.
  const [lastServerMs, setLastServerMs] = useState(plot.msLeft);
  if (lastServerMs !== plot.msLeft) {
    setLastServerMs(plot.msLeft);
    setMsLeft(plot.msLeft);
  }

  useEffect(() => {
    if (plot.msLeft <= 0) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      setMsLeft(Math.max(0, plot.msLeft - (Date.now() - started)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [plot.msLeft]);

  const ready = plot.ready || (plot.berryName != null && msLeft <= 0);
  const progress = plot.berryName ? Math.min(1, 1 - msLeft / FARM_GROW_MS) : 0;
  const stage = growthStage(progress);

  const minutes = Math.ceil(msLeft / 60000);
  const timeLabel =
    minutes >= 60
      ? labels.timeLeftHm(Math.floor(minutes / 60), minutes % 60)
      : labels.timeLeftM(minutes);

  const state = !plot.berryName ? "empty" : ready ? "ready" : "growing";

  return (
    <article className={`farm-plot is-${state}`} data-stage={stage}>
      <header className="farm-plot__head">
        <span>{labels.plot(plot.slot)}</span>
        <b>{plot.berryName ? (ready ? labels.ready : timeLabel) : "\u00a0"}</b>
      </header>

      {/* Tierra: surcos, sombra de bordes y el hueco de siembra. */}
      <div className="farm-plot__soil">
        <span className="farm-plot__furrows" aria-hidden />

        {plot.berryName ? (
          <span className="farm-plot__crop">
            <span className="farm-plot__leaves" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            {stage === 3 ? (
              <Image
                src={itemDisplayUrl(plot.berryName)}
                alt=""
                width={56}
                height={56}
                className="farm-plot__berry"
              />
            ) : null}
          </span>
        ) : (
          <span className="farm-plot__hole" aria-hidden />
        )}

        {!ready && plot.berryName ? (
          <span className="farm-plot__progress" aria-hidden>
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        ) : null}
      </div>

      {plot.berryName ? (
        <button
          type="button"
          className="farm-plot__action"
          disabled={busy || !ready}
          onClick={onHarvest}
        >
          <span className="material-symbols-outlined" aria-hidden>
            {ready ? "agriculture" : "hourglass_top"}
          </span>
          {ready ? labels.harvest : labels.growing}
        </button>
      ) : (
        <button
          type="button"
          className="farm-plot__action"
          disabled={busy || !canPlant}
          aria-expanded={picking}
          onClick={onOpenPicker}
        >
          <span className="material-symbols-outlined" aria-hidden>potted_plant</span>
          {labels.plant}
        </button>
      )}

      {children}
    </article>
  );
}
