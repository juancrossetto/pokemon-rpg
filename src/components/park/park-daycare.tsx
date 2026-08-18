"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useEffect, useState, type CSSProperties } from "react";
import { PokemonImage } from "@/components/pokemon-image";
import { itemHdIconUrl } from "@/lib/item-hd-icons";
import { DAYCARE_DEPOSIT_COST, DAYCARE_SLOTS } from "@/lib/park/daycare";
import type { ParkDaycareSlot, ParkMonOption } from "@/lib/park/view";

const BREEDER_ART = "/park/daycare/breeder.png";
const COIN_ART = itemHdIconUrl("Gold Coin") ?? "/items/hd/gold-coin.png";
const AMBIENT_SPARKS = 6;
const NEST_MON_PX = 96;

export type DaycareLabels = {
  occupancy: (held: number, total: number) => string;
  hint: string;
  empty: string;
  emptyBox: string;
  pickHint: string;
  nest: (n: number) => string;
  emptySlot: string;
  deposit: string;
  collect: string;
  withdraw: string;
  pending: (n: number) => string;
  next: (time: string) => string;
  maxed: string;
  ceiling: (level: number) => string;
  growing: string;
  idle: string;
  ready: string;
  level: (n: number) => string;
  timeLeftHm: (h: number, m: number) => string;
  timeLeftM: (m: number) => string;
};

function CoinChip({ amount }: { amount: number }) {
  return (
    <span className="daycare__coin">
      <Image src={COIN_ART} alt="" width={18} height={18} unoptimized />
      <span>{amount.toLocaleString()}</span>
    </span>
  );
}

export function ParkDaycare({
  slots,
  box,
  selected,
  busy,
  coins,
  labels,
  onSelect,
  onDeposit,
  onCollect,
  onWithdraw,
}: {
  slots: ParkDaycareSlot[];
  box: ParkMonOption[];
  selected: ParkMonOption | null;
  busy: boolean;
  coins: number;
  labels: DaycareLabels;
  onSelect: (id: string) => void;
  onDeposit: (instanceId: string, slot: number) => void;
  onCollect: (depositId: string) => void;
  onWithdraw: (depositId: string) => void;
}) {
  const held = slots.filter((slot) => slot.depositId).length;
  const anyReady = slots.some((slot) => slot.pendingLevels > 0);
  const anyGrowing = slots.some(
    (slot) => slot.depositId && slot.pendingLevels === 0 && !slot.maxed && !slot.atCeiling,
  );
  const anyActive = held > 0;

  return (
    <section className="daycare">
      <div
        className={`daycare__stage${anyReady ? " is-ready" : anyGrowing ? " is-growing" : ""}${anyActive ? " is-active" : ""}`}
      >
        {anyActive ? (
          <div className="daycare__ambience" aria-hidden>
            {Array.from({ length: AMBIENT_SPARKS }, (_, i) => (
              <span
                key={i}
                className="daycare__sparkle"
                style={
                  {
                    "--i": i,
                    "--x": `${10 + ((i * 19) % 78)}%`,
                    "--y": `${18 + ((i * 27) % 62)}%`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}
        <header className="daycare__hud">
          <b>{labels.occupancy(held, DAYCARE_SLOTS)}</b>
          <span className="daycare__nudge">{labels.hint}</span>
        </header>

        <div className="daycare__scene">
          <div className="daycare__crew">
            <p className="daycare__bubble" aria-live="polite">
              {anyReady ? labels.ready : labels.idle}
            </p>
            <Image
              src={BREEDER_ART}
              alt=""
              width={250}
              height={180}
              className="daycare__breeder"
              fadeIn
            />
          </div>

          <div className="daycare__nests">
            {slots.map((slot) => (
              <DaycareNest
                key={slot.slot}
                slot={slot}
                selected={selected}
                busy={busy}
                coins={coins}
                labels={labels}
                onDeposit={onDeposit}
                onCollect={onCollect}
                onWithdraw={onWithdraw}
              />
            ))}
          </div>
        </div>

        {held < DAYCARE_SLOTS ? (
          <DaycarePicker
            box={box}
            value={selected?.id ?? ""}
            pickHint={labels.pickHint}
            empty={labels.emptyBox}
            level={labels.level}
            disabled={busy}
            onChange={onSelect}
          />
        ) : null}
      </div>
    </section>
  );
}

function DaycareNest({
  slot,
  selected,
  busy,
  coins,
  labels,
  onDeposit,
  onCollect,
  onWithdraw,
}: {
  slot: ParkDaycareSlot;
  selected: ParkMonOption | null;
  busy: boolean;
  coins: number;
  labels: DaycareLabels;
  onDeposit: (instanceId: string, slot: number) => void;
  onCollect: (depositId: string) => void;
  onWithdraw: (depositId: string) => void;
}) {
  const occupied = Boolean(slot.depositId && slot.name);
  const ready = slot.pendingLevels > 0;
  const progress = ready ? 1 : slot.progress;

  return (
    <article
      className={`daycare__nest${occupied ? " is-in" : " is-empty"}${ready ? " is-ready" : ""}${slot.maxed && !ready ? " is-maxed" : ""}`}
    >
      <header className="daycare__nest-head">
        <span>{labels.nest(slot.slot)}</span>
        {occupied ? <em>{labels.level(slot.level ?? 1)}</em> : null}
      </header>

      <div className={`daycare__frame${occupied ? " is-filled" : ""}${ready ? " is-ready" : occupied && !slot.maxed && !slot.atCeiling ? " is-growing" : ""}`}>
        {occupied ? (
          <>
            <div className="daycare__mon-wrap">
              <PokemonImage
                src={slot.spriteUrl}
                speciesName={slot.speciesName}
                alt={slot.name ?? ""}
                width={NEST_MON_PX}
                height={NEST_MON_PX}
                sizes={`${NEST_MON_PX}px`}
                className="daycare__mon"
              />
            </div>
            <div className="daycare__bar" aria-hidden>
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </>
        ) : (
          <span className="daycare__vacant-mark" aria-hidden>
            —
          </span>
        )}
      </div>

      {occupied ? <b className="daycare__name">{slot.name}</b> : <p className="daycare__vacant">{labels.emptySlot}</p>}

      {occupied ? (
        <p className="daycare__status">
          {slot.atCeiling ? (
            labels.ceiling(slot.ceiling)
          ) : slot.maxed && !ready ? (
            labels.maxed
          ) : ready ? (
            <span className="daycare__status-row">
              <span>{labels.pending(slot.pendingLevels)}</span>
              <CoinChip amount={slot.fee} />
            </span>
          ) : (
            <DaycareWait ms={slot.msUntilNext} labels={labels} />
          )}
        </p>
      ) : null}

      <div className="daycare__acts">
        {occupied ? (
          <>
            {ready && slot.depositId ? (
              <button
                type="button"
                className="daycare__btn is-primary"
                disabled={busy || coins < slot.fee}
                onClick={() => onCollect(slot.depositId!)}
              >
                <span>{labels.collect}</span>
                <CoinChip amount={slot.fee} />
              </button>
            ) : null}
            {slot.depositId ? (
              <button
                type="button"
                className="daycare__btn is-muted"
                disabled={busy}
                onClick={() => onWithdraw(slot.depositId!)}
              >
                {labels.withdraw}
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            className="daycare__btn is-primary"
            disabled={busy || !selected || coins < DAYCARE_DEPOSIT_COST}
            onClick={() => {
              if (!selected) return;
              onDeposit(selected.id, slot.slot);
            }}
          >
            <span>{labels.deposit}</span>
            <CoinChip amount={DAYCARE_DEPOSIT_COST} />
          </button>
        )}
      </div>
    </article>
  );
}

function DaycareWait({ ms, labels }: { ms: number; labels: DaycareLabels }) {
  const [left, setLeft] = useState(ms);
  const [synced, setSynced] = useState(ms);
  if (synced !== ms) {
    setSynced(ms);
    setLeft(ms);
  }

  useEffect(() => {
    const started = Date.now();
    const origin = ms;
    const tick = () => setLeft(Math.max(0, origin - (Date.now() - started)));
    const raf = window.requestAnimationFrame(tick);
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [ms]);

  const minutes = Math.max(1, Math.ceil(left / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const time = h > 0 ? labels.timeLeftHm(h, m) : labels.timeLeftM(m);
  return <>{labels.next(time)}</>;
}

function DaycarePicker({
  box,
  value,
  pickHint,
  empty,
  level,
  disabled,
  onChange,
}: {
  box: ParkMonOption[];
  value: string;
  pickHint: string;
  empty: string;
  level: (n: number) => string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  if (box.length === 0) return <p className="daycare__empty">{empty}</p>;
  return (
    <div className="daycare__picker">
      <p>{pickHint}</p>
      <div>
        {box.map((mon) => (
          <button
            key={mon.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(mon.id)}
            className={mon.id === value ? "is-on" : undefined}
          >
            <PokemonImage
              src={mon.spriteUrl}
              speciesName={mon.speciesName}
              alt={mon.name}
              width={48}
              height={48}
              loading="lazy"
            />
            <span>{mon.name}</span>
            <em>{level(mon.level)}</em>
          </button>
        ))}
      </div>
    </div>
  );
}
