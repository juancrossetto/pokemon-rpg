"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { itemDisplayUrl } from "@/lib/item-sprites";
import { resolveItemDisplayName } from "@/lib/shop";
import type { BattleLobbyLoadoutStack } from "@/lib/battle-lobby";

const MAX_SHOWN = 4;

/**
 * Mochila de prep: stacks reales (tipo × qty), compactos.
 * El estilo GO de la tienda vive en Comercio → Explorar, no acá.
 *
 * En mobile los chips van en scroll horizontal (evita el wrap 2+1 raro).
 * `heal` va en el header (chip Chansey) para no ocupar una fila entera.
 */
export function LobbyLoadoutCard({
  balls,
  heals,
  unspentTotal,
  heal,
}: {
  balls: BattleLobbyLoadoutStack[];
  heals: BattleLobbyLoadoutStack[];
  unspentTotal: number;
  /** Centro Pokémon compacto — header, no footer. */
  heal?: ReactNode;
}) {
  const t = useTranslations("battle.lobby");
  const tShop = useTranslations("shop");

  const itemLabel = (canonical: string) =>
    resolveItemDisplayName(canonical, (key) => {
      const path = `names.${key}`;
      return tShop.has(path) ? tShop(path) : null;
    });

  const shownBalls = balls.slice(0, MAX_SHOWN);
  const shownHeals = heals.slice(0, MAX_SHOWN);
  const extraBalls = Math.max(0, balls.length - MAX_SHOWN);
  const extraHeals = Math.max(0, heals.length - MAX_SHOWN);
  const empty = balls.length === 0 && heals.length === 0;

  return (
    <section className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
          {t("bagTitle")}
        </p>
        <div className="flex items-center gap-2">
          {heal}
          <Link
            href="/inventory"
            className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35 transition hover:text-white/70"
          >
            {t("bagOpen")}
          </Link>
        </div>
      </div>

      {empty ? (
        <div>
          <p className="text-[12px] text-white/40">{t("bagEmpty")}</p>
          <Link
            href="/market?tab=shop"
            className="mt-1.5 inline-flex text-[11px] font-semibold text-tertiary hover:text-tertiary/80"
          >
            {t("bagShop")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <LoadoutRow
            eyebrow={t("bagCatch")}
            stacks={shownBalls}
            extra={extraBalls}
            emptyHint={t("bagNoBalls")}
            itemLabel={itemLabel}
            kind="ball"
          />
          <LoadoutRow
            eyebrow={t("bagHeal")}
            stacks={shownHeals}
            extra={extraHeals}
            emptyHint={t("bagNoHeals")}
            itemLabel={itemLabel}
            kind="heal"
          />
        </div>
      )}

      {unspentTotal > 0 ? (
        <Link
          href="/team"
          className="mt-2 flex items-center gap-1 px-0.5 text-[11px] text-tertiary/90 transition hover:text-tertiary"
        >
          <span className="material-symbols-outlined text-[14px]!">bolt</span>
          <span className="min-w-0 flex-1 truncate">
            {t("unspentPoints", { count: unspentTotal })}
          </span>
          <span className="material-symbols-outlined text-[14px]!">chevron_right</span>
        </Link>
      ) : null}
    </section>
  );
}

function LoadoutRow({
  eyebrow,
  stacks,
  extra,
  emptyHint,
  itemLabel,
  kind,
}: {
  eyebrow: string;
  stacks: BattleLobbyLoadoutStack[];
  extra: number;
  emptyHint: string;
  itemLabel: (name: string) => string;
  kind: "ball" | "heal";
}) {
  return (
    <div>
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
        {eyebrow}
      </p>
      {stacks.length === 0 ? (
        <p className="text-[11px] text-white/35">{emptyHint}</p>
      ) : (
        <ul className="-mx-0.5 flex gap-1.5 overflow-x-auto overscroll-x-contain px-0.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:overscroll-auto sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {stacks.map((stack) => {
            const label = itemLabel(stack.name);
            const meta =
              kind === "ball" && stack.potency != null
                ? `×${Number.isInteger(stack.potency) ? stack.potency : stack.potency.toFixed(1)}`
                : kind === "heal" && stack.potency != null
                  ? `+${stack.potency}`
                  : null;
            return (
              <li
                key={stack.name}
                title={meta ? `${label} (${meta})` : label}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/8 bg-black/30 py-1 pl-1 pr-2"
              >
                <Image
                  src={itemDisplayUrl(stack.name)}
                  alt=""
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] object-contain"
                  draggable={false}
                />
                <span className="max-w-[5.5rem] truncate text-[11px] font-medium text-white/75">
                  {label}
                </span>
                <span className="font-mono text-[12px] font-bold tabular-nums text-white">
                  {stack.quantity}
                </span>
              </li>
            );
          })}
          {extra > 0 ? (
            <li className="inline-flex shrink-0 items-center rounded-lg border border-white/6 bg-white/4 px-2 py-1 text-[10px] font-semibold text-white/40">
              +{extra}
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
