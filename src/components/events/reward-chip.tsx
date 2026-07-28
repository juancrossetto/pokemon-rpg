import Image from "next/image";
import { itemSpriteUrl } from "@/lib/item-sprites";
import type { RewardDef } from "@/lib/events/rewards";

/**
 * Representación visual de una recompensa. Es la única pieza que sabe cómo se
 * dibuja cada `RewardDef`, así que el calendario diario, los hitos semanales y
 * el panel de confirmación muestran lo mismo sin repetir lógica.
 *
 * El texto accesible nunca depende del ícono: cada chip lleva su etiqueta en
 * `sr-only` con la unidad ("120 monedas", "3 Poke Ball").
 */
export function RewardChip({
  reward,
  size = "md",
  unitLabels,
}: {
  reward: RewardDef;
  size?: "sm" | "md" | "lg";
  /** `{ coins: "monedas", energy: "energía" }` ya traducido. */
  unitLabels: { coins: string; energy: string };
}) {
  const box = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const text = size === "lg" ? "text-label-md" : "text-[11px]";

  if (reward.kind === "item") {
    return (
      <span className="inline-flex min-w-0 items-center gap-1">
        <span className={`${box} shrink-0 grid place-items-center`}>
          <Image
            src={itemSpriteUrl(reward.itemName)}
            alt=""
            width={44}
            height={44}
            className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
            unoptimized
          />
        </span>
        <span className={`${text} font-mono text-on-surface`}>×{reward.quantity}</span>
        <span className="sr-only">
          {reward.quantity} {reward.itemName}
        </span>
      </span>
    );
  }

  const isCoins = reward.kind === "coins";
  const isGems = reward.kind === "gems";
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span
        aria-hidden
        className={`material-symbols-outlined shrink-0 ${
          size === "lg" ? "text-[26px]!" : "text-[18px]!"
        } ${isCoins ? "text-tertiary" : isGems ? "text-fuchsia-400" : "text-sky-300"}`}
      >
        {isCoins ? "paid" : isGems ? "diamond" : "bolt"}
      </span>
      <span
        className={`${text} font-mono ${
          isCoins ? "text-tertiary" : isGems ? "text-fuchsia-400" : "text-sky-300"
        }`}
      >
        {reward.amount.toLocaleString()}
      </span>
      <span className="sr-only">
        {reward.amount}{" "}
        {isCoins ? unitLabels.coins : isGems ? "gems" : unitLabels.energy}
      </span>
    </span>
  );
}

/** Formato corto para celdas estrechas (1.5k, ×1, 5). */
function compactAmount(reward: RewardDef): string {
  if (reward.kind === "item") return `×${reward.quantity}`;
  if (reward.amount >= 1000) {
    const k = reward.amount / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(reward.amount);
}

function rewardTone(reward: RewardDef): string {
  if (reward.kind === "coins") return "text-tertiary";
  if (reward.kind === "gems") return "text-fuchsia-400";
  if (reward.kind === "energy") return "text-sky-300";
  return "text-on-surface";
}

/**
 * Varios premios en una sola fila de íconos + cifra corta.
 * Evita el wrap vertical que estira las celdas del calendario diario.
 */
function CompactRewardRow({
  rewards,
  unitLabels,
}: {
  rewards: RewardDef[];
  unitLabels: { coins: string; energy: string };
}) {
  return (
    <span className="flex max-w-full items-end justify-center gap-0.5">
      {rewards.map((reward, index) => {
        const tone = rewardTone(reward);
        return (
          <span
            key={`${reward.kind}-${index}`}
            className="flex min-w-0 flex-col items-center gap-px"
          >
            {reward.kind === "item" ? (
              <span className="grid h-4 w-4 place-items-center">
                <Image
                  src={itemSpriteUrl(reward.itemName)}
                  alt=""
                  width={16}
                  height={16}
                  className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
                  unoptimized
                />
              </span>
            ) : (
              <span
                aria-hidden
                className={`material-symbols-outlined text-[14px]! leading-none ${tone}`}
              >
                {reward.kind === "coins"
                  ? "paid"
                  : reward.kind === "gems"
                    ? "diamond"
                    : "bolt"}
              </span>
            )}
            <span className={`font-mono text-[8px] leading-none tabular-nums ${tone}`}>
              {compactAmount(reward)}
            </span>
            <span className="sr-only">
              {reward.kind === "item"
                ? `${reward.quantity} ${reward.itemName}`
                : `${reward.amount} ${
                    reward.kind === "coins"
                      ? unitLabels.coins
                      : reward.kind === "energy"
                        ? unitLabels.energy
                        : "gems"
                  }`}
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function RewardList({
  rewards,
  size = "md",
  unitLabels,
  layout = "wrap",
}: {
  rewards: RewardDef[];
  size?: "sm" | "md" | "lg";
  unitLabels: { coins: string; energy: string };
  /**
   * `calendar`: fila compacta cuando hay 2+ premios, para no romper la grilla
   * del regalo diario. `wrap` es el layout suelto de hubs y confirmaciones.
   */
  layout?: "wrap" | "calendar";
}) {
  if (layout === "calendar" && rewards.length > 1) {
    return <CompactRewardRow rewards={rewards} unitLabels={unitLabels} />;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {rewards.map((reward, index) => (
        <RewardChip
          key={`${reward.kind}-${index}`}
          reward={reward}
          size={size}
          unitLabels={unitLabels}
        />
      ))}
    </span>
  );
}
