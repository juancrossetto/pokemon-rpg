import Image from "next/image";
import type { ReactNode } from "react";
import { itemHdIconUrl, itemSpriteUrl } from "@/lib/item-sprites";
import type { RewardDef } from "@/lib/events/rewards";

/** Íconos HD del strip Daily Reward. */
const COIN_BUNDLE_HD = "/items/hd/poke-coin-bundle-s.png";
const ENERGY_HD = "/items/hd/energy.png";

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
    const hd = itemHdIconUrl(reward.itemName);
    const src = hd ?? itemSpriteUrl(reward.itemName);
    return (
      <span className="inline-flex min-w-0 items-center gap-1">
        <span className={`${box} shrink-0 grid place-items-center`}>
          <Image
            src={src}
            alt=""
            width={44}
            height={44}
            className={[
              "max-h-full max-w-full object-contain",
              hd ? "drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]" : "[image-rendering:pixelated]",
            ].join(" ")}
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
  const isEnergy = reward.kind === "energy";
  const hdAsset = isCoins ? COIN_BUNDLE_HD : isEnergy ? ENERGY_HD : null;
  const tone = isCoins
    ? "text-tertiary"
    : isGems
      ? "text-fuchsia-400"
      : "text-sky-300";

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {hdAsset ? (
        <span className={`${box} shrink-0 grid place-items-center`}>
          <Image
            src={hdAsset}
            alt=""
            width={44}
            height={44}
            className="max-h-full max-w-full object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
            unoptimized
          />
        </span>
      ) : (
        <span
          aria-hidden
          className={`material-symbols-outlined shrink-0 ${
            size === "lg" ? "text-[26px]!" : "text-[18px]!"
          } ${tone}`}
        >
          diamond
        </span>
      )}
      <span className={`${text} font-mono ${tone}`}>
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
  dense = false,
}: {
  rewards: RewardDef[];
  unitLabels: { coins: string; energy: string };
  /** Íconos más grandes para el strip del modal Daily Reward. */
  dense?: boolean;
}) {
  const iconBox = dense ? "h-14 w-14 sm:h-16 sm:w-16" : "h-4 w-4";
  const iconPx = dense ? 64 : 16;
  const iconGlyph = dense ? "text-[40px]! sm:text-[46px]!" : "text-[14px]!";
  const amountCls = dense
    ? "font-mono text-[12px] font-bold leading-none tabular-nums sm:text-[13px]"
    : "font-mono text-[8px] leading-none tabular-nums";

  return (
    <span
      className={[
        "flex max-w-full items-end justify-center",
        dense ? "gap-1" : "gap-0.5",
      ].join(" ")}
    >
      {rewards.map((reward, index) => {
        const tone = rewardTone(reward);
        const hd =
          reward.kind === "item" ? itemHdIconUrl(reward.itemName) : null;
        return (
          <span
            key={`${reward.kind}-${index}`}
            className={[
              "flex min-w-0 flex-col items-center",
              dense ? "gap-0.5" : "gap-px",
            ].join(" ")}
          >
            {reward.kind === "item" ? (
              <span className={`grid ${iconBox} place-items-center`}>
                <Image
                  src={hd ?? itemSpriteUrl(reward.itemName)}
                  alt=""
                  width={iconPx}
                  height={iconPx}
                  className={[
                    "max-h-full max-w-full object-contain",
                    hd
                      ? "drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
                      : "[image-rendering:pixelated]",
                  ].join(" ")}
                  unoptimized
                />
              </span>
            ) : reward.kind === "coins" && dense ? (
              <span className={`grid ${iconBox} place-items-center`}>
                <Image
                  src={COIN_BUNDLE_HD}
                  alt=""
                  width={iconPx}
                  height={iconPx}
                  className="max-h-full max-w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
                  unoptimized
                />
              </span>
            ) : reward.kind === "energy" && dense ? (
              <span className={`grid ${iconBox} place-items-center`}>
                <Image
                  src={ENERGY_HD}
                  alt=""
                  width={iconPx}
                  height={iconPx}
                  className="max-h-full max-w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
                  unoptimized
                />
              </span>
            ) : (
              <span
                aria-hidden
                className={`material-symbols-outlined leading-none ${iconGlyph} ${tone}`}
              >
                {reward.kind === "coins"
                  ? "paid"
                  : reward.kind === "gems"
                    ? "diamond"
                    : "bolt"}
              </span>
            )}
            <span className={`${amountCls} ${tone}`}>
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

/** Un solo premio a tamaño strip: ícono dominante + cantidad abajo (libre del check). */
function StripRewardSolo({
  reward,
  unitLabels,
  claimedOverlay,
}: {
  reward: RewardDef;
  unitLabels: { coins: string; energy: string };
  claimedOverlay?: ReactNode;
}) {
  const tone = rewardTone(reward);
  // Casi a lo ancho de la card; poco aire alrededor.
  const stripIconBox =
    "relative mx-auto grid aspect-square w-[88%] max-w-none place-items-center overflow-visible";
  const stripIconImg =
    "h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]";
  const amountCls = `daily-reward-qty mt-0.5 text-[13px] leading-none sm:text-[14px] ${tone}`;

  let icon: ReactNode;
  let amount: ReactNode;
  let sr: ReactNode;

  if (reward.kind === "item") {
    const hd = itemHdIconUrl(reward.itemName);
    icon = (
      <Image
        src={hd ?? itemSpriteUrl(reward.itemName)}
        alt=""
        width={128}
        height={128}
        className={[stripIconImg, hd ? "" : "[image-rendering:pixelated]"].join(" ")}
        unoptimized
      />
    );
    amount = <span className={amountCls}>×{reward.quantity}</span>;
    sr = (
      <span className="sr-only">
        {reward.quantity} {reward.itemName}
      </span>
    );
  } else if (reward.kind === "coins") {
    icon = (
      <Image
        src={COIN_BUNDLE_HD}
        alt=""
        width={128}
        height={128}
        className={stripIconImg}
        unoptimized
      />
    );
    amount = <span className={amountCls}>{compactAmount(reward)}</span>;
    sr = (
      <span className="sr-only">
        {reward.amount} {unitLabels.coins}
      </span>
    );
  } else if (reward.kind === "energy") {
    icon = (
      <Image
        src={ENERGY_HD}
        alt=""
        width={128}
        height={128}
        className={stripIconImg}
        unoptimized
      />
    );
    amount = <span className={amountCls}>{compactAmount(reward)}</span>;
    sr = (
      <span className="sr-only">
        {reward.amount} {unitLabels.energy}
      </span>
    );
  } else {
    icon = (
      <span
        aria-hidden
        className={`material-symbols-outlined text-[2.75rem]! leading-none sm:text-[3.25rem]! ${tone}`}
      >
        diamond
      </span>
    );
    amount = <span className={amountCls}>{compactAmount(reward)}</span>;
    sr = (
      <span className="sr-only">
        {reward.amount} gems
      </span>
    );
  }

  return (
    <span className="flex h-full w-full flex-col items-center justify-start gap-0.5 pt-0.5">
      <span className={stripIconBox}>
        {icon}
        {claimedOverlay}
      </span>
      {amount}
      {sr}
    </span>
  );
}

export function RewardList({
  rewards,
  size = "md",
  unitLabels,
  layout = "wrap",
  claimedOverlay,
}: {
  rewards: RewardDef[];
  size?: "sm" | "md" | "lg";
  unitLabels: { coins: string; energy: string };
  /**
   * `calendar`: fila compacta cuando hay 2+ premios, para no romper la grilla
   * del regalo diario. `strip`: íconos grandes del popup Daily Reward.
   * `wrap` es el layout suelto de hubs y confirmaciones.
   */
  layout?: "wrap" | "calendar" | "strip";
  /** Overlay (check) anclado al ícono, no a la cantidad. */
  claimedOverlay?: ReactNode;
}) {
  if (layout === "strip") {
    if (rewards.length === 1) {
      return (
        <StripRewardSolo
          reward={rewards[0]}
          unitLabels={unitLabels}
          claimedOverlay={claimedOverlay}
        />
      );
    }
    return (
      <span className="relative">
        <CompactRewardRow rewards={rewards} unitLabels={unitLabels} dense />
        {claimedOverlay}
      </span>
    );
  }

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
