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
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span
        aria-hidden
        className={`material-symbols-outlined shrink-0 ${
          size === "lg" ? "text-[26px]!" : "text-[18px]!"
        } ${isCoins ? "text-tertiary" : "text-sky-300"}`}
      >
        {isCoins ? "paid" : "bolt"}
      </span>
      <span className={`${text} font-mono ${isCoins ? "text-tertiary" : "text-sky-300"}`}>
        {reward.amount.toLocaleString()}
      </span>
      <span className="sr-only">
        {reward.amount} {isCoins ? unitLabels.coins : unitLabels.energy}
      </span>
    </span>
  );
}

export function RewardList({
  rewards,
  size = "md",
  unitLabels,
}: {
  rewards: RewardDef[];
  size?: "sm" | "md" | "lg";
  unitLabels: { coins: string; energy: string };
}) {
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
