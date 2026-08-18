"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useEffect, useRef, useState } from "react";
import { PokemonImage } from "@/components/pokemon-image";
import { ParkDailyResetClock } from "@/components/park/park-daily-reset-clock";
import type { ParkMonOption } from "@/lib/park/view";
import { WONDER_FREE_TRADES_PER_DAY, type WonderReceipt } from "@/lib/park/wonder";

const SCIENTIST_ART = "/park/wonder/scientist.png";

/** El reactor gira mientras el servidor resuelve; la espera es puesta en escena. */
const SWAP_MS = 1600;
const PORTAL_SPARKS = 7;
const LAB_MOTES = 6;
const REACTOR_ORBITS = 8;

export type WonderTradeResult =
  | { ok: true; queued: true; energySpent: number; freeLeft: number }
  | { ok: true; queued: false; received: WonderReceipt; energySpent: number; freeLeft: number }
  | { ok: false; error: string };

export type WonderLabels = {
  pickHint: string;
  empty: string;
  offer: string;
  incoming: string;
  waiting: string;
  emptyPad: string;
  send: string;
  traveler: string;
  cancel: string;
  pending: (name: string) => string;
  level: (n: number) => string;
  idle: string;
  swapping: string;
  queued: (name: string) => string;
  got: (name: string) => string;
  tradesLeft: (left: number, total: number) => string;
  dailyHint: string;
  resetIn: (time: string) => string;
  idleNudge: string;
  freeRemaining: (n: number) => string;
  received: (name: string) => string;
  lockedTitle: string;
  lockedBody: string;
};

/**
 * Trueque: el laboratorio del científico y el portal.
 *
 * Antes era un párrafo y dos botones. Acá hay escena: elegís el Pokémon, entra
 * al portal y del otro lado sale lo que volvió. El científico comenta; el
 * resultado lo decide el servidor durante la espera, igual que pesca y casino.
 */
export function ParkWonder({
  box,
  selected,
  pendingOffer,
  busy,
  unlocked,
  freeLeft,
  energy,
  energyCost,
  energyIcon,
  resetAt,
  resetMs,
  labels,
  onSelect,
  onTrade,
  onTraveler,
  onCancel,
  onQuota,
  onResetExpired,
}: {
  box: ParkMonOption[];
  selected: ParkMonOption | null;
  pendingOffer: ParkMonOption | null;
  busy: boolean;
  unlocked: boolean;
  freeLeft: number;
  energy: number;
  energyCost: number;
  energyIcon: string;
  resetAt: string;
  resetMs: number;
  labels: WonderLabels;
  onSelect: (id: string) => void;
  onTrade: (instanceId: string) => Promise<WonderTradeResult>;
  onTraveler: (instanceId: string) => Promise<WonderTradeResult>;
  onCancel: () => Promise<{ ok: true } | { ok: false; error: string }>;
  onQuota: (next: { freeLeft: number; energySpent: number }) => void;
  onResetExpired: () => void;
}) {
  const [swapping, setSwapping] = useState(false);
  const [receipt, setReceipt] = useState<WonderReceipt | null>(null);
  const [offered, setOffered] = useState<ParkMonOption | null>(null);
  const [heldQueue, setHeldQueue] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const queuedMon = pendingOffer ?? offered;
  const waiting = (Boolean(pendingOffer) || heldQueue) && !swapping;
  const spent = WONDER_FREE_TRADES_PER_DAY - freeLeft;
  const blocked = freeLeft <= 0 && energy < energyCost;

  async function run(kind: "queue" | "npc") {
    if (busy || swapping || waiting || !selected || blocked || !unlocked) return;
    setSwapping(true);
    setReceipt(null);
    setHeldQueue(false);
    setOffered(selected);

    try {
      const [outcome] = await Promise.all([
        kind === "queue" ? onTrade(selected.id) : onTraveler(selected.id),
        new Promise((resolve) => {
          timer.current = setTimeout(resolve, SWAP_MS);
        }),
      ]);

      if (!outcome.ok) {
        setOffered(null);
        return;
      }
      onQuota({ freeLeft: outcome.freeLeft, energySpent: outcome.energySpent });
      if (outcome.queued) {
        setHeldQueue(true);
        return;
      }
      setReceipt(outcome.received);
    } catch {
      setOffered(null);
    } finally {
      setSwapping(false);
    }
  }

  const bubble = !unlocked
    ? labels.lockedTitle
    : swapping
      ? labels.swapping
      : waiting && queuedMon
        ? labels.queued(queuedMon.name)
        : receipt
          ? labels.got(receipt.name)
          : labels.idle;

  const offerFace = waiting
    ? queuedMon
    : swapping || receipt
      ? offered
      : selected;
  const showIncoming = Boolean(receipt) && !swapping && !waiting;

  return (
    <section
      className={`wonder${swapping ? " is-swapping" : ""}${waiting ? " is-waiting" : ""}${showIncoming ? " is-done" : ""}`}
    >
      <div className="wonder__stage">
        {Array.from({ length: LAB_MOTES }, (_, i) => (
          <i key={i} className="wonder__mote" style={{ "--mote": i } as React.CSSProperties} />
        ))}

        <header className="wonder__hud">
          <span className="wonder__quota" aria-label={labels.tradesLeft(freeLeft, WONDER_FREE_TRADES_PER_DAY)}>
            <span className="wonder__ticks" aria-hidden>
              {Array.from({ length: WONDER_FREE_TRADES_PER_DAY }, (_, i) => (
                <i key={i} className={i < spent ? "is-spent" : undefined}>
                  <span className="material-symbols-outlined">swap_horiz</span>
                </i>
              ))}
            </span>
            <b>{labels.tradesLeft(freeLeft, WONDER_FREE_TRADES_PER_DAY)}</b>
          </span>
          {freeLeft > 0 ? <span className="wonder__nudge">{labels.idleNudge}</span> : null}
          <ParkDailyResetClock
            resetAt={resetAt}
            resetMs={resetMs}
            visible
            label={labels.resetIn}
            onExpired={onResetExpired}
          />
        </header>
        <p className="wonder__hint">{labels.dailyHint}</p>

        <div className="wonder__floor">
          <div className="wonder__bench">
            <div className="wonder__pods">
              <WonderPad
                title={waiting ? labels.waiting : labels.offer}
                empty={labels.emptyPad}
                level={labels.level}
                face={
                  offerFace
                    ? {
                        name: offerFace.name,
                        speciesName: offerFace.speciesName,
                        spriteUrl: offerFace.spriteUrl,
                        level: offerFace.level,
                        leaving: swapping,
                      }
                    : null
                }
              />

              <div className="wonder__link" aria-hidden>
                <span className="wonder__beam" />
                <div className="wonder__portal">
                  <span className="wonder__halo" />
                  <span className="wonder__ring" />
                  <span className="wonder__core" />
                  {Array.from({ length: PORTAL_SPARKS }, (_, i) => (
                    <i key={i} style={{ "--spark": i } as React.CSSProperties} />
                  ))}
                  <span className="material-symbols-outlined">sync_alt</span>
                </div>
              </div>

              <WonderPad
                title={labels.incoming}
                empty={labels.emptyPad}
                level={labels.level}
                mystery={swapping}
                incoming={showIncoming}
                face={
                  showIncoming && receipt
                    ? {
                        name: receipt.name,
                        speciesName: receipt.speciesName,
                        speciesId: receipt.speciesId,
                        level: receipt.level,
                        isShiny: receipt.isShiny,
                        arriving: true,
                      }
                    : null
                }
              />
            </div>
          </div>

          <aside className="wonder__crew">
            <p key={bubble} className="wonder__bubble" aria-live="polite">
              {bubble}
            </p>
            <div className="wonder__figure">
              <span className="wonder__glint" aria-hidden />
              <Image
                src={SCIENTIST_ART}
                alt=""
                width={250}
                height={390}
                className="wonder__scientist"
                fadeIn
              />
            </div>
          </aside>
        </div>

        {showIncoming && receipt ? (
          <WonderCatch receipt={receipt} level={labels.level} copy={labels.received(receipt.name)} kicker={labels.incoming} />
        ) : null}

        {!unlocked ? (
          <div className="wonder__lock">
            <span className="material-symbols-outlined" aria-hidden>
              lock
            </span>
            <b>{labels.lockedTitle}</b>
            <p>{labels.lockedBody}</p>
          </div>
        ) : waiting && queuedMon ? (
          <div className="wonder__controls">
            <p className="wonder__pending">{labels.pending(queuedMon.name)}</p>
            <button
              type="button"
              className="wonder__act is-ghost"
              disabled={busy}
              onClick={() => {
                void onCancel().then((r) => {
                  if (!r.ok) return;
                  setHeldQueue(false);
                  setOffered(null);
                });
              }}
            >
              <span className="material-symbols-outlined" aria-hidden>
                close
              </span>
              {labels.cancel}
            </button>
          </div>
        ) : (
          <>
            <WonderPicker
              box={box}
              value={selected?.id ?? ""}
              pickHint={labels.pickHint}
              empty={labels.empty}
              level={labels.level}
              disabled={busy || swapping}
              onChange={(id) => {
                setReceipt(null);
                setOffered(null);
                onSelect(id);
              }}
            />
            <div className="wonder__controls">
              <WonderAct
                kind="queue"
                swapping={swapping}
                disabled={busy || swapping || !selected || blocked}
                freeLeft={freeLeft}
                energyCost={energyCost}
                energyIcon={energyIcon}
                labels={labels}
                onClick={() => void run("queue")}
              />
              <WonderAct
                kind="lab"
                swapping={swapping}
                disabled={busy || swapping || !selected || blocked}
                freeLeft={freeLeft}
                energyCost={energyCost}
                energyIcon={energyIcon}
                labels={labels}
                onClick={() => void run("npc")}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function WonderAct({
  kind,
  swapping,
  disabled,
  freeLeft,
  energyCost,
  energyIcon,
  labels,
  onClick,
}: {
  kind: "queue" | "lab";
  swapping: boolean;
  disabled: boolean;
  freeLeft: number;
  energyCost: number;
  energyIcon: string;
  labels: WonderLabels;
  onClick: () => void;
}) {
  const free = freeLeft > 0 || swapping;
  return (
    <button
      type="button"
      className={`wonder__act${kind === "lab" ? " is-lab" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      {free ? (
        <span className="material-symbols-outlined" aria-hidden>
          {swapping ? "sync" : kind === "lab" ? "science" : "swap_horiz"}
        </span>
      ) : (
        <Image src={energyIcon} alt="" width={22} height={22} className="wonder__act-energy" />
      )}
      <span className="wonder__act-label">{kind === "lab" ? labels.traveler : labels.send}</span>
      <span className="wonder__act-meta">{free ? labels.freeRemaining(freeLeft) : `−${energyCost}`}</span>
    </button>
  );
}

function WonderCatch({
  receipt,
  level,
  copy,
  kicker,
}: {
  receipt: WonderReceipt;
  level: (n: number) => string;
  copy: string;
  kicker: string;
}) {
  return (
    <div className={`wonder__catch${receipt.isShiny ? " is-shiny" : ""}`} aria-live="polite">
      <PokemonImage
        speciesId={receipt.speciesId}
        speciesName={receipt.speciesName}
        isShiny={receipt.isShiny}
        alt={receipt.name}
        width={168}
        height={168}
      />
      <div className="wonder__catch-card">
        <small>{kicker}</small>
        <b>{receipt.name}</b>
        <span className="wonder__catch-tags">
          <i>{level(receipt.level)}</i>
          {receipt.isShiny ? (
            <i className="is-shiny">
              <span className="material-symbols-outlined" aria-hidden>
                auto_awesome
              </span>
            </i>
          ) : null}
        </span>
        <p>{copy}</p>
      </div>
    </div>
  );
}

function WonderReactor() {
  return (
    <span className="wonder__reactor" aria-hidden>
      <i className="wonder__reactor-halo" />
      <i className="wonder__reactor-ring is-a" />
      <i className="wonder__reactor-ring is-b" />
      <i className="wonder__reactor-ring is-c" />
      <i className="wonder__reactor-core" />
      {Array.from({ length: REACTOR_ORBITS }, (_, i) => (
        <b key={i} style={{ "--orbit": i } as React.CSSProperties} />
      ))}
    </span>
  );
}

type PadFace = {
  name: string;
  speciesName: string;
  speciesId?: number;
  spriteUrl?: string;
  level: number;
  isShiny?: boolean;
  leaving?: boolean;
  arriving?: boolean;
};

function WonderPad({
  title,
  empty,
  level,
  face,
  mystery = false,
  incoming = false,
}: {
  title: string;
  empty: string;
  level: (n: number) => string;
  face: PadFace | null;
  mystery?: boolean;
  incoming?: boolean;
}) {
  return (
    <div
      className={`wonder__pad${face || mystery ? " has-mon" : ""}${mystery ? " is-mystery" : ""}${incoming ? " is-incoming" : ""}`}
    >
      <span className="wonder__pad-title">{title}</span>
      {mystery ? (
        <WonderReactor />
      ) : face ? (
        <span
          key={face.arriving ? `${face.speciesId}-${face.name}-${face.level}` : face.name}
          className={`wonder__mon${face.leaving ? " is-leaving" : ""}${face.arriving ? " is-arriving" : ""}`}
        >
          <PokemonImage
            src={face.spriteUrl}
            speciesId={face.speciesId}
            speciesName={face.speciesName}
            isShiny={face.isShiny}
            alt={face.name}
            width={96}
            height={96}
            className="wonder__mon-art"
          />
          <b>{face.name}</b>
          <em>{level(face.level)}</em>
        </span>
      ) : (
        <span className="wonder__vacant">{empty}</span>
      )}
    </div>
  );
}

function WonderPicker({
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
  if (box.length === 0) return <p className="wonder__empty">{empty}</p>;
  return (
    <div className="wonder__picker">
      <p>{pickHint}</p>
      <div>
        {box.map((mon) => {
          const active = mon.id === value;
          return (
            <button
              key={mon.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(mon.id)}
              className={active ? "is-on" : undefined}
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
          );
        })}
      </div>
    </div>
  );
}
