"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  castLine,
  submitWonderTrade,
  cancelWonderTrade,
  tradeWithTraveler,
  spinCornerAction,
  plantBerry,
  harvestPlot,
  digMineCell,
  reviveFossil,
  depositDaycare,
  collectDaycare,
  withdrawDaycare,
  playFrontier,
} from "@/actions/park";
import type { ParkHubData } from "@/lib/park/view";
import { CORNER_FREE_SPINS_PER_DAY } from "@/lib/park/corner";
import { CornerSlot } from "@/components/park/corner-slot";
import { ParkFarm } from "@/components/park/park-farm";
import { ParkFishing } from "@/components/park/park-fishing";
import { ParkMine } from "@/components/park/park-mine";
import { ParkWonder } from "@/components/park/park-wonder";
import { ParkDaycare } from "@/components/park/park-daycare";
import { ParkFrontier } from "@/components/park/park-frontier";
import { ParkHowTo } from "@/components/park/park-how-to";
import { ParkToast, type ParkToastKind } from "@/components/park/park-toast";
import {
  CORNER_SPIN_ENERGY_COST,
  FISHING_ENERGY_COST,
  FRONTIER_ENERGY_COST,
  WONDER_TRADE_ENERGY_COST,
} from "@/lib/energy";
import { FISHING_TABLE, FISHING_FREE_CASTS_PER_DAY } from "@/lib/park/fishing";
import { WONDER_FREE_TRADES_PER_DAY, WONDER_MIN_BADGES } from "@/lib/park/wonder";
import { DAYCARE_DEPOSIT_COST } from "@/lib/park/daycare";
import { FRAGMENTS_TO_ASSEMBLE } from "@/lib/park/fragments";
import { FOSSIL_SPECIES, MINE_COIN_DROP, MINE_FRAGMENTS_TO_ASSEMBLE } from "@/lib/park/mine";
import { DEFAULT_PARK_TAB, PARK_TABS, parkTabHref, type ParkTab } from "@/lib/park/tabs";
import { itemHdIconUrl } from "@/lib/item-hd-icons";
import { announceEnergyDelta } from "@/lib/resource-fx";
import {
  warmParkStaticAssets,
  warmParkTabAssets,
  warmSpeciesSprites,
} from "@/lib/park-assets";

const TAB_ICON: Record<ParkTab, string> = {
  daycare: "cottage",
  fishing: "phishing",
  wonder: "swap_horiz",
  corner: "casino",
  farm: "spa",
  mine: "hardware",
  frontier: "stadium",
};

const COIN_ICON = itemHdIconUrl("Gold Coin") ?? "/items/hd/gold-coin.png";
const ENERGY_ICON = itemHdIconUrl("Energy") ?? "/items/hd/energy.png";

function ParkTabBar({
  tab,
  onTab,
  label,
  ariaLabel,
}: {
  tab: ParkTab;
  onTab: (id: ParkTab) => void;
  label: (id: ParkTab) => string;
  ariaLabel: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  const btnRefs = useRef(new Map<ParkTab, HTMLButtonElement>());
  const [glide, setGlide] = useState({ left: 0, width: 0, ready: false });

  const syncGlide = useCallback(() => {
    const nav = navRef.current;
    const btn = btnRefs.current.get(tab);
    if (!nav || !btn) return;
    setGlide({ left: btn.offsetLeft, width: btn.offsetWidth, ready: true });
  }, [tab]);

  useLayoutEffect(() => {
    syncGlide();
    btnRefs.current.get(tab)?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [tab, syncGlide]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(syncGlide);
    ro.observe(nav);
    window.addEventListener("resize", syncGlide);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncGlide);
    };
  }, [syncGlide]);

  return (
    <nav ref={navRef} className="park-tabs" role="tablist" aria-label={ariaLabel}>
      <span
        className={`park-tabs__glide${glide.ready ? " is-ready" : ""}`}
        style={{ width: glide.width, transform: `translateX(${glide.left}px)` }}
        aria-hidden
      />
      {PARK_TABS.map((id) => (
        <button
          key={id}
          ref={(node) => {
            if (node) btnRefs.current.set(id, node);
            else btnRefs.current.delete(id);
          }}
          type="button"
          data-tab={id}
          onClick={() => onTab(id)}
          onMouseEnter={() => warmParkTabAssets(id)}
          onFocus={() => warmParkTabAssets(id)}
          aria-selected={tab === id}
          role="tab"
          className={`park-tabs__btn${tab === id ? " is-on" : ""}`}
        >
          <span className="material-symbols-outlined" aria-hidden>
            {TAB_ICON[id]}
          </span>
          {label(id)}
        </button>
      ))}
    </nav>
  );
}

export function ParkHub({
  locale,
  data,
  initialTab = DEFAULT_PARK_TAB,
}: {
  locale: string;
  data: ParkHubData;
  initialTab?: ParkTab;
}) {
  const t = useTranslations("park");
  const router = useRouter();
  const [tab, setTab] = useState<ParkTab>(initialTab);
  const [lastInitialTab, setLastInitialTab] = useState(initialTab);
  if (lastInitialTab !== initialTab) {
    setLastInitialTab(initialTab);
    setTab(initialTab);
  }
  const [picked, setPicked] = useState<string>(data.box[0]?.id ?? "");
  const [notice, setNotice] = useState<{
    id: number;
    tab: ParkTab;
    message: string;
    kind: ParkToastKind;
  } | null>(null);
  const noticeSeq = useRef(0);
  const [pending, start] = useTransition();
  const [cornerFreeLeft, setCornerFreeLeft] = useState(data.corner.freeLeft);
  const [fishingFreeLeft, setFishingFreeLeft] = useState(data.fishing.freeLeft);
  const [wonderFreeLeft, setWonderFreeLeft] = useState(data.wonder.freeLeft);

  function selectTab(id: ParkTab) {
    setTab(id);
    setNotice((current) => (current && current.tab === id ? current : null));
    router.replace(parkTabHref(id), { scroll: false });
  }

  useEffect(() => {
    warmParkStaticAssets();
    warmParkTabAssets(tab);
    const species = new Set<number>();
    for (const row of data.fragments) species.add(row.speciesId);
    for (const entry of FISHING_TABLE) species.add(entry.speciesId);
    for (const id of Object.values(FOSSIL_SPECIES)) species.add(id);
    warmSpeciesSprites(species);
  }, [data.fragments, tab]);

  const selected = useMemo(
    () => data.box.find((mon) => mon.id === picked) ?? data.box[0] ?? null,
    [data.box, picked],
  );

  function flash(message: string, kind: ParkToastKind = "ok") {
    noticeSeq.current += 1;
    setNotice({ id: noticeSeq.current, tab, message, kind });
  }

  /* Lo último que pasó en el huerto, para que lo diga el jardinero. */
  const farmSays = notice && notice.tab === "farm" ? notice.message : null;

  return (
    <div className="park-screen mx-auto flex w-full max-w-5xl flex-col gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-5">
      <header className="park-hero">
        {/*
          Arte a sangre anclado a la derecha, en la proporción del archivo
          (736×420) para no recortarlo, y el texto sobre un velo que va de tinta
          plena a transparente. Mismo criterio que el banner de eventos del
          home: la separación la hace un degradé, así que no hay canto donde
          "empieza la foto".

          Acá el velo es más opaco que allá y no es capricho: esta ilustración
          es clara y saturada de punta a punta —cielo, follaje, agua—, y sobre
          eso el texto blanco no se lee sin una cama oscura de verdad.
        */}
        <span className="park-hero__art" aria-hidden>
          <Image
            src="/park/hero.jpg"
            alt=""
            fill
            sizes="(max-width: 767px) 100vw, 900px"
            quality={90}
            priority
            className="park-hero__img"
          />
        </span>
        <span className="park-hero__scrim" aria-hidden />

        <div className="park-hero__copy">
          <p className="park-hero__eyebrow">{t("eyebrow")}</p>
          <h1 className="park-hero__title">{t("title")}</h1>
          <p className="park-hero__blurb">{t("subtitle")}</p>
          <div className="park-hero__stats">
            <span>
              <Image src={COIN_ICON} alt="" width={16} height={16} />
              {data.coins.toLocaleString()}
            </span>
            <span>
              <Image src={ENERGY_ICON} alt="" width={16} height={16} />
              {data.energy}/{data.energyMax}
            </span>
          </div>
        </div>
      </header>

      <div className="park-toolbar">
        <ParkTabBar
          tab={tab}
          ariaLabel={t("title")}
          label={(id) => t(`tabs.${id}`)}
          onTab={selectTab}
        />

        <ParkHowTo
          title={t(`howTo.${tab}.title`)}
          steps={[t(`howTo.${tab}.s1`), t(`howTo.${tab}.s2`), t(`howTo.${tab}.s3`)]}
          openLabel={t("howTo.open")}
        />
      </div>

      <div className="park-play">
      {notice && notice.tab === tab ? (
        <ParkToast
          token={notice.id}
          tab={notice.tab}
          icon={TAB_ICON[notice.tab]}
          message={notice.message}
          kind={notice.kind}
        />
      ) : null}

      <div key={tab} className="park-panel" data-tab={tab}>
      {tab === "fishing" ? (
        <ParkFishing
          busy={pending}
          need={FRAGMENTS_TO_ASSEMBLE}
          freeLeft={fishingFreeLeft}
          energy={data.energy}
          energyCost={FISHING_ENERGY_COST}
          energyIcon={ENERGY_ICON}
          resetAt={data.fishing.resetAt}
          resetMs={data.fishing.resetMs}
          progress={data.fragments.filter((row) => FISHING_TABLE.some((entry) => entry.speciesId === row.speciesId))}
          labels={{
            cast: t("cast"),
            casting: t("fishCasting"),
            idle: t("fishIdle"),
            catchText: (name) => t("fishCatch", { name }),
            fragmentText: (name, have, need) => t("fishFragment", { name, have, need }),
            assembledText: (name) => t("fishAssembled", { name }),
            shinyText: (name) => t("fishShiny", { name }),
            missText: (name) => t("fishMiss", { name }),
            castsLeft: (left, total) => t("fishCasts", { left, total }),
            dailyHint: t("fishDailyHint", {
              free: FISHING_FREE_CASTS_PER_DAY,
              energy: FISHING_ENERGY_COST,
            }),
            resetIn: (time) => t("dailyReset", { time }),
            freeRemaining: (n) => t("fishFreeLeft", { n }),
            idleNudge: t("fishIdleNudge"),
            level: (n) => t("fishLevel", { n }),
            rarity: (rarity) => t(`fishRarity.${rarity}`),
            sentToPc: t("fishSentToPc"),
            fragmentProgress: (have, need) => t("fishFragCount", { have, need }),
            fragmentTag: t("fishFragTag"),
            shinyTag: t("fishShinyTag"),
            escaped: t("fishEscaped"),
            fragmentsTitle: t("fishFrags"),
          }}
          onResetExpired={() => {
            setFishingFreeLeft(FISHING_FREE_CASTS_PER_DAY);
            router.refresh();
          }}
          // El resultado lo cuenta el pescador en su globito; a la barra de la
          // pantalla sólo van los errores.
          onCast={async () => {
            const r = await castLine(locale);
            if (!r.ok) {
              flash(t(`errors.${r.error}`), "error");
              return r;
            }
            setFishingFreeLeft(r.freeLeft);
            if (r.energySpent > 0) announceEnergyDelta(-r.energySpent);
            return r;
          }}
        />
      ) : null}

      {tab === "wonder" ? (
        <ParkWonder
          box={data.box}
          selected={selected}
          pendingOffer={data.wonderPending}
          busy={pending}
          unlocked={data.wonder.unlocked}
          freeLeft={wonderFreeLeft}
          energy={data.energy}
          energyCost={WONDER_TRADE_ENERGY_COST}
          energyIcon={ENERGY_ICON}
          resetAt={data.wonder.resetAt}
          resetMs={data.wonder.resetMs}
          labels={{
            pickHint: t("pickHint"),
            empty: t("emptyBox"),
            offer: t("wonderOffer"),
            incoming: t("wonderReturn"),
            waiting: t("wonderWaiting"),
            emptyPad: t("wonderEmptyPad"),
            send: t("wonderSend"),
            traveler: t("wonderTraveler"),
            cancel: t("wonderCancel"),
            pending: (name) => t("wonderPending", { name }),
            level: (n) => t("fishLevel", { n }),
            idle: t("wonderHostIdle"),
            swapping: t("wonderHostSwap"),
            queued: (name) => t("wonderHostQueued", { name }),
            got: (name) => t("wonderHostGot", { name }),
            received: (name) => t("wonderPlayer", { name }),
            tradesLeft: (left, total) => t("wonderTrades", { left, total }),
            dailyHint: t("wonderDailyHint", {
              free: WONDER_FREE_TRADES_PER_DAY,
              energy: WONDER_TRADE_ENERGY_COST,
            }),
            resetIn: (time) => t("dailyReset", { time }),
            idleNudge: t("wonderIdleNudge"),
            freeRemaining: (n) => t("wonderFreeLeft", { n }),
            lockedTitle: t("wonderLocked"),
            lockedBody: t("wonderLockedBody", { n: WONDER_MIN_BADGES }),
          }}
          onSelect={setPicked}
          onQuota={({ freeLeft, energySpent }) => {
            setWonderFreeLeft(freeLeft);
            if (energySpent > 0) announceEnergyDelta(-energySpent);
          }}
          onResetExpired={() => {
            setWonderFreeLeft(WONDER_FREE_TRADES_PER_DAY);
            router.refresh();
          }}
          onTrade={async (instanceId) => {
            const r = await submitWonderTrade(locale, instanceId);
            if (!r.ok) {
              flash(t(`errors.${r.error}`), "error");
              return r;
            }
            if (r.queued || !r.received) {
              return { ok: true, queued: true, energySpent: r.energySpent, freeLeft: r.freeLeft };
            }
            flash(t("wonderPlayer", { name: r.received.name }), "ok");
            return {
              ok: true,
              queued: false,
              received: r.received,
              energySpent: r.energySpent,
              freeLeft: r.freeLeft,
            };
          }}
          onTraveler={async (instanceId) => {
            const r = await tradeWithTraveler(locale, instanceId);
            if (!r.ok) {
              flash(t(`errors.${r.error}`), "error");
              return r;
            }
            flash(t("wonderPlayer", { name: r.received.name }), "ok");
            return {
              ok: true,
              queued: false,
              received: r.received,
              energySpent: r.energySpent,
              freeLeft: r.freeLeft,
            };
          }}
          onCancel={async () => {
            const r = await cancelWonderTrade(locale);
            flash(r.ok ? t("wonderCancelled") : t(`errors.${r.error}`), r.ok ? "ok" : "error");
            return r;
          }}
        />
      ) : null}

      {tab === "corner" ? (
        <CornerSlot
          disabled={pending || (cornerFreeLeft <= 0 && data.energy < CORNER_SPIN_ENERGY_COST)}
          cost={CORNER_SPIN_ENERGY_COST}
          coinIcon={COIN_ICON}
          energyIcon={ENERGY_ICON}
          freeLeft={cornerFreeLeft}
          resetAt={data.corner.resetAt}
          resetMs={data.corner.resetMs}
          labels={{
            spin: t("spin"),
            jackpot: t("cornerJackpot"),
            freeRemaining: (n) => t("cornerFreeLeft", { n }),
            spinsLeft: (left, total) => t("cornerSpins", { left, total }),
            dailyHint: t("cornerDailyHint", {
              free: CORNER_FREE_SPINS_PER_DAY,
              energy: CORNER_SPIN_ENERGY_COST,
            }),
            resetIn: (time) => t("dailyReset", { time }),
            idleNudge: t("cornerIdleNudge"),
            ready: t("cornerHostIdle"),
            spinning: t("cornerHostSpin"),
            win: t("cornerHostWin"),
            nothing: t("cornerHostLose"),
            hostJackpot: t("cornerHostJackpot"),
            match: (count) => t("cornerMatch", { count }),
          }}
          spin={() => spinCornerAction(locale)}
          onResetExpired={() => {
            setCornerFreeLeft(CORNER_FREE_SPINS_PER_DAY);
            router.refresh();
          }}
          // El resultado de la tirada lo muestra la máquina; el toast es
          // sólo para errores (sin energía, etc.).
          onResult={(r) => {
            if (!r.ok) {
              flash(t(`errors.${r.error}`), "error");
              return;
            }
            setCornerFreeLeft(r.freeLeft);
            if (r.energySpent > 0) announceEnergyDelta(-r.energySpent);
          }}
        />
      ) : null}

      {tab === "farm" ? (
        <ParkFarm
          plots={data.farm}
          berries={data.berries}
          busy={pending}
          bubble={farmSays}
          labels={{
            idle: t("farmIdle"),
            planted: t("planted"),
            readyBubble: t("farmReadyBubble"),
            harvested: (n) => t("harvested", { n }),
            plot: (n) => t("plot", { n }),
            ready: t("ready"),
            growing: t("growing"),
            harvest: t("harvest"),
            plant: t("plant"),
            pickBerry: t("pickBerry"),
            noBerries: t("noBerries"),
            timeLeftHm: (h, m) => t("timeLeftHm", { h, m }),
            timeLeftM: (m) => t("timeLeftM", { m }),
            hint: t("farmHint"),
            seeds: t("farmSeeds"),
            occupancy: (planted, total) => t("farmOccupancy", { planted, total }),
          }}
          onPlant={(slot, itemId) =>
            start(async () => {
              const r = await plantBerry(locale, slot, itemId);
              flash(r.ok ? t("planted") : t(`errors.${r.error}`), r.ok ? "ok" : "error");
            })
          }
          onHarvest={(slot) =>
            start(async () => {
              const r = await harvestPlot(locale, slot);
              flash(r.ok ? t("harvested", { n: r.yield }) : t(`errors.${r.error}`), r.ok ? "ok" : "error");
            })
          }
        />
      ) : null}

      {tab === "mine" ? (
        <ParkMine
          grid={data.mine.grid}
          bag={data.mine.bag}
          digsLeft={data.mine.digsLeft}
          resetMs={data.mine.resetMs}
          resetAt={data.mine.resetAt}
          coinDrop={MINE_COIN_DROP}
          fragmentsNeed={MINE_FRAGMENTS_TO_ASSEMBLE}
          busy={pending}
          labels={{
            digsLeft: (left, total) => t("mineDigs", { left, total }),
            dailyHint: t("mineEnergy"),
            resetIn: (time) => t("dailyReset", { time }),
            drops: t("mineDrops"),
            dropName: (loot) => t(`mineDrop.${loot}`),
            empty: t("loot.empty"),
            lootName: (loot) => t(`lootName.${loot}`),
            idle: t("mineIdle"),
            bagTitle: t("mineBag"),
            revive: t("mineRevive"),
            progress: (have, need) => t("mineFragCount", { have, need }),
            fossil: (kind) => t(`fossilName.${kind}`),
            noFossils: t("mineNoFossils"),
          }}
          onResetExpired={() => router.refresh()}
          // El hallazgo sale en el globo del minero; acá sólo los errores.
          onDig={async (index) => {
            const r = await digMineCell(locale, index);
            if (!r.ok) flash(t(`errors.${r.error}`), "error");
            return r;
          }}
          onRevive={(kind) =>
            start(async () => {
              const r = await reviveFossil(locale, kind);
              flash(
                r.ok ? t("revived", { name: r.speciesName }) : t(`errors.${r.error}`),
                r.ok ? "ok" : "error",
              );
            })
          }
        />
      ) : null}

      {tab === "daycare" ? (
        <ParkDaycare
          slots={data.daycare}
          box={data.box}
          selected={selected}
          busy={pending}
          coins={data.coins}
          labels={{
            occupancy: (held, total) => t("daycareOccupancy", { held, total }),
            hint: t("daycareHint", { cap: 3, ceiling: data.daycare[0]?.ceiling ?? 15 }),
            empty: t("emptySlot"),
            emptyBox: t("emptyBox"),
            pickHint: t("pickHint"),
            nest: (n) => t("slot", { n }),
            emptySlot: t("emptySlot"),
            deposit: t("deposit", { cost: DAYCARE_DEPOSIT_COST }),
            collect: t("collect"),
            withdraw: t("withdraw"),
            pending: (n) => t("pendingLevels", { n }),
            next: (time) => t("daycareNext", { time }),
            maxed: t("daycareMax"),
            ceiling: (level) => t("daycareCeiling", { level }),
            growing: t("growing"),
            idle: t("daycareIdle"),
            ready: t("daycareReadyBubble"),
            level: (n) => t("fishLevel", { n }),
            timeLeftHm: (h, m) => t("timeLeftHm", { h, m }),
            timeLeftM: (m) => t("timeLeftM", { m }),
          }}
          onSelect={setPicked}
          onDeposit={(instanceId, slot) =>
            start(async () => {
              const r = await depositDaycare(locale, instanceId, slot);
              flash(r.ok ? t("deposited", { cost: DAYCARE_DEPOSIT_COST }) : t(`errors.${r.error}`), r.ok ? "ok" : "error");
              if (r.ok) router.refresh();
            })
          }
          onCollect={(depositId) =>
            start(async () => {
              const r = await collectDaycare(locale, depositId);
              flash(
                r.ok ? t("collectedLevels", { name: r.name, n: r.levels }) : t(`errors.${r.error}`),
                r.ok ? "ok" : "error",
              );
              if (r.ok) router.refresh();
            })
          }
          onWithdraw={(depositId) =>
            start(async () => {
              const r = await withdrawDaycare(locale, depositId);
              if (!r.ok) {
                flash(t(`errors.${r.error}`), "error");
                return;
              }
              flash(t("withdrawn"), "ok");
              router.refresh();
            })
          }
        />
      ) : null}

      {tab === "frontier" ? (
        <ParkFrontier
          facilities={data.frontier}
          busy={pending}
          energy={data.energy}
          energyIcon={ENERGY_ICON}
          resetAt={data.mine.resetAt}
          resetMs={data.mine.resetMs}
          labels={{
            idle: t("frontierIdle"),
            fighting: t("frontierFight"),
            winLead: t("frontierWinLead"),
            winStreak: (n) => t("frontierWinStreak", { n }),
            lose: t("frontierLose"),
            challenge: t("challenge"),
            streak: (n) => t("frontierStreak", { n }),
            wins: (n) => t("frontierWins", { n }),
            winsShort: (n) => t("frontierWinsShort", { n }),
            lastWon: t("frontierLastWon"),
            lastLost: t("frontierLastLost"),
            palaceTitle: t("frontier.palace.title"),
            palaceBlurb: t("frontier.palace.blurb"),
            domeTitle: t("frontier.dome.title"),
            domeBlurb: t("frontier.dome.blurb"),
            resetIn: (time) => t("dailyReset", { time }),
          }}
          onResetExpired={() => router.refresh()}
          onPlay={async (facility) => {
            const r = await playFrontier(locale, facility);
            if (!r.ok) {
              flash(t(`errors.${r.error}`), "error");
              return r;
            }
            if (r.won) flash(t("frontierWin", { coins: r.coins, streak: r.streak }), "ok");
            else flash(t("frontierLose"), "error");
            announceEnergyDelta(-FRONTIER_ENERGY_COST);
            router.refresh();
            return { ok: true, won: r.won, coins: r.coins, streak: r.streak, energySpent: FRONTIER_ENERGY_COST };
          }}
        />
      ) : null}

      </div>
      </div>
    </div>
  );
}
