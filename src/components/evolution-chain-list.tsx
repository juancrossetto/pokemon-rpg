"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { typeColor } from "@/lib/type-colors";
import { itemDisplayUrl } from "@/lib/item-sprites";
import {
  readinessForRequirement,
  type EvolutionRequirement,
  type EvolutionStage,
} from "@/lib/evolution-readiness";
import { isTradeSubstituteEvolution } from "@/lib/evolution-items";
import { confirmEvolve } from "@/actions/level-up-offers";
// Aliasada a propósito: es una server action, no un hook, pero el nombre
// empieza con `use` y `react-hooks/rules-of-hooks` la marca como llamada
// inválida dentro del callback. Mismo criterio que `applyRareCandy`.
import { useEvolutionStone as applyEvolutionStone } from "@/actions/use-evolution-stone";
import { playUiSfx } from "@/lib/battle-sfx";
import { showToast } from "@/lib/app-toast";
import { EvolvePopup } from "@/components/evolve-popup";

type RequirementLabels = {
  evolveAtLevelLabel: string;
  /** Nombre traducido por ítem, indexado como está en la tabla `Item`. */
  itemLabels: Record<string, string>;
  tradeLabel: string;
  tradeItemHintLabel?: string;
  readyLabel?: string;
  needItemLabel?: string;
  needLevelLabel?: string;
  evolveActionLabel?: string;
  useStoneLabel?: string;
  evolvingLabel?: string;
};

/** Texto del requisito: nivel, piedra o intercambio. Sin precio: ese va aparte. */
function requirementLabel(
  requirement: EvolutionRequirement | null,
  { evolveAtLevelLabel, itemLabels, tradeLabel }: RequirementLabels,
): string | null {
  if (!requirement) return null;
  if (requirement.kind === "level") {
    return evolveAtLevelLabel.replace("{level}", String(requirement.level));
  }
  if (requirement.kind === "item") {
    const stone = itemLabels[requirement.itemName] ?? requirement.itemName;
    const parts = [stone];
    if (requirement.minLevel != null) {
      parts.push(evolveAtLevelLabel.replace("{level}", String(requirement.minLevel)));
    }
    return parts.join(" · ");
  }
  if (requirement.kind === "trade") return tradeLabel;
  return null;
}

/*
  El precio va en el chip: sin él, "Cordón Unión" no le dice al jugador si lo
  puede conseguir ni con qué moneda. Se muestra el de gemas cuando existe —es el
  único ítem premium— y si no, el de monedas.

  Va como JSX y no dentro del texto porque antes eran los emojis 💎 y ⨀: el
  diamante del emoji se pinta celeste en todas las fuentes del sistema, así que
  la moneda premium aparecía de un color que no es el suyo en ningún otro lugar
  del juego. Acá se usan los mismos íconos y colores que el contador del header
  (`diamond` fucsia, `paid` amarillo), que es donde el jugador aprende a
  reconocerlas.
*/
function RequirementPrice({ requirement }: { requirement: EvolutionRequirement }) {
  if (requirement.kind !== "item") return null;

  const gems = requirement.gemPrice ?? 0;
  const coins = requirement.buyPrice ?? 0;
  if (gems <= 0 && coins <= 0) return null;

  const premium = gems > 0;
  return (
    <span
      className={[
        "inline-flex items-center gap-0.5 font-semibold tabular-nums",
        premium ? "text-gem" : "text-electric-yellow",
      ].join(" ")}
    >
      <span
        className={[
          "material-symbols-outlined text-[10px]! leading-none",
          premium ? "text-gem" : "text-electric-yellow",
        ].join(" ")}
        aria-hidden
      >
        {premium ? "diamond" : "paid"}
      </span>
      {premium ? gems : coins.toLocaleString()}
    </span>
  );
}

type RevealState = {
  fromName: string;
  fromSpriteUrl: string | null;
  toName: string;
  toSpriteUrl: string;
};

export function EvolutionChainList({
  stages,
  unknownLabel,
  evolveAtLevelLabel,
  itemLabels,
  tradeLabel,
  tradeItemHintLabel,
  compact = false,
  currentLevel,
  ownedItems = [],
  instanceId,
  readyLabel = "Ready",
  needItemLabel = "Need",
  needLevelLabel,
  evolveActionLabel,
  useStoneLabel,
  evolvingLabel,
  onEvolved,
}: {
  stages: EvolutionStage[];
  unknownLabel: string;
  evolveAtLevelLabel: string;
  itemLabels: Record<string, string>;
  tradeLabel: string;
  /** Aclaración para el objeto que sustituye al intercambio. */
  tradeItemHintLabel?: string;
  compact?: boolean;
  /** Nivel del Pokémon actual — habilita estados “listo / falta”. */
  currentLevel?: number;
  /** Nombres de piedras en inventario (tal cual `Item.name`). */
  ownedItems?: string[];
  /** Si hay instanceId, se puede evolucionar desde la pestaña. */
  instanceId?: string;
  readyLabel?: string;
  needItemLabel?: string;
  needLevelLabel?: string;
  evolveActionLabel?: string;
  useStoneLabel?: string;
  evolvingLabel?: string;
  onEvolved?: (result: {
    toName: string;
    toSpriteUrl: string;
    level: number;
    currentHp: number;
    maxHp: number;
  }) => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const tLevelUp = useTranslations("levelUp");
  const [pending, startTransition] = useTransition();
  const [busySpeciesId, setBusySpeciesId] = useState<number | null>(null);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const ownedSet = new Set(ownedItems);

  if (stages.length === 0) {
    return (
      <p className="py-2 text-center text-[10px] text-white/40">{unknownLabel}</p>
    );
  }

  function runEvolve(opts: {
    kind: "level" | "item";
    toSpeciesId: number;
    itemName?: string;
  }) {
    if (!instanceId || pending) return;
    setBusySpeciesId(opts.toSpeciesId);
    startTransition(async () => {
      try {
        playUiSfx("evolve");
        const result =
          opts.kind === "level"
            ? await confirmEvolve(instanceId, locale)
            : await applyEvolutionStone(
                instanceId,
                opts.itemName!,
                locale,
                opts.toSpeciesId,
              );
        if (!result.ok) {
          showToast(tLevelUp("evolveFailed"), "error");
          return;
        }
        // Popup primero; el refresh al cerrar evita que se pierda el reveal.
        setReveal({
          fromName: result.fromName,
          fromSpriteUrl: result.fromSpriteUrl,
          toName: result.toName,
          toSpriteUrl: result.toSpriteUrl,
        });
        onEvolved?.({
          toName: result.toName,
          toSpriteUrl: result.toSpriteUrl,
          level: result.level,
          currentHp: result.currentHp,
          maxHp: result.maxHp,
        });
      } finally {
        setBusySpeciesId(null);
      }
    });
  }

  return (
    <>
      {reveal && (
        <EvolvePopup
          fromName={reveal.fromName}
          fromSpriteUrl={reveal.fromSpriteUrl}
          toName={reveal.toName}
          toSpriteUrl={reveal.toSpriteUrl}
          labels={{
            evolving: tLevelUp("evolvingCry", { name: reveal.fromName }),
            into: tLevelUp("evolvedInto", { name: reveal.toName }),
            continue: tLevelUp("dismiss"),
          }}
          onContinue={() => {
            setReveal(null);
            router.refresh();
          }}
        />
      )}

      <div className="flex flex-col">
        {stages.map((stage, index) => {
          const unseen = stage.status === "unseen";
          const seenOnly = stage.status === "seen";
          const accent = typeColor(stage.types[0] ?? "normal");
          const dexNum = `#${String(stage.speciesId).padStart(3, "0")}`;
          const showName = unseen ? unknownLabel : stage.name;
          const showConnector = index < stages.length - 1;
          const next = stages[index + 1];
          const spriteSize = compact ? 40 : 56;
          const boxClass = compact
            ? "h-11 w-12 rounded-xl"
            : "h-16 w-[4.5rem] rounded-2xl";

          return (
            <div key={`${stage.speciesId}-${index}`}>
              <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
                <div
                  className={[
                    "relative flex shrink-0 items-center justify-center overflow-hidden border bg-black/30",
                    boxClass,
                    stage.isCurrent ? "border-white/35" : "border-white/[0.08]",
                  ].join(" ")}
                  style={
                    stage.isCurrent
                      ? { boxShadow: `0 0 0 1px ${accent}88, 0 6px 14px ${accent}22` }
                      : undefined
                  }
                >
                  {stage.spriteUrl ? (
                    <Image
                      src={stage.spriteUrl}
                      alt={showName}
                      width={spriteSize}
                      height={spriteSize}
                      className={[
                        "object-contain",
                        compact ? "h-9 w-9" : "h-14 w-14",
                        unseen
                          ? "brightness-0 invert opacity-[0.42]"
                          : seenOnly
                            ? "opacity-60"
                            : "drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]",
                      ].join(" ")}
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className={`font-mono text-white/45 ${compact ? "text-[9px]" : "text-[11px]"}`}>
                    {unseen ? "#???" : dexNum}
                  </p>
                  <p
                    className={[
                      "truncate font-bold capitalize leading-tight",
                      compact ? "text-[11px]" : "text-sm",
                      unseen ? "tracking-[0.14em] text-white/55" : "text-white",
                    ].join(" ")}
                  >
                    {showName}
                  </p>
                  {!unseen && !compact && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {stage.types.map((type) => {
                        const color = typeColor(type);
                        return (
                          <span
                            key={type}
                            className="inline-flex items-center rounded-full border border-white/12 bg-black/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide"
                            style={{ color }}
                          >
                            {type}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {showConnector && (
                <ConnectorRow
                  compact={compact}
                  next={next}
                  labels={{
                    evolveAtLevelLabel,
                    itemLabels,
                    tradeLabel,
                    tradeItemHintLabel,
                    readyLabel,
                    needItemLabel,
                    needLevelLabel,
                  }}
                  currentLevel={currentLevel}
                  ownedSet={ownedSet}
                  evaluateReadiness={Boolean(next?.isNextOption)}
                  action={
                    next?.isNextOption &&
                    currentLevel != null &&
                    instanceId &&
                    (evolveActionLabel || useStoneLabel) ? (
                      <EvolveActionButton
                        next={next}
                        currentLevel={currentLevel}
                        ownedSet={ownedSet}
                        busy={pending && busySpeciesId === next.speciesId}
                        evolveActionLabel={evolveActionLabel}
                        useStoneLabel={useStoneLabel}
                        evolvingLabel={evolvingLabel}
                        itemLabels={itemLabels}
                        onEvolve={runEvolve}
                      />
                    ) : null
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function ConnectorRow({
  compact,
  next,
  labels,
  currentLevel,
  ownedSet,
  evaluateReadiness,
  action,
}: {
  compact: boolean;
  next: EvolutionStage | undefined;
  labels: RequirementLabels;
  currentLevel?: number;
  ownedSet: Set<string>;
  evaluateReadiness: boolean;
  action: ReactNode;
}) {
  const req = next?.requirement ?? null;
  const readiness =
    evaluateReadiness && currentLevel != null
      ? readinessForRequirement(req, currentLevel, ownedSet)
      : null;
  const tradeItemHint =
    req?.kind === "item" &&
    next != null &&
    isTradeSubstituteEvolution(req.itemName, next.speciesId)
      ? labels.tradeItemHintLabel
      : null;

  let statusChip: ReactNode = null;
  if (readiness && req) {
    if (readiness.ready) {
      statusChip = (
        <span className="rounded-sm bg-tertiary/20 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-tertiary">
          {labels.readyLabel}
        </span>
      );
    } else if (req.kind === "item" && readiness.ownsItem === false) {
      statusChip = (
        <span className="rounded-sm bg-white/8 px-1 py-px text-[8px] font-medium text-white/45">
          {labels.needItemLabel}
        </span>
      );
    } else if (
      (req.kind === "level" || req.kind === "item") &&
      (readiness.levelsShort ?? 0) > 0 &&
      labels.needLevelLabel
    ) {
      const target =
        req.kind === "level" ? req.level : (req.minLevel ?? "");
      statusChip = (
        <span className="rounded-sm bg-white/8 px-1 py-px text-[8px] font-medium text-white/45">
          {labels.needLevelLabel.replace("{level}", String(target))}
        </span>
      );
    }
  }

  return (
    <div
      className={`relative flex flex-col ${compact ? "my-0.5 pl-5" : "my-1.5 pl-[2.05rem]"}`}
    >
      <div className={`relative flex items-center ${compact ? "h-5" : "h-7"}`}>
        <div className="absolute left-0 top-0 h-full w-px bg-white/15" />
        <span
          className={[
            "relative z-[1] ml-3 inline-flex max-w-full flex-wrap items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px]",
            readiness?.ready
              ? "border-tertiary/40 bg-tertiary/10 text-tertiary"
              : "border-white/10 bg-[#141414] text-white/50",
          ].join(" ")}
        >
          <span className="material-symbols-outlined text-[10px]! leading-none">
            arrow_downward
          </span>
          {req?.kind === "item" && (
            <Image
              src={itemDisplayUrl(req.itemName)}
              alt=""
              width={12}
              height={12}
              className="h-3 w-3 shrink-0 object-contain"
              unoptimized
            />
          )}
          {requirementLabel(req, labels)}
          {req ? <RequirementPrice requirement={req} /> : null}
          {statusChip}
        </span>
      </div>
      {/*
        El Cordón Unión llega como un `use-item` cualquiera, así que en pantalla
        era indistinguible de una piedra: un nombre inventado, sin decir qué
        hace ni por qué cuesta gemas. Esta línea es la única pista de que
        reemplaza al intercambio entre jugadores.
      */}
      {tradeItemHint ? (
        <p className="ml-3 mt-0.5 text-[8px] leading-snug text-white/40">
          {tradeItemHint}
        </p>
      ) : null}
      {action ? <div className="ml-3 mt-1">{action}</div> : null}
    </div>
  );
}

function EvolveActionButton({
  next,
  currentLevel,
  ownedSet,
  busy,
  evolveActionLabel,
  useStoneLabel,
  evolvingLabel,
  itemLabels,
  onEvolve,
}: {
  next: EvolutionStage;
  currentLevel: number;
  ownedSet: Set<string>;
  busy: boolean;
  evolveActionLabel?: string;
  useStoneLabel?: string;
  evolvingLabel?: string;
  itemLabels: Record<string, string>;
  onEvolve: (opts: {
    kind: "level" | "item";
    toSpeciesId: number;
    itemName?: string;
  }) => void;
}) {
  const req = next.requirement;
  if (!req) return null;
  const readiness = readinessForRequirement(req, currentLevel, ownedSet);
  if (!readiness?.ready) return null;

  if (req.kind === "level" && evolveActionLabel) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onEvolve({ kind: "level", toSpeciesId: next.speciesId })}
        className="inline-flex min-h-8 items-center gap-1 rounded-md border border-tertiary/35 bg-tertiary/15 px-2 text-[10px] font-semibold text-tertiary transition hover:bg-tertiary/25 disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[12px]!">auto_awesome</span>
        {busy ? (evolvingLabel ?? evolveActionLabel) : evolveActionLabel}
      </button>
    );
  }

  if (req.kind === "item" && useStoneLabel) {
    const stoneName = itemLabels[req.itemName] ?? req.itemName;
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          onEvolve({
            kind: "item",
            toSpeciesId: next.speciesId,
            itemName: req.itemName,
          })
        }
        className="inline-flex min-h-8 items-center gap-1 rounded-md border border-gem/40 bg-gem px-2 text-[10px] font-semibold text-on-gem transition hover:brightness-110 disabled:opacity-60"
      >
        <Image
          src={itemDisplayUrl(req.itemName)}
          alt=""
          width={14}
          height={14}
          className="h-3.5 w-3.5 object-contain"
          unoptimized
        />
        {busy
          ? (evolvingLabel ?? useStoneLabel)
          : useStoneLabel.replace("{item}", stoneName)}
      </button>
    );
  }

  return null;
}
