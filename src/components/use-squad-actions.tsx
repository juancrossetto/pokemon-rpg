"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  togglePokemonFavorite,
  togglePokemonTradeLock,
} from "@/actions/pokemon-flags";
import { healPokemonWithPotion } from "@/actions/heal-pokemon-potion";
import { restorePokemonPp } from "@/actions/restore-pokemon-pp";
import { revivePokemon } from "@/actions/revive-pokemon";
import { useRareCandy as consumeRareCandy } from "@/actions/use-rare-candy";
import { playBattleSfx } from "@/lib/battle-sfx";
import {
  EMPTY_SQUAD_BAG,
  estimateHealAmount,
  reviveHpFraction,
  type SquadBagCounts,
} from "@/lib/squad-bag";
import {
  LevelUpOffersPanel,
  type LevelUpOfferEntry,
} from "@/components/level-up-offers";

export type SquadFeedback = { kind: "ok" | "error"; text: string } | null;
export type SquadItemFxKind = "heal" | "pp" | "candy" | "machine";
export type SquadItemFxState = { kind: SquadItemFxKind; label: string; key: number };

export const SQUAD_FX_META: Record<
  SquadItemFxKind,
  { glow: string; ring: string; burst: string; labelClass: string }
> = {
  heal: {
    glow: "color-mix(in srgb, var(--color-pokeball-red) 55%, transparent)",
    ring: "color-mix(in srgb, var(--color-pokeball-red) 70%, transparent)",
    burst: "rgba(248, 113, 113, 0.4)",
    labelClass: "text-pokeball-red",
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
  /*
    Sólo el fallback: al enseñar una MT el color sale del tipo del movimiento,
    así que el drawer arma su propio `meta` y se lo pasa a `SquadItemFx`. Un
    Lanzallamas y un Rayo tienen que verse distinto —es la única pista de qué
    se acaba de aprender— y un color fijo desperdiciaría eso.
  */
  machine: {
    glow: "rgba(167, 139, 250, 0.5)",
    ring: "rgba(167, 139, 250, 0.55)",
    burst: "rgba(196, 181, 253, 0.35)",
    labelClass: "text-violet-300",
  },
};

/** Paleta de FX derivada del color de un tipo, para la animación de MT/MO. */
export function fxMetaFromColor(color: string): (typeof SQUAD_FX_META)[SquadItemFxKind] {
  return {
    glow: `${color}88`,
    ring: `${color}cc`,
    burst: `${color}59`,
    labelClass: "text-white",
  };
}

export type SquadActionsOptions = {
  instanceId: string;
  pokemonName?: string;
  currentHp?: number;
  maxHp?: number;
  level?: number;
  isFavorite?: boolean;
  isTradeLocked?: boolean;
  canHeal: boolean;
  /** Debilitado (`currentHp <= 0`): puede usar Revive / Max Revive. */
  canRevive?: boolean;
  canLevelUp?: boolean;
  bagCounts?: SquadBagCounts;
  /**
   * Si true, no dispara `router.refresh()` solo: el padre ya pinta optimista
   * y refresca cuando le conviene (p. ej. al cerrar el drawer).
   */
  deferServerRefresh?: boolean;
  /** Se dispara al iniciar cualquier acción (p. ej. para cerrar el menú). */
  onBeforeAction?: () => void;
  onBagChange?: (next: SquadBagCounts) => void;
  onHealed?: (next: { currentHp: number; maxHp: number }) => void;
  onLeveledUp?: (next: { level: number; currentHp: number; maxHp: number }) => void;
  onPpRestored?: (next: { moveName: string; restoredBy: number; allMoves: boolean }) => void;
  onFlagsChange?: (next: { isFavorite?: boolean; isTradeLocked?: boolean }) => void;
};

/**
 * Acciones de cuidado de un Pokémon (poción/baya, PP, carameloraro, favorito,
 * bloqueo de venta) con UI optimista, FX y rollback. Compartidas por el menú
 * contextual de las cards y por la ficha de detalle.
 */
export function useSquadActions({
  instanceId,
  pokemonName,
  currentHp,
  maxHp,
  level,
  isFavorite = false,
  isTradeLocked = false,
  canHeal,
  canRevive = false,
  canLevelUp = true,
  bagCounts = EMPTY_SQUAD_BAG,
  deferServerRefresh = false,
  onBeforeAction,
  onBagChange,
  onHealed,
  onLeveledUp,
  onPpRestored,
  onFlagsChange,
}: SquadActionsOptions) {
  const locale = useLocale();
  const tMenu = useTranslations("home.squadMenu");
  const router = useRouter();
  const [feedback, setFeedback] = useState<SquadFeedback>(null);
  const [toast, setToast] = useState<SquadFeedback>(null);
  const [fx, setFx] = useState<SquadItemFxState | null>(null);
  const [levelOffers, setLevelOffers] = useState<LevelUpOfferEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  /** Lock corto anti doble-tap del caramelo (no espera al server). */
  const [candyPending, setCandyPending] = useState(false);
  const counts = bagCounts;
  /** Nivel optimista local para encadenar carameloraros sin esperar al server. */
  const levelRef = useRef(level);
  /** Mochila optimista: clicks seguidos no deben leer `counts` stale del render. */
  const bagRef = useRef(bagCounts);
  /** Cola serial del server action — evita carreras de nivel en paralelo. */
  const candyChainRef = useRef(Promise.resolve());
  const levelOffersRef = useRef<LevelUpOfferEntry[] | null>(null);
  const inFlightRef = useRef(0);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    bagRef.current = bagCounts;
  }, [bagCounts]);

  useEffect(() => {
    levelOffersRef.current = levelOffers;
  }, [levelOffers]);

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

  function bump(key: "heal" | "leppa" | "rareCandy" | "revive") {
    const next = { ...counts, [key]: Math.max(0, counts[key] - 1) };
    onBagChange?.(next);
  }

  function playItemFx(kind: SquadItemFxKind, label: string) {
    setFx({ kind, label, key: Date.now() });
    if (kind === "heal") playBattleSfx("heal");
    else if (kind === "pp") playBattleSfx("restorePp");
    else playBattleSfx("levelUp");
  }

  function softRefresh() {
    if (deferServerRefresh) return;
    router.refresh();
  }

  /** Lock corto anti doble-click para curar / PP / flags (sin modal de ofertas). */
  function pulseBusy() {
    inFlightRef.current += 1;
    setBusy(true);
    window.setTimeout(() => {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      if (inFlightRef.current === 0) setBusy(false);
    }, 320);
  }

  function toggleFavorite() {
    if (busy || levelOffers) return;
    setFeedback(null);
    onBeforeAction?.();
    const prev = isFavorite;
    const next = !prev;
    onFlagsChange?.({ isFavorite: next });
    pulseBusy();
    void togglePokemonFavorite(instanceId, locale).then((result) => {
      if (!result.ok) {
        onFlagsChange?.({ isFavorite: prev });
        setToast({ kind: "error", text: tMenu("actionFailed") });
        return;
      }
      onFlagsChange?.({ isFavorite: result.isFavorite });
      // Sin router.refresh(): el flag ya es optimista en la UI (estrella +
      // acento del banner en home). revalidatePath en la action calienta el
      // cache para la próxima navegación; refrescar el home entero acá
      // dejaba el color del banner colgado varios segundos.
    });
  }

  function toggleTradeLock() {
    if (busy || levelOffers) return;
    setFeedback(null);
    onBeforeAction?.();
    const prev = isTradeLocked;
    const next = !prev;
    onFlagsChange?.({ isTradeLocked: next });
    pulseBusy();
    void togglePokemonTradeLock(instanceId, locale).then((result) => {
      if (!result.ok) {
        onFlagsChange?.({ isTradeLocked: prev });
        setToast({ kind: "error", text: tMenu("actionFailed") });
        return;
      }
      onFlagsChange?.({ isTradeLocked: result.isTradeLocked });
      softRefresh();
    });
  }

  function heal() {
    if (busy || levelOffers) return;
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
        ? Math.min(maxBefore - hpBefore, estimateHealAmount(counts.healItemName))
        : 0;

    onBeforeAction?.();
    pulseBusy();
    bump("heal");
    if (hpBefore != null && maxBefore != null && estimate > 0) {
      onHealed?.({ currentHp: hpBefore + estimate, maxHp: maxBefore });
    }
    playItemFx("heal", estimate > 0 ? `+${estimate} HP` : "+HP");

    void healPokemonWithPotion(instanceId, locale).then((result) => {
      if (!result.ok) {
        onBagChange?.(bagBefore);
        if (hpBefore != null && maxBefore != null) {
          onHealed?.({ currentHp: hpBefore, maxHp: maxBefore });
        }
        setFx(null);
        setToast({
          kind: "error",
          text:
            result.error === "full_hp"
              ? tMenu("fullHp")
              : result.error === "needs_revive"
                ? tMenu("needsRevive")
                : tMenu("noPotions"),
        });
        return;
      }
      onHealed?.({ currentHp: result.currentHp, maxHp: result.maxHp });
    });
  }

  function revive() {
    if (busy || levelOffers) return;
    setFeedback(null);
    if (!canRevive) {
      setFeedback({ kind: "error", text: tMenu("notFainted") });
      return;
    }
    if (counts.revive <= 0) {
      setFeedback({ kind: "error", text: tMenu("noRevives") });
      return;
    }

    const bagBefore = counts;
    const hpBefore = currentHp;
    const maxBefore = maxHp;
    const estimate =
      maxBefore != null
        ? Math.max(
            1,
            Math.floor(maxBefore * (reviveHpFraction(counts.reviveItemName) ?? 0.5)),
          )
        : 0;

    onBeforeAction?.();
    pulseBusy();
    bump("revive");
    if (maxBefore != null && estimate > 0) {
      onHealed?.({ currentHp: estimate, maxHp: maxBefore });
    }
    playItemFx("heal", estimate > 0 ? `+${estimate} HP` : tMenu("revive"));

    void revivePokemon(instanceId, locale).then((result) => {
      if (!result.ok) {
        onBagChange?.(bagBefore);
        if (hpBefore != null && maxBefore != null) {
          onHealed?.({ currentHp: hpBefore, maxHp: maxBefore });
        }
        setFx(null);
        setToast({
          kind: "error",
          text:
            result.error === "not_fainted"
              ? tMenu("notFainted")
              : tMenu("noRevives"),
        });
        return;
      }
      onHealed?.({ currentHp: result.currentHp, maxHp: result.maxHp });
    });
  }

  function restorePp() {
    if (busy || levelOffers) return;
    setFeedback(null);
    if (counts.leppa <= 0) {
      setFeedback({ kind: "error", text: tMenu("noLeppa") });
      return;
    }

    const bagBefore = counts;
    onBeforeAction?.();
    pulseBusy();
    bump("leppa");
    playItemFx("pp", "+PP");

    void restorePokemonPp(instanceId, locale).then((result) => {
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
    });
  }

  /**
   * Carameloraro optimista: la UI sube al toque. El server va en cola serial
   * (sin carreras de nivel). El ítem del menú sólo se bloquea ~280ms anti
   * doble-tap — no espera el round-trip de segundos.
   */
  function giveRareCandy() {
    if (levelOffersRef.current || candyPending) return;
    setFeedback(null);
    const levelBefore = levelRef.current ?? level;
    if (levelBefore != null && levelBefore >= 100) {
      setFeedback({ kind: "error", text: tMenu("maxLevel") });
      return;
    }
    if (!canLevelUp && (levelBefore == null || levelBefore >= 100)) {
      setFeedback({ kind: "error", text: tMenu("maxLevel") });
      return;
    }
    const bagSnapshot = bagRef.current;
    if (bagSnapshot.rareCandy <= 0) {
      setFeedback({ kind: "error", text: tMenu("noCandy") });
      return;
    }

    const hpBefore = currentHp;
    const maxBefore = maxHp;
    const optimisticLevel = levelBefore != null ? levelBefore + 1 : null;

    setCandyPending(true);
    window.setTimeout(() => setCandyPending(false), 280);

    const nextBag = {
      ...bagSnapshot,
      rareCandy: Math.max(0, bagSnapshot.rareCandy - 1),
    };
    bagRef.current = nextBag;
    onBagChange?.(nextBag);

    if (optimisticLevel != null) {
      levelRef.current = optimisticLevel;
      if (hpBefore != null && maxBefore != null) {
        onLeveledUp?.({ level: optimisticLevel, currentHp: hpBefore, maxHp: maxBefore });
      }
    }
    playItemFx("candy", optimisticLevel != null ? `Lv. ${optimisticLevel}` : "+1 Lv");

    candyChainRef.current = candyChainRef.current
      .then(async () => {
        const result = await consumeRareCandy(instanceId, locale);
        if (!result.ok) {
          const restored = {
            ...bagRef.current,
            rareCandy: bagRef.current.rareCandy + 1,
          };
          bagRef.current = restored;
          onBagChange?.(restored);
          softRefresh();
          setFx(null);
          setToast({
            kind: "error",
            text: result.error === "max_level" ? tMenu("maxLevel") : tMenu("noCandy"),
          });
          return;
        }

        const syncedLevel = Math.max(levelRef.current ?? 0, result.newLevel);
        levelRef.current = syncedLevel;
        onLeveledUp?.({
          level: syncedLevel,
          currentHp: result.currentHp,
          maxHp: result.maxHp,
        });

        const hasOffers =
          result.autoTaught.length > 0 ||
          result.pendingMoves.length > 0 ||
          result.evolveOffer != null;
        if (!hasOffers) return;

        const entry: LevelUpOfferEntry = {
          instanceId,
          name: result.pokemonName || pokemonName || "Pokémon",
          leveledUpTo: result.newLevel,
          fromSpriteUrl: result.fromSpriteUrl,
          isShiny: result.isShiny,
          autoTaught: result.autoTaught,
          pendingMoves: result.pendingMoves,
          evolveOffer: result.evolveOffer,
          knownMoves: result.knownMoves,
        };

        const prev = levelOffersRef.current;
        let next: LevelUpOfferEntry[];
        if (!prev) {
          next = [entry];
        } else {
          const existing = prev.find((e) => e.instanceId === instanceId);
          if (!existing) {
            next = [...prev, entry];
          } else {
            next = prev.map((e) =>
              e.instanceId !== instanceId
                ? e
                : {
                    ...e,
                    leveledUpTo: entry.leveledUpTo,
                    fromSpriteUrl: entry.fromSpriteUrl,
                    isShiny: entry.isShiny,
                    autoTaught: [...e.autoTaught, ...entry.autoTaught],
                    pendingMoves: [...e.pendingMoves, ...entry.pendingMoves],
                    evolveOffer: entry.evolveOffer ?? e.evolveOffer,
                    knownMoves: entry.knownMoves,
                  },
            );
          }
        }
        levelOffersRef.current = next;
        setLevelOffers(next);
      })
      .catch(() => {
        softRefresh();
      });
  }

  return {
    counts,
    busy,
    candyPending,
    feedback,
    toast,
    fx,
    fxMeta: fx ? SQUAD_FX_META[fx.kind] : null,
    levelOffers,
    heal,
    revive,
    restorePp,
    giveRareCandy,
    toggleFavorite,
    toggleTradeLock,
    clearFeedback: () => setFeedback(null),
    dismissLevelOffers: () => {
      levelOffersRef.current = null;
      setLevelOffers(null);
      setCandyPending(false);
      setBusy(false);
      // Diferir el refresh: si corre síncrono, el click de "Continuar" puede
      // caer sobre el menú recién liberado o remontar y cerrarlo.
      window.setTimeout(() => softRefresh(), 0);
    },
  };
}

export type SquadActionsApi = ReturnType<typeof useSquadActions>;

/** Estallido de partículas + label flotante sobre el contenedor relativo padre. */
export function SquadItemFx({
  kind,
  label,
  meta,
}: {
  kind: SquadItemFxKind;
  label: string;
  meta: (typeof SQUAD_FX_META)[SquadItemFxKind];
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
      {kind === "heal" ? (
        <span className="squad-fx-heal-cross absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2">
          <span
            className="material-symbols-outlined text-[36px]! drop-shadow-[0_0_14px_rgba(238,21,21,0.9)]"
            style={{ color: meta.ring }}
          >
            cardiology
          </span>
        </span>
      ) : null}
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

/** Modal de ofertas (movimientos nuevos / evolución) tras subir de nivel. */
export function SquadLevelOffers({
  entries,
  onSettled,
}: {
  entries: LevelUpOfferEntry[];
  onSettled: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 px-4 pt-4 pb-[calc(var(--bottom-nav-h,5.25rem)+env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur-md sm:items-center sm:p-4 xl:pb-4">
      <div className="max-h-[min(72dvh,36rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-tertiary/25 bg-[#0a0e16]/96 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        <LevelUpOffersPanel
          key={entries
            .map((e) => `${e.instanceId}:${e.leveledUpTo}:${e.evolveOffer?.toSpeciesId ?? 0}`)
            .join("|")}
          entries={entries}
          onSettled={onSettled}
        />
      </div>
    </div>,
    document.body,
  );
}
