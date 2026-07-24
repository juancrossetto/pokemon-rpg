"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  listingFeeFor,
  MAX_PRICE,
  MIN_PRICE,
  proceedsFor,
} from "@/lib/market-rules";
import { MarketSubmitButton } from "@/components/market-submit-button";

const INPUT_CLASS =
  "bg-surface-container border border-white/10 rounded-lg px-2 py-1.5 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50";
const PRIMARY_BUTTON_CLASS =
  "text-label-md px-4 py-1.5 rounded-lg bg-pokeball-red text-white hover:bg-pokeball-red/80 transition-colors";

type Mode = "pokemon" | "item";

function parseValidPrice(raw: string): number | null {
  const price = Number(raw);
  return Number.isInteger(price) && price >= MIN_PRICE && price <= MAX_PRICE
    ? price
    : null;
}

/**
 * Campos de precio al vender: preview en vivo de tarifa/neto (y c/u si es
 * ítem), más confirmación al publicar porque la fee no se reembolsa.
 */
export function MarketSellControls({
  mode,
  maxQuantity,
}: {
  mode: Mode;
  maxQuantity?: number;
}) {
  const t = useTranslations("market");
  const [priceRaw, setPriceRaw] = useState("");
  const [quantity, setQuantity] = useState(1);

  const price = parseValidPrice(priceRaw);
  const fee = price !== null ? listingFeeFor(price) : null;
  const proceeds = price !== null ? proceedsFor(price) : null;
  const unitPrice =
    mode === "item" && price !== null && quantity > 0
      ? Math.round(price / quantity)
      : null;

  const previewParts: string[] = [];
  if (unitPrice !== null) previewParts.push(t("unitPrice", { price: unitPrice }));
  if (fee !== null && proceeds !== null) {
    previewParts.push(t("feePreview", { fee, proceeds }));
  }

  return (
    <div className="flex flex-col gap-1 w-full sm:w-auto sm:shrink-0 sm:items-end">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {mode === "item" && (
          <input
            type="number"
            name="quantity"
            min={1}
            max={maxQuantity}
            value={quantity}
            required
            aria-label={t("quantityLabel")}
            className={`${INPUT_CLASS} w-14 shrink-0`}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isInteger(next) && next > 0) setQuantity(next);
              else setQuantity(1);
            }}
          />
        )}
        <input
          type="number"
          name="price"
          min={MIN_PRICE}
          max={MAX_PRICE}
          required
          value={priceRaw}
          placeholder={mode === "item" ? t("priceTotalPlaceholder") : t("pricePlaceholder")}
          aria-label={mode === "item" ? t("priceTotalPlaceholder") : t("pricePlaceholder")}
          className={`${INPUT_CLASS} min-w-0 flex-1 sm:w-28`}
          onChange={(event) => setPriceRaw(event.target.value)}
        />
        <MarketSubmitButton
          label={t("publish")}
          pendingLabel={t("publishing")}
          className={`${PRIMARY_BUTTON_CLASS} shrink-0`}
          getConfirmMessage={() =>
            price !== null
              ? t("confirmPublish", { price, fee: listingFeeFor(price) })
              : undefined
          }
        />
      </div>
      {previewParts.length > 0 && (
        <p className="text-label-sm text-on-surface-variant text-right">{previewParts.join(" · ")}</p>
      )}
    </div>
  );
}
