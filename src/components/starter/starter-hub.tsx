"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { chooseStarter } from "@/actions/choose-starter";
import { PokeSparks } from "@/components/poke-sparks";
import { itemHdIconUrl } from "@/lib/item-hd-icons";
import { hasSeen, markSeen } from "@/lib/journey-ux";
import { typeColor } from "@/lib/type-colors";
import { formatMoveName } from "@/lib/format-move-name";

export type StarterSpeciesCard = {
  id: number;
  name: string;
  spriteUrl: string | null;
  types: string[];
};

type ResourceStep = "energy" | "coins" | "gems";

const STEPS: ResourceStep[] = ["energy", "coins", "gems"];

const STEP_ICON: Record<ResourceStep, string> = {
  energy: itemHdIconUrl("Energy") ?? "/items/hd/energy.png",
  coins: itemHdIconUrl("Gold Coin") ?? "/items/hd/gold-coin.png",
  gems: itemHdIconUrl("Gem") ?? "/items/hd/gem.png",
};

type Hole = { top: number; left: number; width: number; height: number };

function measureTarget(step: ResourceStep): Hole | null {
  const nodes = document.querySelectorAll(`[data-loot-target="${step}"]`);
  let visible: Element | null = null;
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      visible = node;
      break;
    }
  }
  if (!visible) return null;
  const rect = visible.getBoundingClientRect();
  const padX = 10;
  const padY = 8;
  return {
    top: Math.max(4, rect.top - padY),
    left: Math.max(4, rect.left - padX),
    width: rect.width + padX * 2,
    height: rect.height + padY * 2,
  };
}

function ResourceSpotlight({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const t = useTranslations("starter.tutorial");
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);
  const [ready, setReady] = useState(false);
  const step = STEPS[stepIndex];

  const syncHole = useCallback(() => {
    setHole(measureTarget(STEPS[stepIndex]));
  }, [stepIndex]);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => {
      syncHole();
      setReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [syncHole]);

  useEffect(() => {
    function onResize() {
      syncHole();
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [syncHole]);

  function advance() {
    if (stepIndex >= STEPS.length - 1) {
      markSeen("starter-resources");
      onComplete();
      return;
    }
    setStepIndex((i) => i + 1);
  }

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 344;
  const tipWidth = Math.min(viewportWidth * 0.94, 384);
  const tipStyle: CSSProperties | undefined = hole
    ? {
        top: Math.min(
          hole.top + hole.height + 14,
          typeof window !== "undefined" ? window.innerHeight - 200 : hole.top + hole.height + 14,
        ),
        left: Math.min(
          Math.max(8, hole.left + hole.width / 2 - tipWidth / 2),
          viewportWidth - tipWidth - 8,
        ),
      }
    : {
        top: "30%",
        left: "50%",
        transform: "translateX(-50%)",
      };

  if (!ready) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="starter-tutorial-title"
      className="fixed inset-0 z-95"
    >
      {/* Bloquea clics al header/página; el agujero es solo visual. */}
      <div className="absolute inset-0" aria-hidden />

      {hole ? (
        <div
          aria-hidden
          className="starter-spotlight-hole pointer-events-none absolute rounded-xl ring-2 ring-white/85"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.72)",
            background: "transparent",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/72" aria-hidden />
      )}

      <div
        className="absolute z-10 flex w-[min(94vw,24rem)] items-center justify-center"
        style={tipStyle}
      >
        <Image
          src="/avatars/oak2.png"
          alt=""
          width={336}
          height={798}
          className="pointer-events-none relative z-20 h-28 w-auto max-w-[20%] shrink-0 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.55)] sm:h-36 sm:max-w-none"
          unoptimized
        />

        <div className="relative z-10 -ml-5 min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/12 bg-[#0c0e14]/96 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:-ml-6">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Image
                src={STEP_ICON[step]}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
                unoptimized
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-pokeball-red">
                {t("eyebrow", { step: stepIndex + 1, total: STEPS.length })}
              </p>
              <h2
                id="starter-tutorial-title"
                className="page-title mt-1 text-[1.05rem] leading-none text-white"
              >
                {t(`${step}.title`)}
              </h2>
              <p className="mt-1.5 text-[13px] leading-snug text-white/60">
                {t(`${step}.body`)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex flex-1 gap-1.5" aria-hidden>
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={`h-1 flex-1 rounded-full ${
                    i <= stepIndex ? "bg-pokeball-red" : "bg-white/15"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={advance}
              className="game-cta game-cta--red w-auto! min-h-0! shrink-0 px-4 py-2 text-[12px]"
            >
              <span className="game-cta__label">
                {stepIndex >= STEPS.length - 1 ? t("finish") : t("next")}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StarterCard({
  species,
  chooseLabel,
  index,
  selectedId,
  disabled,
  onPick,
}: {
  species: StarterSpeciesCard;
  chooseLabel: string;
  index: number;
  selectedId: number | null;
  disabled: boolean;
  onPick: (species: StarterSpeciesCard) => void;
}) {
  const accent = typeColor(species.types[0] ?? "normal");
  const isSelected = selectedId === species.id;
  const isDimmed = selectedId != null && !isSelected;
  const displayName = formatMoveName(species.name);

  return (
    <div
      className={`starter-card-enter min-w-0 h-full transition-all duration-500 ${
        isDimmed ? "pointer-events-none scale-95 opacity-0 sm:opacity-20" : ""
      } ${isSelected ? "pointer-events-none opacity-0" : ""}`}
      style={{ animationDelay: `${80 + index * 110}ms` }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={`${chooseLabel} ${displayName}`}
        onClick={() => onPick(species)}
        className="starter-card group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14]/92 text-left shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pokeball-red/60 disabled:cursor-wait"
        style={
          {
            "--starter-accent": accent,
          } as CSSProperties
        }
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--starter-accent)/60 to-transparent"
        />
        <div aria-hidden className="starter-card__glow pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full blur-3xl" />
        <div aria-hidden className="starter-card__sheen pointer-events-none absolute inset-0" />
        <PokeSparks seed={`starter-${species.id}`} accent={accent} />

        <div className="relative z-10 flex flex-1 flex-col items-center px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
          <div className="relative flex h-24 w-full items-center justify-center sm:h-28 md:h-32">
            <div aria-hidden className="starter-card__pad absolute inset-x-8 bottom-1 h-9 rounded-[100%] sm:h-11" />
            <div aria-hidden className="starter-card__ring absolute left-1/2 top-[42%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-20 sm:w-20" />
            {species.spriteUrl ? (
              <Image
                src={species.spriteUrl}
                alt=""
                width={160}
                height={160}
                className="starter-card__sprite relative z-10 h-22 w-22 object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.55)] sm:h-28 sm:w-28 md:h-32 md:w-32"
                unoptimized
              />
            ) : null}
          </div>

          <p className="mt-0.5 text-center text-[13px] font-semibold tracking-wide text-white/90 sm:mt-1 sm:text-[15px]">
            {displayName}
          </p>

          <div className="mt-1.5 flex max-w-full flex-nowrap items-center justify-center gap-1 overflow-hidden sm:mt-2">
            {species.types.map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="starter-card__type shrink-0 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:px-2 sm:text-[10px]"
                  style={{
                    backgroundColor: `${color}33`,
                    color,
                    borderColor: `${color}55`,
                  }}
                >
                  {type}
                </span>
              );
            })}
          </div>
        </div>
      </button>
    </div>
  );
}

function StarterReveal({
  species,
  title,
  subtitle,
}: {
  species: StarterSpeciesCard;
  title: string;
  subtitle: string;
}) {
  const accent = typeColor(species.types[0] ?? "normal");

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="starter-reveal-title"
      className="starter-reveal fixed inset-0 z-96 flex items-center justify-center px-4"
      style={{ "--starter-accent": accent } as CSSProperties}
    >
      <div aria-hidden className="starter-reveal__backdrop absolute inset-0" />
      <div aria-hidden className="starter-reveal__burst" />
      <div aria-hidden className="starter-reveal__ring" />

      <div className="starter-reveal__stage relative z-10 flex flex-col items-center text-center">
        <div className="relative flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
          <div aria-hidden className="starter-reveal__pad absolute inset-x-6 bottom-2 h-14 rounded-[100%]" />
          <PokeSparks seed={`reveal-${species.id}`} accent={accent} />
          {species.spriteUrl ? (
            <Image
              src={species.spriteUrl}
              alt=""
              width={220}
              height={220}
              className="starter-reveal__sprite relative z-10 h-40 w-40 object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.55)] sm:h-48 sm:w-48"
              unoptimized
              priority
            />
          ) : null}
        </div>
        <p
          id="starter-reveal-title"
          className="starter-reveal__name mt-3 text-[1.35rem] font-semibold tracking-wide text-white"
        >
          {formatMoveName(species.name)}
        </p>
        <p className="starter-reveal__copy page-title mt-3 text-[clamp(1.25rem,4vw,1.75rem)] text-white">
          {title}
        </p>
        <p
          className="starter-reveal__copy mt-1.5 text-[13px] text-white/55"
          style={{ animationDelay: "120ms" }}
        >
          {subtitle}
        </p>
        <span
          aria-hidden
          className="starter-reveal__spinner mt-5 h-8 w-8 rounded-full border-2 border-white/20 border-t-white/80"
        />
      </div>
    </div>,
    document.body,
  );
}

/**
 * Flujo post-registro: tutorial de recursos (3 pasos con spotlight) y luego
 * la elección del inicial con cards al estilo del resto de la app.
 */
export function StarterHub({
  starters,
  locale,
}: {
  starters: StarterSpeciesCard[];
  locale: string;
}) {
  const t = useTranslations("starter");
  const [mounted, setMounted] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [picked, setPicked] = useState<StarterSpeciesCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealPhase, setRevealPhase] = useState<"pick" | "ready" | "go">("pick");

  useEffect(() => {
    const seen = hasSeen("starter-resources");
    const raf = requestAnimationFrame(() => {
      setMounted(true);
      setShowPicker(seen);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  async function handlePick(species: StarterSpeciesCard) {
    if (busy || picked) return;
    setPicked(species);
    setBusy(true);
    setRevealPhase("pick");

    // Action + animación en paralelo: antes se sumaban (~8s) y parecía trabado.
    const minReveal = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 1400);
    });

    try {
      const [result] = await Promise.all([chooseStarter(species.id, locale), minReveal]);
      setRevealPhase("ready");

      if (!result.ok) {
        if (result.error === "auth") {
          window.location.assign(`/${locale}/login`);
          return;
        }
        setPicked(null);
        setBusy(false);
        setRevealPhase("pick");
        return;
      }

      setRevealPhase("go");
      // Navegación dura: el portal del reveal no puede quedar montado encima
      // de /battle si el soft-nav tarda o falla.
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 280);
      });
      window.location.assign(`/${locale}${result.href}`);
    } catch {
      setPicked(null);
      setBusy(false);
      setRevealPhase("pick");
    }
  }

  if (!mounted) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center">
        <span className="h-8 w-8 animate-pulse rounded-full bg-white/10" aria-hidden />
      </div>
    );
  }

  const revealSubtitle =
    revealPhase === "go"
      ? t("revealGo")
      : revealPhase === "ready"
        ? t("revealReady")
        : t("revealSubtitle");

  return (
    <>
      {!showPicker ? (
        <ResourceSpotlight onComplete={() => setShowPicker(true)} />
      ) : null}

      {picked ? (
        <StarterReveal
          species={picked}
          title={t("revealTitle", { name: picked.name })}
          subtitle={revealSubtitle}
        />
      ) : null}

      {showPicker ? (
        <div
          className={`mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col text-center transition-opacity duration-500 ${
            picked ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <div className="starter-picker-head shrink-0">
            <p className="mb-1.5 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-pokeball-red sm:mb-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
              {t("eyebrow")}
            </p>
            <h1 className="page-title text-[clamp(1.25rem,4vw,2rem)] text-white">
              {t("title")}
            </h1>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-snug text-white/55 sm:mt-2 sm:text-[14px]">
              {t("subtitle")}
            </p>
          </div>

          {/* 2 columnas en mobile: con 6 iniciales, una sola columna obligaba
              a scrollear toda la elección. */}
          <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 content-center gap-2.5 sm:mt-4 sm:grid-cols-3 sm:gap-3 md:mt-5 md:gap-4">
            {starters.map((species, index) => (
              <StarterCard
                key={species.id}
                species={species}
                chooseLabel={t("choose")}
                index={index}
                selectedId={picked?.id ?? null}
                disabled={busy}
                onPick={handlePick}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-h-[42vh] max-w-lg flex-col items-center justify-center px-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-pokeball-red">
            {t("tutorial.waitingEyebrow")}
          </p>
          <p className="page-title mt-2 text-[clamp(1.2rem,4vw,1.6rem)] text-white/90">
            {t("tutorial.waitingTitle")}
          </p>
          <p className="mt-2 text-[13px] text-white/45">{t("tutorial.waitingBody")}</p>
        </div>
      )}
    </>
  );
}
