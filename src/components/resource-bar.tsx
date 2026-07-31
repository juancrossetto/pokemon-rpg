"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { CoinsBadge } from "@/components/coins-badge";
import { formatCountdown, msUntilNextEnergyPoint, REGEN_MS_PER_POINT } from "@/lib/energy";

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
  children,
  onClose,
  closeLabel,
}: {
  id: string;
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div
      id={id}
      role="dialog"
      aria-label={title}
      className="absolute right-0 top-full z-[80] mt-2 w-[min(92vw,280px)] overflow-hidden rounded-xl border border-white/12 bg-[#070a10]/96 shadow-[0_20px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <p className="text-[12px] font-semibold text-white">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition hover:bg-white/8 hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pokeball-red/60"
        >
          <span className="material-symbols-outlined text-[18px]!">close</span>
        </button>
      </div>
      <div className="space-y-2.5 px-3 py-3 text-[12px] text-on-surface-variant">{children}</div>
    </div>
  );
}

const TONE = {
  energy: {
    // Fondo opaco: el borde de la barra no se ve a través del ícono.
    iconBg: "bg-[#0f1724] border-sky-400/55 text-sky-300",
    value: "text-white",
    plus: "text-white/55 hover:text-sky-200 hover:bg-white/8",
    iconName: "bolt",
    ring: "focus-visible:ring-sky-400/50",
    track: "border-white/12 bg-[#12161f]",
  },
  coins: {
    iconBg: "bg-[#17140a] border-electric-yellow/55 text-electric-yellow",
    value: "text-white",
    plus: "text-white/55 hover:text-electric-yellow hover:bg-white/8",
    iconName: "paid",
    ring: "focus-visible:ring-electric-yellow/50",
    track: "border-white/12 bg-[#12161f]",
  },
  gems: {
    iconBg: "bg-[#1a0a16] border-fuchsia-400/55 text-fuchsia-400",
    value: "text-white",
    plus: "text-white/55 hover:text-fuchsia-300 hover:bg-white/8",
    iconName: "diamond",
    ring: "focus-visible:ring-fuchsia-400/50",
    track: "border-white/12 bg-[#12161f]",
  },
} as const;

/**
 * Como la referencia mobile: ícono a la izquierda solapando la barra,
 * valor adentro, + chico a la derecha — barra rectangular, no pastilla.
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

  return (
    <div className="relative shrink-0 pl-2.5">
      <div
        className={`relative flex h-6 items-center rounded-md border sm:h-7 ${t.track} ${
          compact ? "min-w-[4.25rem] pr-0.5 pl-3.5" : "min-w-[5rem] pr-0.5 pl-4 sm:min-w-[5.5rem]"
        } ${open ? "border-white/20 bg-[#181d28]" : ""}`}
      >
        {/* Ícono solapado a la izquierda — chico, no disco enorme */}
        <span
          aria-hidden
          className={`pointer-events-none absolute -left-2.5 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md border sm:h-6 sm:w-6 ${t.iconBg}`}
        >
          <span className="material-symbols-outlined text-[13px]! sm:text-[14px]!">{t.iconName}</span>
        </span>

        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={controlsId}
          onClick={onOpen}
          className={`flex min-h-6 min-w-0 flex-1 items-center justify-center px-1 font-mono text-[11px] font-semibold tabular-nums leading-none tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:min-h-7 sm:text-[12px] ${t.value} ${t.ring}`}
        >
          <span className="truncate">{value}</span>
        </button>

        <button
          type="button"
          aria-label={addLabel}
          aria-expanded={open}
          aria-controls={controlsId}
          onClick={onOpen}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition focus-visible:outline-none focus-visible:ring-2 ${t.plus} ${t.ring}`}
        >
          <span className="material-symbols-outlined text-[12px]! leading-none">add</span>
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
  const regenMinutes = Math.round(REGEN_MS_PER_POINT / 60_000);
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
      closeLabel={labels.close}
      onClose={() => setOpen(null)}
    >
      <p className="font-mono text-[15px] font-semibold tabular-nums text-sky-300">
        {energy}
        <span className="text-on-surface-variant/70"> / {energyMax}</span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-sky-400/15">
        <div
          className="h-full rounded-full bg-sky-400/80 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p>{labels.energyRegen.replace("{minutes}", String(regenMinutes))}</p>
      <p>
        {isFull
          ? labels.energyFull
          : labels.energyNext.replace("{time}", countdown ?? "--:--")}
      </p>
      {energy <= 0 && (
        <div className="space-y-2 rounded-lg border border-sky-400/25 bg-sky-500/10 p-2.5">
          <p className="font-semibold text-sky-200">
            {labels.energyEmptyTitle ?? labels.energy}
          </p>
          <p>{labels.energyEmptyBody ?? labels.energyRegen.replace("{minutes}", String(regenMinutes))}</p>
          <div className="flex flex-col gap-1.5 pt-0.5">
            <p className="text-[11px] text-sky-200/80">
              {labels.energyEmptyWait ?? labels.energyNext.replace("{time}", countdown ?? "--:--")}
            </p>
            <Link
              href="/shop"
              onClick={() => setOpen(null)}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 text-[12px] font-medium text-on-surface transition hover:bg-white/[0.08]"
            >
              <span className="material-symbols-outlined text-[16px]!">storefront</span>
              {labels.energyEmptyShop ?? labels.coinsShop}
            </Link>
            <Link
              href="/"
              onClick={() => setOpen(null)}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 text-[12px] font-medium text-on-surface transition hover:bg-white/[0.08]"
            >
              <span className="material-symbols-outlined text-[16px]!">redeem</span>
              {labels.energyEmptyRewards ?? "Rewards"}
            </Link>
            <Link
              href="/team"
              onClick={() => setOpen(null)}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 text-[12px] font-medium text-on-surface transition hover:bg-white/[0.08]"
            >
              <span className="material-symbols-outlined text-[16px]!">healing</span>
              {labels.energyEmptyTeam ?? "Team"}
            </Link>
          </div>
        </div>
      )}
    </PopoverPanel>
  );

  const coinsPopover = (
    <PopoverPanel
      id={coinsPanelId}
      title={labels.coins}
      closeLabel={labels.close}
      onClose={() => setOpen(null)}
    >
      <p className="font-mono text-[15px] font-semibold tabular-nums text-electric-yellow">
        {coins.toLocaleString()}
      </p>
      <p>{labels.coinsBalance}</p>
      <div className="flex flex-col gap-1.5 pt-1">
        <Link
          href="/market?tab=shop"
          onClick={() => setOpen(null)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 text-[12px] font-medium text-on-surface transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50"
        >
          <span className="material-symbols-outlined text-[16px]!">storefront</span>
          {labels.coinsShop}
        </Link>
        <Link
          href="/market?tab=browse"
          onClick={() => setOpen(null)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 text-[12px] font-medium text-on-surface transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50"
        >
          <span className="material-symbols-outlined text-[16px]!">store</span>
          {labels.coinsMarket}
        </Link>
      </div>
    </PopoverPanel>
  );

  const gemsPopover = (
    <PopoverPanel
      id={gemsPanelId}
      title={labels.gems}
      closeLabel={labels.close}
      onClose={() => setOpen(null)}
    >
      <p className="font-mono text-[15px] font-semibold tabular-nums text-fuchsia-400">
        {gems.toLocaleString()}
      </p>
      <p>{labels.gemsBalance}</p>
      <p>{labels.gemsHint}</p>
      <Link
        href="/pc"
        onClick={() => setOpen(null)}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 text-[12px] font-medium text-fuchsia-300 transition hover:bg-fuchsia-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/50"
      >
        <span className="material-symbols-outlined text-[16px]!">storage</span>
        {labels.gemsPc}
      </Link>
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
            <span className="material-symbols-outlined text-[14px]! text-sky-300">bolt</span>
            <span className="font-mono text-[11px] font-semibold tabular-nums text-sky-100">
              {energy}
            </span>
            <span className="mx-0.5 h-3 w-px bg-white/15" aria-hidden />
            <span className="material-symbols-outlined text-[14px]! text-electric-yellow">paid</span>
            <span className="font-mono text-[11px] font-semibold tabular-nums text-electric-yellow">
              {coins}
            </span>
            <span className="mx-0.5 h-3 w-px bg-white/15" aria-hidden />
            <span className="material-symbols-outlined text-[14px]! text-fuchsia-400">diamond</span>
            <span className="font-mono text-[11px] font-semibold tabular-nums text-fuchsia-300">
              {gems}
            </span>
          </button>
          {open === "all" && (
            <PopoverPanel
              id={allPanelId}
              title={labels.resources}
              closeLabel={labels.close}
              onClose={() => setOpen(null)}
            >
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-sky-300/80">
                    {labels.energy}
                  </p>
                  <p className="font-mono text-[14px] font-semibold text-sky-200">
                    {energy}/{energyMax}
                  </p>
                  <p className="mt-1">
                    {isFull
                      ? labels.energyFull
                      : labels.energyNext.replace("{time}", countdown ?? "--:--")}
                  </p>
                </div>
                <div className="border-t border-white/8 pt-3">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-electric-yellow/80">
                    {labels.coins}
                  </p>
                  <p className="font-mono text-[14px] font-semibold text-electric-yellow">
                    {coins.toLocaleString()}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <Link
                      href="/market?tab=shop"
                      onClick={() => setOpen(null)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-white/12 px-2 text-[11px]"
                    >
                      {labels.coinsShop}
                    </Link>
                    <Link
                      href="/market?tab=browse"
                      onClick={() => setOpen(null)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-white/12 px-2 text-[11px]"
                    >
                      {labels.coinsMarket}
                    </Link>
                  </div>
                </div>
                <div className="border-t border-white/8 pt-3">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-fuchsia-400/80">
                    {labels.gems}
                  </p>
                  <p className="font-mono text-[14px] font-semibold text-fuchsia-400">
                    {gems.toLocaleString()}
                  </p>
                  <p className="mt-1">{labels.gemsHint}</p>
                  <Link
                    href="/pc"
                    onClick={() => setOpen(null)}
                    className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 text-[11px] text-fuchsia-300"
                  >
                    {labels.gemsPc}
                  </Link>
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
