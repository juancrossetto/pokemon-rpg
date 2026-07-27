"use client";

import Image from "next/image";
import { typeColor } from "@/lib/type-colors";
import { itemSpriteUrl } from "@/lib/item-sprites";
import type { EvolutionRequirement, EvolutionStage } from "@/lib/evolution-chain";

type RequirementLabels = {
  evolveAtLevelLabel: string;
  /** Nombre traducido por ítem, indexado como está en la tabla `Item`. */
  itemLabels: Record<string, string>;
  tradeLabel: string;
};

/** Texto del requisito: nivel, piedra o intercambio. */
function requirementLabel(
  requirement: EvolutionRequirement | null,
  { evolveAtLevelLabel, itemLabels, tradeLabel }: RequirementLabels,
): string | null {
  if (!requirement) return null;
  if (requirement.kind === "level") {
    return evolveAtLevelLabel.replace("{level}", String(requirement.level));
  }
  if (requirement.kind === "item") {
    return itemLabels[requirement.itemName] ?? requirement.itemName;
  }
  if (requirement.kind === "trade") return tradeLabel;
  return null;
}

export function EvolutionChainList({
  stages,
  unknownLabel,
  evolveAtLevelLabel,
  itemLabels,
  tradeLabel,
  compact = false,
}: {
  stages: EvolutionStage[];
  unknownLabel: string;
  evolveAtLevelLabel: string;
  itemLabels: Record<string, string>;
  tradeLabel: string;
  compact?: boolean;
}) {
  if (stages.length === 0) {
    return (
      <p className="py-2 text-center text-[10px] text-white/40">{unknownLabel}</p>
    );
  }

  return (
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
              <div
                className={`relative flex items-center ${compact ? "my-0.5 h-5 pl-5" : "my-1.5 h-7 pl-[2.05rem]"}`}
              >
                <div
                  className={`absolute top-0 h-full w-px bg-white/15 ${compact ? "left-5" : "left-[2.05rem]"}`}
                />
                <span className="relative z-[1] ml-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#141414] px-1.5 py-0.5 text-[8px] text-white/50">
                  <span className="material-symbols-outlined text-[10px]! leading-none">
                    arrow_downward
                  </span>
                  {/* Piedra: se muestra el sprite del ítem, que es como el
                      jugador lo va a reconocer en la mochila y en el mercado. */}
                  {next?.requirement?.kind === "item" && (
                    <Image
                      src={itemSpriteUrl(next.requirement.itemName)}
                      alt=""
                      width={12}
                      height={12}
                      className="h-3 w-3 shrink-0 object-contain"
                    />
                  )}
                  {requirementLabel(next?.requirement ?? null, {
                    evolveAtLevelLabel,
                    itemLabels,
                    tradeLabel,
                  })}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
