"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PokemonImage } from "@/components/pokemon-image";
import { GameCtaButton } from "@/components/game-cta-button";
import {
  collectDaycare,
  depositDaycare,
  withdrawDaycare,
  castLine,
  submitWonderTrade,
  cancelWonderTrade,
  tradeWithTraveler,
  spinCornerAction,
  plantBerry,
  harvestPlot,
  digMineCell,
  reviveFossil,
  playFrontier,
} from "@/actions/park";
import type { ParkHubData, ParkMonOption } from "@/lib/park/view";
import { CORNER_SPIN_COST, type CornerSymbol } from "@/lib/park/corner";
import { DAYCARE_DEPOSIT_COST } from "@/lib/park/daycare";
import { FISHING_ENERGY_COST, FRONTIER_ENERGY_COST, MINE_DIG_ENERGY_COST } from "@/lib/energy";
import { MINE_COIN_DROP, MINE_REVIVE_COST, type MineBag } from "@/lib/park/mine";
import { itemDisplayUrl } from "@/lib/item-sprites";
import { itemHdIconUrl } from "@/lib/item-hd-icons";

const TABS = ["daycare", "fishing", "wonder", "corner", "farm", "mine", "frontier"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICON: Record<Tab, string> = {
  daycare: "cottage",
  fishing: "phishing",
  wonder: "swap_horiz",
  corner: "casino",
  farm: "spa",
  mine: "hardware",
  frontier: "stadium",
};

const REEL_ICON: Record<CornerSymbol, string> = {
  ball: "sports_baseball",
  berry: "nutrition",
  star: "star",
  seven: "filter_7",
};

const COIN_ICON = itemHdIconUrl("Gold Coin") ?? "/items/hd/gold-coin.png";
const ENERGY_ICON = itemHdIconUrl("Energy") ?? "/items/hd/energy.png";

export function ParkHub({ locale, data }: { locale: string; data: ParkHubData }) {
  const t = useTranslations("park");
  const [tab, setTab] = useState<Tab>("daycare");
  const [picked, setPicked] = useState<string>(data.box[0]?.id ?? "");
  const [log, setLog] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [lastReels, setLastReels] = useState<[CornerSymbol, CornerSymbol, CornerSymbol] | null>(null);

  const selected = useMemo(
    () => data.box.find((mon) => mon.id === picked) ?? data.box[0] ?? null,
    [data.box, picked],
  );

  function flash(message: string) {
    setLog(message);
  }

  const picker = (
    <MonPicker box={data.box} value={picked} onChange={setPicked} pickHint={t("pickHint")} empty={t("emptyBox")} />
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#12141c] px-4 py-5 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_12%_0%,rgba(196,92,255,0.18),transparent_55%),radial-gradient(60%_50%_at_100%_100%,rgba(56,189,248,0.1),transparent_50%)]"
        />
        <p className="relative text-[11px] font-black uppercase tracking-[0.18em] text-primary">{t("eyebrow")}</p>
        <h1 className="page-title relative mt-1 text-3xl text-white">{t("title")}</h1>
        <p className="relative mt-1 max-w-2xl text-sm text-white/60">{t("subtitle")}</p>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-xs text-white/80">
            <Image src={COIN_ICON} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
            {data.coins.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-xs text-white/80">
            <Image src={ENERGY_ICON} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
            {data.energy}/{data.energyMax}
          </span>
        </div>
      </header>

      <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
              tab === id
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]!" aria-hidden>
              {TAB_ICON[id]}
            </span>
            {t(`tabs.${id}`)}
          </button>
        ))}
      </nav>

      {log ? (
        <p className="rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-white/90">{log}</p>
      ) : null}

      {tab === "daycare" ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <p className="text-sm text-white/65 sm:col-span-2">{t("daycareBlurb")}</p>
          {data.daycare.map((slot) => (
            <article key={slot.slot} className="rounded-3xl border border-white/10 bg-[#12141c] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                {t("slot", { n: slot.slot })}
              </p>
              {slot.depositId && slot.spriteUrl ? (
                <>
                  <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/8 bg-black/25 p-3">
                    <PokemonImage src={slot.spriteUrl} speciesName={slot.speciesName} alt={slot.name ?? ""} width={72} height={72} className="h-[72px] w-[72px] object-contain" />
                    <div>
                      <p className="font-semibold text-white">{slot.name}</p>
                      <p className="text-xs text-white/50">Nv. {slot.level}</p>
                      <p className="mt-1 text-xs text-electric-yellow">
                        {t("pendingLevels", { n: slot.pendingLevels, fee: slot.fee })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <GameCtaButton
                      variant="red"
                      disabled={pending || slot.pendingLevels === 0}
                      className="min-h-10! text-[11px]!"
                      onClick={() =>
                        start(async () => {
                          const r = await collectDaycare(locale, slot.depositId!);
                          flash(r.ok ? t("collected") : t(`errors.${r.error}`));
                        })
                      }
                    >
                      {t("collect")}
                    </GameCtaButton>
                    <GameCtaButton
                      variant="secondary"
                      disabled={pending}
                      className="min-h-10! text-[11px]!"
                      onClick={() =>
                        start(async () => {
                          const r = await withdrawDaycare(locale, slot.depositId!);
                          flash(r.ok ? t("withdrawn") : t(`errors.${r.error}`));
                        })
                      }
                    >
                      {t("withdraw")}
                    </GameCtaButton>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-3 grid place-items-center rounded-2xl border border-dashed border-white/12 bg-black/20 px-3 py-6 text-center">
                    <span className="material-symbols-outlined text-[36px]! text-white/25" aria-hidden>
                      cottage
                    </span>
                    <p className="mt-2 text-sm text-white/55">{t("emptySlot")}</p>
                  </div>
                  {picker}
                  <GameCtaButton
                    variant="brand"
                    disabled={pending || !selected}
                    className="mt-3 min-h-10! text-[11px]!"
                    onClick={() =>
                      start(async () => {
                        if (!selected) return;
                        const r = await depositDaycare(locale, selected.id, slot.slot);
                        flash(r.ok ? t("deposited", { cost: DAYCARE_DEPOSIT_COST }) : t(`errors.${r.error}`));
                      })
                    }
                  >
                    {t("deposit", { cost: DAYCARE_DEPOSIT_COST })}
                  </GameCtaButton>
                </>
              )}
            </article>
          ))}
        </section>
      ) : null}

      {tab === "fishing" ? (
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#12141c]">
          <div className="relative bg-[radial-gradient(80%_80%_at_50%_0%,rgba(56,189,248,0.16),transparent_60%)] px-4 py-5 sm:px-6">
            <span className="material-symbols-outlined text-[28px]! text-sky-300/80" aria-hidden>
              phishing
            </span>
            <p className="mt-2 max-w-xl text-sm text-white/70">{t("fishingBlurb", { energy: FISHING_ENERGY_COST })}</p>
            <GameCtaButton
              variant="red"
              disabled={pending}
              className="mt-4 max-w-xs min-h-11!"
              onClick={() =>
                start(async () => {
                  const r = await castLine(locale);
                  if (!r.ok) flash(t(`errors.${r.error}`));
                  else if (r.caught)
                    flash(r.shiny ? t("fishShiny", { name: r.speciesName }) : t("fishCatch", { name: r.speciesName }));
                  else flash(t("fishMiss", { name: r.speciesName }));
                })
              }
            >
              {t("cast")}
            </GameCtaButton>
          </div>
        </section>
      ) : null}

      {tab === "wonder" ? (
        <section className="rounded-3xl border border-white/10 bg-[#12141c] p-4 sm:p-5">
          <p className="text-sm text-white/70">{t("wonderBlurb")}</p>
          {data.wonderPending ? (
            <>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-3">
                <PokemonImage src={data.wonderPending.spriteUrl} speciesName={data.wonderPending.speciesName} alt={data.wonderPending.name} width={64} height={64} />
                <p className="text-sm text-white">{t("wonderPending", { name: data.wonderPending.name })}</p>
              </div>
              <GameCtaButton
                variant="secondary"
                disabled={pending}
                className="mt-4 max-w-xs min-h-11!"
                onClick={() =>
                  start(async () => {
                    const r = await cancelWonderTrade(locale);
                    flash(r.ok ? t("wonderCancelled") : t(`errors.${r.error}`));
                  })
                }
              >
                {t("wonderCancel")}
              </GameCtaButton>
            </>
          ) : (
            <>
              {picker}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <GameCtaButton
                  variant="brand"
                  disabled={pending || !selected}
                  className="min-h-11!"
                  onClick={() =>
                    start(async () => {
                      if (!selected) return;
                      const r = await submitWonderTrade(locale, selected.id);
                      if (!r.ok) flash(t(`errors.${r.error}`));
                      else if (r.queued) flash(t("wonderQueued"));
                      else flash(t("wonderPlayer", { name: r.receivedName }));
                    })
                  }
                >
                  {t("wonderSend")}
                </GameCtaButton>
                <GameCtaButton
                  variant="secondary"
                  disabled={pending || !selected}
                  className="min-h-11!"
                  onClick={() =>
                    start(async () => {
                      if (!selected) return;
                      const r = await tradeWithTraveler(locale, selected.id);
                      flash(r.ok ? t("wonderNpc", { name: r.receivedName }) : t(`errors.${r.error}`));
                    })
                  }
                >
                  {t("wonderTraveler")}
                </GameCtaButton>
              </div>
            </>
          )}
        </section>
      ) : null}

      {tab === "corner" ? (
        <section className="rounded-3xl border border-white/10 bg-[#12141c] p-4 sm:p-5">
          <p className="text-sm text-white/70">{t("cornerBlurb", { cost: CORNER_SPIN_COST })}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(lastReels ?? (["ball", "berry", "star"] as const)).map((symbol, i) => (
              <div
                key={`${symbol}-${i}`}
                className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-black/35"
              >
                <span className="material-symbols-outlined text-[36px]! text-electric-yellow sm:text-[44px]!" aria-hidden>
                  {REEL_ICON[symbol]}
                </span>
              </div>
            ))}
          </div>
          <GameCtaButton
            variant="gem"
            disabled={pending}
            className="mt-4 max-w-xs min-h-11!"
            onClick={() =>
              start(async () => {
                const r = await spinCornerAction(locale);
                if (!r.ok) flash(t(`errors.${r.error}`));
                else {
                  setLastReels(r.reels);
                  flash(
                    r.payout > 0
                      ? t("cornerWin", { reels: r.reels.join(" · "), coins: r.payout })
                      : t("cornerLose", { reels: r.reels.join(" · ") }),
                  );
                }
              })
            }
          >
            {t("spin", { cost: CORNER_SPIN_COST })}
          </GameCtaButton>
        </section>
      ) : null}

      {tab === "farm" ? (
        <section className="grid gap-3 sm:grid-cols-3">
          {data.farm.map((plot) => (
            <article key={plot.slot} className="rounded-3xl border border-white/10 bg-[#12141c] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                {t("plot", { n: plot.slot })}
              </p>
              {plot.berryName ? (
                <>
                  <div className="mt-3 flex items-center gap-2">
                    <Image
                      src={itemDisplayUrl(plot.berryName)}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain"
                    />
                    <div>
                      <p className="text-sm text-white">{plot.berryName}</p>
                      <p className="text-xs text-white/50">{plot.ready ? t("ready") : t("growing")}</p>
                    </div>
                  </div>
                  <GameCtaButton
                    variant="red"
                    disabled={pending || !plot.ready}
                    className="mt-3 min-h-9! text-[11px]!"
                    onClick={() =>
                      start(async () => {
                        const r = await harvestPlot(locale, plot.slot);
                        flash(r.ok ? t("harvested", { n: r.yield }) : t(`errors.${r.error}`));
                      })
                    }
                  >
                    {t("harvest")}
                  </GameCtaButton>
                </>
              ) : (
                <>
                  {data.berries.every((berry) => berry.quantity < 1) ? (
                    <div className="mt-3 grid place-items-center rounded-2xl border border-dashed border-white/12 bg-black/20 px-3 py-5 text-center">
                      <span className="material-symbols-outlined text-[28px]! text-white/25" aria-hidden>
                        spa
                      </span>
                      <p className="mt-2 text-sm text-white/50">{t("noBerries")}</p>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-col gap-1.5">
                      {data.berries
                        .filter((berry) => berry.quantity > 0)
                        .map((berry) => (
                          <button
                            key={berry.itemId}
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                const r = await plantBerry(locale, plot.slot, berry.itemId);
                                flash(r.ok ? t("planted") : t(`errors.${r.error}`));
                              })
                            }
                            className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 text-left text-[12px] text-white/85 hover:border-primary/35"
                          >
                            <Image
                              src={itemDisplayUrl(berry.name)}
                              alt=""
                              width={22}
                              height={22}
                              className="h-[22px] w-[22px] object-contain"
                            />
                            {berry.name} ×{berry.quantity}
                          </button>
                        ))}
                    </div>
                  )}
                </>
              )}
            </article>
          ))}
        </section>
      ) : null}

      {tab === "mine" ? (
        <section className="rounded-3xl border border-white/10 bg-[#12141c] p-4 sm:p-5">
          <p className="text-sm text-white/70">
            {t("mineBlurb", { energy: MINE_DIG_ENERGY_COST, coins: MINE_COIN_DROP, left: data.mine.digsLeft })}
          </p>
          <div className="mt-4 grid grid-cols-5 gap-1.5">
            {data.mine.grid.map((cell, index) => (
              <button
                key={index}
                type="button"
                disabled={pending || cell.dug || data.mine.digsLeft <= 0}
                onClick={() =>
                  start(async () => {
                    const r = await digMineCell(locale, index);
                    flash(r.ok ? t(`loot.${r.loot}`) : t(`errors.${r.error}`));
                  })
                }
                className={`grid aspect-square place-items-center rounded-xl border text-[11px] ${
                  cell.dug
                    ? "border-white/10 bg-black/35 text-white/40"
                    : "border-amber-500/20 bg-[#1a1712] text-amber-100/80 hover:border-amber-400/40"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]!" aria-hidden>
                  {cell.dug ? (cell.loot === "empty" ? "grain" : "star") : "question_mark"}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(data.mine.bag) as Array<keyof MineBag>).map((kind) => (
              <GameCtaButton
                key={kind}
                variant="brand"
                disabled={pending || data.mine.bag[kind] < 1}
                className="min-h-9! w-auto! min-w-[9rem] px-3! text-[11px]!"
                onClick={() =>
                  start(async () => {
                    const r = await reviveFossil(locale, kind);
                    flash(r.ok ? t("revived", { name: r.speciesName, cost: MINE_REVIVE_COST }) : t(`errors.${r.error}`));
                  })
                }
              >
                {t(`fossil.${kind}`, { n: data.mine.bag[kind] })}
              </GameCtaButton>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "frontier" ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {data.frontier.map((row) => (
            <article key={row.facility} className="rounded-3xl border border-white/10 bg-[#12141c] p-4">
              <span className="material-symbols-outlined text-[22px]! text-primary" aria-hidden>
                {row.facility === "palace" ? "castle" : "stadium"}
              </span>
              <h2 className="mt-2 text-lg font-semibold text-white">{t(`frontier.${row.facility}.title`)}</h2>
              <p className="mt-1 text-sm text-white/55">{t(`frontier.${row.facility}.blurb`)}</p>
              <p className="mt-2 text-xs text-white/45">
                {t("frontierMeta", { streak: row.streak, wins: row.wins, energy: FRONTIER_ENERGY_COST })}
              </p>
              <GameCtaButton
                variant="red"
                disabled={pending}
                className="mt-4 min-h-11!"
                onClick={() =>
                  start(async () => {
                    const r = await playFrontier(locale, row.facility);
                    if (!r.ok) flash(t(`errors.${r.error}`));
                    else flash(r.won ? t("frontierWin", { coins: r.coins, streak: r.streak }) : t("frontierLose"));
                  })
                }
              >
                {t("challenge")}
              </GameCtaButton>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function MonPicker({
  box,
  value,
  onChange,
  pickHint,
  empty,
}: {
  box: ParkMonOption[];
  value: string;
  onChange: (id: string) => void;
  pickHint: string;
  empty: string;
}) {
  if (box.length === 0) return <p className="mt-3 text-sm text-white/45">{empty}</p>;
  return (
    <div className="mt-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{pickHint}</p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {box.map((mon) => {
          const active = mon.id === value;
          return (
            <button
              key={mon.id}
              type="button"
              onClick={() => onChange(mon.id)}
              className={`flex w-[4.75rem] shrink-0 flex-col items-center rounded-2xl border px-1.5 py-2 ${
                active ? "border-primary/50 bg-primary/15" : "border-white/10 bg-black/25"
              }`}
            >
              <PokemonImage src={mon.spriteUrl} speciesName={mon.speciesName} alt={mon.name} width={48} height={48} className="h-12 w-12 object-contain" />
              <span className="mt-1 line-clamp-2 w-full text-center text-[10px] leading-tight text-white/80">
                {mon.name}
              </span>
              <span className="font-mono text-[9px] text-white/40">Nv. {mon.level}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
