"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { itemDisplayUrl } from "@/lib/item-sprites";

export type ZoneRewardClaim = {
  objectiveLabel: string;
  coins: number;
  itemName: string;
  quantity: number;
};

type ZoneRewardPopupProps = {
  reward: ZoneRewardClaim;
  labels: {
    title: string;
    coins: string;
    continue: string;
  };
  onContinue: () => void;
};

const COIN_HD = "/items/hd/poke-coin.png";

/**
 * Celebración al reclamar un objetivo de zona.
 * Acentos con theme-secondary; ítems en PNG HD cuando exista.
 */
export function ZoneRewardPopup({ reward, labels, onContinue }: ZoneRewardPopupProps) {
  const itemSrc = itemDisplayUrl(reward.itemName, "hd");
  const itemIsHd = itemSrc.startsWith("/items/hd/");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-margin-mobile"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zone-reward-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label={labels.continue}
        onClick={onContinue}
      />

      <div className="evolve-card-in relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-secondary/25 bg-[#0c1018] px-5 py-6 text-center shadow-[0_20px_48px_rgba(0,0,0,0.5)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_50%_at_50%_28%,color-mix(in_srgb,var(--theme-secondary)_18%,transparent),transparent_70%),linear-gradient(180deg,color-mix(in_srgb,var(--theme-secondary)_8%,transparent),transparent_50%)]"
        />

        <div className="relative flex flex-col items-center">
          <p className="page-title text-[11px] tracking-[0.18em] text-secondary sm:text-[12px]">
            {labels.title}
          </p>

          <p className="mt-1.5 max-w-[90%] text-[13px] leading-snug text-white/60">
            {reward.objectiveLabel}
          </p>

          <div className="mt-5 flex w-full items-start justify-center gap-6">
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <Image
                src={itemSrc}
                alt={reward.itemName}
                width={72}
                height={72}
                className={`h-16 w-16 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)] ${
                  itemIsHd ? "" : "[image-rendering:pixelated]"
                }`}
                unoptimized
              />
              <p className="mt-2 truncate text-[12px] font-semibold text-white/88">
                {reward.itemName}
              </p>
              <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-secondary">
                ×{reward.quantity}
              </p>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center">
              <Image
                src={COIN_HD}
                alt=""
                width={72}
                height={72}
                className="h-16 w-16 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
                unoptimized
              />
              <p className="mt-2 truncate text-[12px] font-semibold text-white/88">
                {labels.coins}
              </p>
              <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-secondary">
                +{reward.coins}
              </p>
            </div>
          </div>

          <h2 id="zone-reward-title" className="sr-only">
            {labels.title}
          </h2>

          <button
            type="button"
            onClick={onContinue}
            className="game-cta game-cta--red mt-5 w-full"
          >
            {labels.continue}
          </button>
        </div>
      </div>
    </div>
  );
}
