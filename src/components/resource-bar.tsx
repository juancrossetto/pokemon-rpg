"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { CoinsBadge } from "@/components/coins-badge";
import {
  formatCountdown,
  GYM_BATTLE_ENERGY_COST,
  msUntilNextEnergyPoint,
  PVP_BATTLE_ENERGY_COST,
  WILD_ENCOUNTER_ENERGY_COST,
} from "@/lib/energy";
import { itemHdIconUrl } from "@/lib/item-hd-icons";

const RESOURCE_ICON = {
  energy: itemHdIconUrl("Energy") ?? "/items/hd/energy.png",
  coins: itemHdIconUrl("Gold Coin") ?? "/items/hd/gold-coin.png",
  gems: itemHdIconUrl("Gem") ?? "/items/hd/gem.png",
} as const;

export type ResourceBarLabels = {
  energy: string;
  energyFull: string;
  energyRegen: string;
  energyNext: string;
  energyEmptyTitle?: string;
  energyEmptyBody?: string;
  energyEmptyWait?: string;
  energyEmptyShop?: string;
  energyEmptyRewards?: string;
  energyEmptyTeam?: string;
  energyCostsTitle: string;
  energyCostExplore: string;
  energyCostGym: string;
  energyCostPvp: string;
  energyPacing: string;
  coins: string;
  coinsBalance: string;
  coinsShop: string;
  coinsMarket: string;
  gems: string;
  gemsBalance: string;
  gemsHint: string;
  gemsPc: string;
  close: string;
  resources: string;
  add: string;
};

type OpenSlot = "energy" | "coins" | "gems" | "all" | null;
type Tone = "energy" | "coins" | "gems";

type ResourceBarProps = {
  energy: number;
  energyMax: number;
  energyUpdatedAt: string;
  coins: number;
  gems: number;
  labels: ResourceBarLabels;
  variant?: "desktop" | "mobile";
};

function useEnergyCountdown(energy: number, energyMax: number, energyUpdatedAt: string) {
  const [remaining, setRemaining] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    const updatedAt = new Date(energyUpdatedAt);
    const tick = () => setRemaining(msUntilNextEnergyPoint(energy, energyMax, updatedAt));
    const raf = requestAnimationFrame(tick);
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [energy, energyMax, energyUpdatedAt]);

  return remaining;
}

function PopoverPanel({
  id,
  title,
  iconSrc,
  children,
  onClose,
  closeLabel,
}: {
  id: string;
  title: string;
  iconSrc?: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div
      id={id}
      role="dialog"
      aria-label={title}
      className="absolute right-0 top-full z-[80] mt-2 w-[min(92vw,260px)] overflow-hidden rounded-xl border border-white/12 bg-[#0c0e14]/97 shadow-[0_20px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          {iconSrc ? (
            <Image
              src={iconSrc}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]"
              unoptimized
            />
          ) : null}
          <p className="truncate text-[13px] font-semibold tracking-wide text-white">
            {title}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition hover:bg-white/8 hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pokeball-red/60"
        >
          <span className="material-symbols-outlined text-[18px]!">close</span>
        </button>
      </div>
      <div className="space-y-3 px-3 pb-3 pt-1">{children}</div>
    </div>
  );
}

function ResourceAction({
  href,
  label,
  icon,
  onNavigate,
  tone = "neutral",
}: {
  href: string;
  label: string;
  icon: string;
  onNavigate: () => void;
  tone?: "neutral" | "gem";
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={[
        "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2",
        tone === "gem"
          ? "border border-gem/40 bg-gem/12 text-gem hover:bg-gem/20 focus-visible:ring-gem/50"
          : "border border-white/12 bg-white/[0.04] text-on-surface hover:bg-white/[0.08] focus-visible:ring-white/30",
      ].join(" ")}
    >
      <span className="material-symbols-outlined text-[16px]!">{icon}</span>
      {label}
    </Link>
  );
}

const TONE = {
  energy: {
    value: "text-white",
    plus: "text-white/55 hover:text-sky-200 hover:bg-white/8",
    ring: "focus-visible:ring-sky-400/50",
    track: "border-white/12 bg-[#12161f]",
  },
  coins: {
    value: "text-white",
    plus: "text-white/55 hover:text-electric-yellow hover:bg-white/8",
    ring: "focus-visible:ring-electric-yellow/50",
    track: "border-white/12 bg-[#12161f]",
  },
  gems: {
    value: "text-white",
    plus: "text-white/55 hover:text-gem hover:bg-white/8",
    ring: "focus-visible:ring-gem/50",
    track: "border-white/12 bg-[#12161f]",
  },
} as const;

/**
 * Barra integrada: [ícono PNG | valor | +] — misma altura, sin solape.
 */
function ResourcePill({
  tone,
  value,
  ariaLabel,
  addLabel,
  open,
  controlsId,
  onOpen,
  popover,
  compact,
}: {
  tone: Tone;
  value: ReactNode;
  ariaLabel: string;
  addLabel: string;
  open: boolean;
  controlsId: string;
  onOpen: () => void;
  popover: ReactNode;
  compact?: boolean;
}) {
  const t = TONE[tone];
  const iconSrc = RESOURCE_ICON[tone];
  const iconClass =
    tone === "energy" || tone === "gems"
      ? "h-[26px] w-[26px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] sm:h-[28px] sm:w-[28px]"
      : "h-[22px] w-[22px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] sm:h-[24px] sm:w-[24px]";

  return (
    <div className="relative shrink-0" data-loot-target={tone}>
      <div
        className={`relative flex h-7 items-stretch overflow-visible rounded-md border sm:h-8 ${t.track} ${
          compact ? "min-w-[4.75rem]" : "min-w-[5.5rem] sm:min-w-[6rem]"
        } ${open ? "border-white/20 bg-[#181d28]" : ""}`}
      >
        <span
          aria-hidden
          className="flex aspect-square h-full shrink-0 items-center justify-center bg-transparent"
        >
          <Image
            src={iconSrc}
            alt=""
            width={tone === "energy" || tone === "gems" ? 32 : 28}
            height={tone === "energy" || tone === "gems" ? 32 : 28}
            className={iconClass}
            unoptimized
          />
        </span>

        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={controlsId}
          onClick={onOpen}
          className={`flex min-w-0 flex-1 items-center justify-center px-1.5 font-mono text-[11px] font-semibold tabular-nums leading-none tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:text-[12px] ${t.value} ${t.ring}`}
        >
          <span className="truncate">{value}</span>
        </button>

        <button
          type="button"
          aria-label={addLabel}
          aria-expanded={open}
          aria-controls={controlsId}
          onClick={onOpen}
          className={`flex aspect-square h-full shrink-0 items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${t.plus} ${t.ring}`}
        >
          <span className="material-symbols-outlined text-[13px]! leading-none">add</span>
        </button>
      </div>
      {open && popover}
    </div>
  );
}

/**
 * Recursos del header estilo pastillas mobile RPG:
 * [+] valor [ícono] — energía, monedas y gemas.
 */
export function ResourceBar({
  energy,
  energyMax,
  energyUpdatedAt,
  coins,
  gems,
  labels,
  variant = "desktop",
}: ResourceBarProps) {
  const [open, setOpen] = useState<OpenSlot>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const remaining = useEnergyCountdown(energy, energyMax, energyUpdatedAt);
  const pct = energyMax > 0 ? Math.max(0, Math.min(100, (energy / energyMax) * 100)) : 0;
  const isFull = remaining === null;
  const countdown = typeof remaining === "number" ? formatCountdown(remaining) : null;
  const isMobile = variant === "mobile";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(slot: OpenSlot) {
    setOpen((prev) => (prev === slot ? null : slot));
  }

  const energyPanelId = `${baseId}-energy`;
  const coinsPanelId = `${baseId}-coins`;
  const gemsPanelId = `${baseId}-gems`;
  const allPanelId = `${baseId}-all`;

  const energyAria = `${labels.energy}: ${energy}/${energyMax}${
    countdown ? ` · +1 ${countdown}` : isFull ? ` · ${labels.energyFull}` : ""
  }`;
  const coinsAria = `${labels.coins}: ${coins}`;
  const gemsAria = `${labels.gems}: ${gems}`;

  const energyPopover = (
    <PopoverPanel
      id={energyPanelId}
      title={labels.energy}
      iconSrc={RESOURCE_ICON.energy}
      closeLabel={labels.close}
      onClose={() => setOpen(null)}
    >
      <div className="flex items-end justify-between gap-2">
        <p className="font-mono text-[22px] font-semibold leading-none tabular-nums text-white">
          {energy}
          <span className="text-[14px] text-white/40">/{energyMax}</span>
        </p>
        <p className="text-[11px] text-white/50">
          {isFull
            ? labels.energyFull
            : labels.energyNext.replace("{time}", countdown ?? "--:--")}
        </p>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-sky-400/85 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-1.5 text-[11px] text-white/55">
        {[
          { icon: "explore", cost: WILD_ENCOUNTER_ENERGY_COST, label: labels.energyCostExplore },
          { icon: "stadium", cost: GYM_BATTLE_ENERGY_COST, label: labels.energyCostGym },
          { icon: "swords", cost: PVP_BATTLE_ENERGY_COST, label: labels.energyCostPvp },
        ].map((row) => (
          <span
            key={row.label}
            title={row.label}
            className="inline-flex flex-1 items-center justify-center gap-0.5 rounded-md bg-white/[0.04] py-1.5 font-mono tabular-nums"
          >
            <span className="material-symbols-outlined text-[14px]! text-white/45">
              {row.icon}
            </span>
            <Image
              src={RESOURCE_ICON.energy}
              alt=""
              width={12}
              height={12}
              className="h-3 w-3 object-contain"
              unoptimized
            />
            {row.cost}
          </span>
        ))}
      </div>
      {energy <= 0 ? (
        <div className="flex gap-1.5">
          <ResourceAction
            href="/shop"
            icon="storefront"
            label={labels.energyEmptyShop ?? labels.coinsShop}
            onNavigate={() => setOpen(null)}
          />
          <ResourceAction
            href="/"
            icon="redeem"
            label={labels.energyEmptyRewards ?? "Rewards"}
            onNavigate={() => setOpen(null)}
          />
        </div>
      ) : null}
    </PopoverPanel>
  );

  const coinsPopover = (
    <PopoverPanel
      id={coinsPanelId}
      title={labels.coins}
      iconSrc={RESOURCE_ICON.coins}
      closeLabel={labels.close}
      onClose={() => setOpen(null)}
    >
      <p className="font-mono text-[22px] font-semibold leading-none tabular-nums text-electric-yellow">
        {coins.toLocaleString()}
      </p>
      <div className="flex gap-1.5">
        <ResourceAction
          href="/market?tab=shop"
          icon="storefront"
          label={labels.coinsShop}
          onNavigate={() => setOpen(null)}
        />
        <ResourceAction
          href="/market?tab=browse"
          icon="store"
          label={labels.coinsMarket}
          onNavigate={() => setOpen(null)}
        />
      </div>
    </PopoverPanel>
  );

  const gemsPopover = (
    <PopoverPanel
      id={gemsPanelId}
      title={labels.gems}
      iconSrc={RESOURCE_ICON.gems}
      closeLabel={labels.close}
      onClose={() => setOpen(null)}
    >
      <p className="font-mono text-[22px] font-semibold leading-none tabular-nums text-gem">
        {gems.toLocaleString()}
      </p>
      <ResourceAction
        href="/pc"
        icon="storage"
        label={labels.gemsPc}
        tone="gem"
        onNavigate={() => setOpen(null)}
      />
    </PopoverPanel>
  );

  const pills = (
    <div className={`flex items-center ${isMobile ? "gap-1.5" : "gap-2"}`}>
      <ResourcePill
        tone="energy"
        compact={isMobile}
        value={
          <span>
            {energy}
            <span className="text-white/45">/{energyMax}</span>
          </span>
        }
        ariaLabel={energyAria}
        addLabel={`${labels.add} · ${labels.energy}`}
        open={open === "energy"}
        controlsId={energyPanelId}
        onOpen={() => toggle("energy")}
        popover={energyPopover}
      />
      <ResourcePill
        tone="coins"
        compact={isMobile}
        value={<CoinsBadge coins={coins} size="bar" showIcon={false} />}
        ariaLabel={coinsAria}
        addLabel={`${labels.add} · ${labels.coins}`}
        open={open === "coins"}
        controlsId={coinsPanelId}
        onOpen={() => toggle("coins")}
        popover={coinsPopover}
      />
      <div>
        <ResourcePill
          tone="gems"
          compact={isMobile}
          value={gems.toLocaleString()}
          ariaLabel={gemsAria}
          addLabel={`${labels.add} · ${labels.gems}`}
          open={open === "gems"}
          controlsId={gemsPanelId}
          onOpen={() => toggle("gems")}
          popover={gemsPopover}
        />
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="relative shrink-0">
      {/*
        Mobile angosto: un chip con energía + oro visibles (el oro no puede
        quedar solo como ícono). Gemas van dentro del popover.
      */}
      {isMobile && (
        <div className="relative">
          <button
            type="button"
            aria-expanded={open === "all"}
            aria-controls={allPanelId}
            aria-label={labels.resources}
            onClick={() => toggle("all")}
            className={`flex h-8 min-w-[44px] items-center gap-1.5 rounded-md border border-white/12 bg-black/40 px-2 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pokeball-red/50 ${
              open === "all" ? "bg-white/[0.06]" : ""
            }`}
          >
            <span data-loot-target="energy" className="inline-flex items-center gap-1">
              <Image
                src={RESOURCE_ICON.energy}
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] object-contain"
                unoptimized
              />
              <span className="font-mono text-[11px] font-semibold tabular-nums text-sky-100">
                {energy}
              </span>
            </span>
            <span className="mx-0.5 h-3 w-px bg-white/15" aria-hidden />
            <span data-loot-target="coins" className="inline-flex items-center gap-1">
              <Image
                src={RESOURCE_ICON.coins}
                alt=""
                width={18}
                height={18}
                className="h-[18px] w-[18px] object-contain"
                unoptimized
              />
              <CoinsBadge coins={coins} size="bar" showIcon={false} />
            </span>
            <span className="mx-0.5 h-3 w-px bg-white/15" aria-hidden />
            <span data-loot-target="gems" className="inline-flex items-center gap-1">
              <Image
                src={RESOURCE_ICON.gems}
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] object-contain"
                unoptimized
              />
              <span className="font-mono text-[11px] font-semibold tabular-nums text-gem">
                {gems}
              </span>
            </span>
          </button>
          {open === "all" && (
            <PopoverPanel
              id={allPanelId}
              title={labels.resources}
              closeLabel={labels.close}
              onClose={() => setOpen(null)}
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <Image
                    src={RESOURCE_ICON.energy}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                    unoptimized
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[16px] font-semibold tabular-nums text-white">
                      {energy}
                      <span className="text-white/40">/{energyMax}</span>
                    </p>
                    <p className="text-[10px] text-white/45">
                      {isFull
                        ? labels.energyFull
                        : labels.energyNext.replace("{time}", countdown ?? "--:--")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Image
                    src={RESOURCE_ICON.coins}
                    alt=""
                    width={26}
                    height={26}
                    className="h-[26px] w-[26px] object-contain"
                    unoptimized
                  />
                  <p className="min-w-0 flex-1 font-mono text-[16px] font-semibold tabular-nums text-electric-yellow">
                    {coins.toLocaleString()}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <ResourceAction
                      href="/market?tab=shop"
                      icon="storefront"
                      label={labels.coinsShop}
                      onNavigate={() => setOpen(null)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Image
                    src={RESOURCE_ICON.gems}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                    unoptimized
                  />
                  <p className="min-w-0 flex-1 font-mono text-[16px] font-semibold tabular-nums text-gem">
                    {gems.toLocaleString()}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <ResourceAction
                      href="/pc"
                      icon="storage"
                      label={labels.gemsPc}
                      tone="gem"
                      onNavigate={() => setOpen(null)}
                    />
                  </div>
                </div>
              </div>
            </PopoverPanel>
          )}
        </div>
      )}

      {!isMobile && <div className="block">{pills}</div>}
    </div>
  );
}
