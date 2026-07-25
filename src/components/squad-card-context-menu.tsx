"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  togglePokemonFavorite,
  togglePokemonTradeLock,
} from "@/actions/pokemon-flags";
import { healPokemonWithPotion } from "@/actions/heal-pokemon-potion";
import { restorePokemonPp } from "@/actions/restore-pokemon-pp";
import { useRareCandy } from "@/actions/use-rare-candy";
import { itemSpriteUrl } from "@/lib/item-sprites";
import { playBattleSfx } from "@/lib/battle-sfx";
import {
  EMPTY_SQUAD_BAG,
  estimateHealAmount,
  type SquadBagCounts,
} from "@/lib/squad-bag";
import {
  LevelUpOffersPanel,
  type LevelUpOfferEntry,
} from "@/components/level-up-offers";

export type SquadContextLabels = {
  favoriteOn: string;
  favoriteOff: string;
  lockOn: string;
  lockOff: string;
  viewTeam: string;
  hint: string;
  heal: string;
  restorePp: string;
  rareCandy: string;
};

type MenuState = { x: number; y: number } | null;
type Feedback = { kind: "ok" | "error"; text: string } | null;
type ItemFxKind = "heal" | "pp" | "candy";
type ItemFx = { kind: ItemFxKind; label: string; key: number };

const FX_META: Record<
  ItemFxKind,
  { glow: string; ring: string; burst: string; labelClass: string }
> = {
  heal: {
    glow: "rgba(52, 211, 153, 0.5)",
    ring: "rgba(52, 211, 153, 0.55)",
    burst: "rgba(110, 231, 183, 0.35)",
    labelClass: "text-emerald-300",
  },
  pp: {
    glow: "rgba(96, 165, 250, 0.5)",
    ring: "rgba(96, 165, 250, 0.55)",
    burst: "rgba(147, 197, 253, 0.35)",
    labelClass: "text-sky-300",
  },
  candy: {
    glow: "rgba(242, 192, 0, 0.55)",
    ring: "rgba(242, 192, 0, 0.6)",
    burst: "rgba(252, 211, 77, 0.4)",
    labelClass: "text-tertiary",
  },
};

/**
 * Click derecho (o botón ⋮) sobre una card del equipo / PC: curar, PP,
 * carameloraro, favorito, bloqueo. El click izquierdo en el hijo sigue libre.
 */
export function SquadCardContextMenu({
  instanceId,
  pokemonName,
  currentHp,
  maxHp,
  level,
  isFavorite,
  isTradeLocked,
  canHeal,
  canLevelUp = true,
  showFlags = true,
  showViewTeam = true,
  labels,
  bagCounts = EMPTY_SQUAD_BAG,
  onBagChange,
  onHealed,
  onLeveledUp,
  onPpRestored,
  children,
}: {
  instanceId: string;
  pokemonName?: string;
  currentHp?: number;
  maxHp?: number;
  level?: number;
  isFavorite: boolean;
  isTradeLocked: boolean;
  canHeal: boolean;
  canLevelUp?: boolean;
  showFlags?: boolean;
  showViewTeam?: boolean;
  labels: SquadContextLabels;
  bagCounts?: SquadBagCounts;
  onBagChange?: (next: SquadBagCounts) => void;
  onHealed?: (next: { currentHp: number; maxHp: number }) => void;
  onLeveledUp?: (next: { level: number; currentHp: number; maxHp: number }) => void;
  onPpRestored?: (next: {
    moveName: string;
    restoredBy: number;
    allMoves: boolean;
  }) => void;
  children: ReactNode;
}) {
  const locale = useLocale();
  const tMenu = useTranslations("home.squadMenu");
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [levelOffers, setLevelOffers] = useState<LevelUpOfferEntry[] | null>(null);
  const [fx, setFx] = useState<ItemFx | null>(null);
  const [toast, setToast] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const counts = bagCounts;

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    const onPointer = (e: MouseEvent | PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (rootRef.current?.contains(e.target as Node) && (e as MouseEvent).button === 2) return;
      setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [menu]);

  useEffect(() => {
    if (!fx) return;
    const t = window.setTimeout(() => setFx(null), 2100);
    return () => window.clearTimeout(t);
  }, [fx]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  function bump(key: "heal" | "leppa" | "rareCandy") {
    const next = { ...counts, [key]: Math.max(0, counts[key] - 1) };
    onBagChange?.(next);
  }

  function playItemFx(kind: ItemFxKind, label: string) {
    setFx({ kind, label, key: Date.now() });
    if (kind === "heal") playBattleSfx("heal");
    else if (kind === "pp") playBattleSfx("restorePp");
    else playBattleSfx("levelUp");
  }

  function openAt(clientX: number, clientY: number) {
    const pad = 8;
    const mw = 240;
    const mh = 320;
    const x = Math.min(clientX, window.innerWidth - mw - pad);
    const y = Math.min(clientY, window.innerHeight - mh - pad);
    setFeedback(null);
    setMenu({ x: Math.max(pad, x), y: Math.max(pad, y) });
  }

  function run(action: () => Promise<unknown>) {
    if (busy) return;
    setFeedback(null);
    setMenu(null);
    setBusy(true);
    void action()
      .finally(() => setBusy(false))
      .then(() => {
        window.setTimeout(() => router.refresh(), 600);
      });
  }

  function heal() {
    if (busy) return;
    setFeedback(null);
    if (!canHeal) {
      setFeedback({ kind: "error", text: tMenu("fullHp") });
      return;
    }
    if (counts.heal <= 0) {
      setFeedback({ kind: "error", text: tMenu("noPotions") });
      return;
    }

    const bagBefore = counts;
    const hpBefore = currentHp;
    const maxBefore = maxHp;
    const estimate =
      hpBefore != null && maxBefore != null
        ? Math.min(
            maxBefore - hpBefore,
            estimateHealAmount(counts.healItemName),
          )
        : 0;

    setMenu(null);
    setBusy(true);
    bump("heal");
    if (hpBefore != null && maxBefore != null && estimate > 0) {
      onHealed?.({ currentHp: hpBefore + estimate, maxHp: maxBefore });
    }
    playItemFx("heal", estimate > 0 ? `+${estimate} HP` : "+HP");

    void healPokemonWithPotion(instanceId, locale)
      .then((result) => {
        if (!result.ok) {
          onBagChange?.(bagBefore);
          if (hpBefore != null && maxBefore != null) {
            onHealed?.({ currentHp: hpBefore, maxHp: maxBefore });
          }
          setFx(null);
          setToast({
            kind: "error",
            text: result.error === "full_hp" ? tMenu("fullHp") : tMenu("noPotions"),
          });
          return;
        }
        onHealed?.({ currentHp: result.currentHp, maxHp: result.maxHp });
      })
      .finally(() => setBusy(false));
  }

  function restorePp() {
    if (busy) return;
    setFeedback(null);
    if (counts.leppa <= 0) {
      setFeedback({ kind: "error", text: tMenu("noLeppa") });
      return;
    }

    const bagBefore = counts;
    setMenu(null);
    setBusy(true);
    bump("leppa");
    playItemFx("pp", "+PP");

    void restorePokemonPp(instanceId, locale)
      .then((result) => {
        if (!result.ok) {
          onBagChange?.(bagBefore);
          setFx(null);
          const text =
            result.error === "full_pp"
              ? tMenu("fullPp")
              : result.error === "no_leppa"
                ? tMenu("noLeppa")
                : result.error === "no_moves"
                  ? tMenu("noMoves")
                  : tMenu("noLeppa");
          setToast({ kind: "error", text });
          return;
        }
        onPpRestored?.({
          moveName: result.moveName,
          restoredBy: result.restoredBy,
          allMoves: result.allMoves,
        });
      })
      .finally(() => setBusy(false));
  }

  function giveRareCandy() {
    if (busy) return;
    setFeedback(null);
    if (!canLevelUp) {
      setFeedback({ kind: "error", text: tMenu("maxLevel") });
      return;
    }
    if (counts.rareCandy <= 0) {
      setFeedback({ kind: "error", text: tMenu("noCandy") });
      return;
    }

    const bagBefore = counts;
    const levelBefore = level;
    const hpBefore = currentHp;
    const maxBefore = maxHp;
    const optimisticLevel = levelBefore != null ? levelBefore + 1 : null;

    setMenu(null);
    setBusy(true);
    bump("rareCandy");
    if (optimisticLevel != null && hpBefore != null && maxBefore != null) {
      onLeveledUp?.({
        level: optimisticLevel,
        currentHp: hpBefore,
        maxHp: maxBefore,
      });
    }
    playItemFx("candy", optimisticLevel != null ? `Lv. ${optimisticLevel}` : "+1 Lv");

    void useRareCandy(instanceId, locale)
      .then((result) => {
        if (!result.ok) {
          onBagChange?.(bagBefore);
          if (levelBefore != null && hpBefore != null && maxBefore != null) {
            onLeveledUp?.({
              level: levelBefore,
              currentHp: hpBefore,
              maxHp: maxBefore,
            });
          }
          setFx(null);
          setToast({
            kind: "error",
            text: result.error === "max_level" ? tMenu("maxLevel") : tMenu("noCandy"),
          });
          return;
        }
        onLeveledUp?.({
          level: result.newLevel,
          currentHp: result.currentHp,
          maxHp: result.maxHp,
        });
        const hasOffers =
          result.autoTaught.length > 0 ||
          result.pendingMoves.length > 0 ||
          result.evolveOffer != null;
        if (hasOffers) {
          setLevelOffers([
            {
              instanceId,
              name: result.pokemonName || pokemonName || "Pokémon",
              leveledUpTo: result.newLevel,
              fromSpriteUrl: result.fromSpriteUrl,
              autoTaught: result.autoTaught,
              pendingMoves: result.pendingMoves,
              evolveOffer: result.evolveOffer,
              knownMoves: result.knownMoves,
            },
          ]);
        }
      })
      .finally(() => setBusy(false));
  }

  const fxMeta = fx ? FX_META[fx.kind] : null;

  return (
    <div
      ref={rootRef}
      className={`group relative ${fx ? "squad-fx-pulse" : ""}`}
      style={
        fxMeta
          ? ({ "--squad-fx-glow": fxMeta.glow } as CSSProperties)
          : undefined
      }
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openAt(e.clientX, e.clientY);
      }}
    >
      {children}

      {fx && fxMeta ? (
        <SquadItemFx key={fx.key} kind={fx.kind} label={fx.label} meta={fxMeta} />
      ) : null}

      {toast ? (
        <p
          className={[
            "pointer-events-none absolute bottom-2 left-1/2 z-40 max-w-[90%] -translate-x-1/2 rounded-md px-2 py-1 text-center text-[10px] leading-snug shadow-lg",
            toast.kind === "error"
              ? "bg-error/90 text-white"
              : "bg-emerald-600/90 text-white",
          ].join(" ")}
          role="status"
        >
          {toast.text}
        </p>
      ) : null}

      <button
        type="button"
        aria-label={labels.hint}
        title={labels.hint}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
          openAt(rect.left, rect.bottom + 4);
        }}
        className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black/45 text-on-surface-variant opacity-0 backdrop-blur-sm transition hover:border-white/25 hover:text-white group-hover:opacity-100 focus:opacity-100"
      >
        <span className="material-symbols-outlined text-[16px]!">more_vert</span>
      </button>

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 min-w-[220px] overflow-hidden rounded-lg border border-white/12 bg-[#12161f]/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
          style={{ left: menu.x, top: menu.y }}
        >
          <ConsumableMenuItem
            itemName={counts.healItemName}
            label={labels.heal}
            count={counts.heal}
            disabled={busy}
            onSelect={heal}
          />
          <ConsumableMenuItem
            itemName={counts.ppItemName}
            label={labels.restorePp}
            count={counts.leppa}
            disabled={busy}
            onSelect={restorePp}
          />
          <ConsumableMenuItem
            itemName="Rare Candy"
            label={labels.rareCandy}
            count={counts.rareCandy}
            disabled={busy}
            onSelect={giveRareCandy}
          />
          {showFlags ? (
            <>
              <MenuItem
                icon={isFavorite ? "star" : "star_outline"}
                label={isFavorite ? labels.favoriteOff : labels.favoriteOn}
                disabled={busy}
                onSelect={() => run(() => togglePokemonFavorite(instanceId, locale))}
              />
              <MenuItem
                icon={isTradeLocked ? "lock_open" : "lock"}
                label={isTradeLocked ? labels.lockOff : labels.lockOn}
                disabled={busy}
                onSelect={() => run(() => togglePokemonTradeLock(instanceId, locale))}
              />
            </>
          ) : null}
          {showViewTeam ? (
            <>
              <div className="my-1 border-t border-white/8" />
              <Link
                href="/team"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-on-surface transition hover:bg-white/8"
                onClick={() => setMenu(null)}
              >
                <span className="material-symbols-outlined text-[18px]! text-on-surface-variant">
                  groups
                </span>
                {labels.viewTeam}
              </Link>
            </>
          ) : null}
          {feedback ? (
            <p
              className={[
                "mx-2 mb-1 mt-1 rounded-md px-2 py-1.5 text-[11px] leading-snug",
                feedback.kind === "error"
                  ? "bg-error/15 text-error"
                  : "bg-emerald-500/15 text-emerald-300",
              ].join(" ")}
              role="status"
            >
              {feedback.text}
            </p>
          ) : null}
        </div>
      )}
      {levelOffers && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-4 backdrop-blur-md sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-tertiary/25 bg-[#0a0e16]/96 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <LevelUpOffersPanel
              key={levelOffers
                .map((e) => `${e.instanceId}:${e.leveledUpTo}:${e.evolveOffer?.toSpeciesId ?? 0}`)
                .join("|")}
              entries={levelOffers}
              onSettled={() => {
                setLevelOffers(null);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SquadItemFx({
  kind,
  label,
  meta,
}: {
  kind: ItemFxKind;
  label: string;
  meta: (typeof FX_META)[ItemFxKind];
}) {
  const sparks = [
    { x: "-18%", y: "8%", sx: "-14px", sy: "-22px", d: "0ms" },
    { x: "22%", y: "0%", sx: "16px", sy: "-26px", d: "60ms" },
    { x: "-8%", y: "28%", sx: "-10px", sy: "-18px", d: "120ms" },
    { x: "14%", y: "24%", sx: "12px", sy: "-20px", d: "90ms" },
    { x: "0%", y: "-6%", sx: "4px", sy: "-30px", d: "30ms" },
    { x: "-24%", y: "18%", sx: "-18px", sy: "-16px", d: "150ms" },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden>
      <span
        className="squad-fx-burst absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
        style={{ background: meta.burst }}
      />
      <span
        className="squad-fx-ring absolute left-1/2 top-[42%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{ borderColor: meta.ring }}
      />
      {sparks.map((s, i) => (
        <span
          key={`${kind}-${i}`}
          className="squad-fx-spark absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
          style={
            {
              marginLeft: s.x,
              marginTop: s.y,
              background: meta.ring,
              animationDelay: s.d,
              "--sx": s.sx,
              "--sy": s.sy,
            } as CSSProperties
          }
        />
      ))}
      <span
        className={`squad-fx-float-label absolute left-1/2 top-[38%] -translate-x-1/2 rounded-md border border-white/15 bg-black/55 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide shadow-lg backdrop-blur-sm ${meta.labelClass}`}
      >
        {label}
      </span>
    </div>
  );
}

function ConsumableMenuItem({
  itemName,
  label,
  count,
  disabled,
  onSelect,
}: {
  itemName: string;
  label: string;
  count: number;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-on-surface transition hover:bg-white/8 disabled:opacity-50"
    >
      <Image
        src={itemSpriteUrl(itemName)}
        alt=""
        width={20}
        height={20}
        unoptimized
        className="h-5 w-5 shrink-0 object-contain [image-rendering:pixelated]"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={[
          "shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
          count > 0
            ? "bg-white/8 text-on-surface-variant"
            : "bg-error/15 text-error/80",
        ].join(" ")}
      >
        ×{count}
      </span>
    </button>
  );
}

function MenuItem({
  icon,
  label,
  disabled,
  onSelect,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-on-surface transition hover:bg-white/8 disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-[18px]! text-on-surface-variant">{icon}</span>
      {label}
    </button>
  );
}
