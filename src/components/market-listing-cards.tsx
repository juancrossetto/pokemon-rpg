import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ItemType } from "@/generated/prisma/client";
import { typeColor } from "@/lib/type-colors";
import { calculateMaxHp, calculateStat } from "@/lib/stats";
import { itemSpriteUrl } from "@/lib/item-sprites";
import { MarketSubmitButton } from "@/components/market-submit-button";
import { buyListing, cancelListing } from "@/actions/market";
import { CONFIRM_PRICE_THRESHOLD } from "@/lib/market-rules";
import {
  RARITY_STYLES,
  itemRarity,
  pokemonRarity,
  trainingPercent,
  type MarketRarity,
} from "@/lib/market-hub";
import { spriteFor } from "@/lib/shiny";

type Expiry = { kind: "soon" } | { kind: "hours"; value: number } | { kind: "days"; value: number };

function expiryIn(date: Date): Expiry {
  const remainingMs = date.getTime() - Date.now();
  const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
  if (remainingMs <= 0 || hours <= 1) return { kind: "soon" };
  if (hours < 24) return { kind: "hours", value: hours };
  return { kind: "days", value: Math.ceil(hours / 24) };
}

async function ExpiryText({ date }: { date: Date }) {
  const t = await getTranslations("market");
  const expiry = expiryIn(date);
  if (expiry.kind === "soon") return t("expiresSoon");
  if (expiry.kind === "hours") return t("expiresInHours", { hours: expiry.value });
  return t("expiresIn", { days: expiry.value });
}

function RarityBadge({ rarity, label }: { rarity: MarketRarity; label: string }) {
  const style = RARITY_STYLES[rarity];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.border} ${style.text}`}
    >
      {"★".repeat(style.stars)}
      {label}
    </span>
  );
}

function BuyOrCancel({
  locale,
  listingId,
  isOwn,
  canAfford,
  price,
  displayName,
  coins,
}: {
  locale: string;
  listingId: string;
  isOwn: boolean;
  canAfford: boolean;
  price: number;
  displayName: string;
  coins: number;
}) {
  return isOwn ? (
    <form action={cancelListing.bind(null, locale)}>
      <input type="hidden" name="listingId" value={listingId} />
      <CancelButton />
    </form>
  ) : (
    <form action={buyListing.bind(null, locale)} className="w-full">
      <input type="hidden" name="listingId" value={listingId} />
      <BuyButton
        canAfford={canAfford}
        price={price}
        displayName={displayName}
        missing={Math.max(0, price - coins)}
      />
    </form>
  );
}

async function BuyButton({
  canAfford,
  price,
  displayName,
  missing,
}: {
  canAfford: boolean;
  price: number;
  displayName: string;
  missing: number;
}) {
  const t = await getTranslations("market");
  return (
    <MarketSubmitButton
      label={canAfford ? t("hub.buyNow") : t("needFunds", { missing })}
      pendingLabel={t("buying")}
      disabled={!canAfford}
      className="market-buy-btn w-full rounded-md bg-pokeball-red px-4 py-2.5 text-label-sm font-bold uppercase tracking-[0.14em] text-white transition disabled:cursor-not-allowed disabled:opacity-45"
      confirmMessage={
        price >= CONFIRM_PRICE_THRESHOLD
          ? t("confirmBuy", { name: displayName, price })
          : undefined
      }
    />
  );
}

async function CancelButton() {
  const t = await getTranslations("market");
  return (
    <MarketSubmitButton
      label={t("cancel")}
      pendingLabel={t("cancelling")}
      className="w-full rounded-md border border-white/15 px-4 py-2.5 text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant transition hover:border-white/30 hover:text-on-surface"
    />
  );
}

type ItemCardProps = {
  locale: string;
  listingId: string;
  price: number;
  quantity: number;
  seller: string;
  expiresAt: Date | null;
  isOwn: boolean;
  canAfford: boolean;
  coins: number;
  item: {
    name: string;
    // El enum de Prisma y no una unión escrita a mano: al sumarse MACHINE
    // (MTs/MOs) la lista hardcodeada quedó desactualizada y rompió el build.
    // Importándolo, cualquier tipo nuevo de ítem entra solo. El sprite sale
    // del nombre y `itemRarity` ya cae en "common" por defecto, así que un
    // tipo nuevo se muestra bien sin tocar nada más.
    type: ItemType;
    buyPrice: number;
    effectText: string | null;
  };
};

export async function MarketItemCard(props: ItemCardProps) {
  const t = await getTranslations("market");
  const rarity = itemRarity(props.item);
  const style = RARITY_STYLES[rarity];
  const unit = Math.round(props.price / Math.max(1, props.quantity));

  return (
    <article
      className={`market-listing-card group relative flex h-full flex-col overflow-hidden rounded-xl border bg-black/40 backdrop-blur-md ${style.border}`}
      style={{ boxShadow: `0 0 0 1px ${style.glow}` }}
    >
      <div className="relative flex aspect-[5/4] items-center justify-center bg-gradient-to-b from-white/[0.04] to-transparent p-6">
        <Image
          src={itemSpriteUrl(props.item.name)}
          alt={props.item.name}
          width={96}
          height={96}
          className="h-20 w-20 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)] transition duration-300 group-hover:scale-110 [image-rendering:pixelated] sm:h-24 sm:w-24"
          unoptimized
        />
        <div className="absolute left-3 top-3">
          <RarityBadge rarity={rarity} label={t(`hub.rarity.${rarity}`)} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 pt-2">
        <div>
          <h2 className="truncate text-[17px] font-semibold text-white">{props.item.name}</h2>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-on-surface-variant">
            {t(`hub.itemType.${props.item.type}`)}
          </p>
          {props.item.effectText && (
            <p className="mt-1.5 line-clamp-2 text-label-sm text-on-surface-variant/80">
              {props.item.effectText}
            </p>
          )}
        </div>

        <div className="mt-auto space-y-2 border-t border-white/8 pt-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/70">
                {t("hub.price")}
              </p>
              <p className="flex items-center gap-1 font-mono text-[26px] font-semibold leading-none text-electric-yellow">
                <span className="material-symbols-outlined text-[22px]!">paid</span>
                {props.price.toLocaleString()}
              </p>
              {props.quantity > 1 && (
                <p className="mt-0.5 text-[11px] text-on-surface-variant">
                  {t("unitPrice", { price: unit })}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/70">
                {t("hub.stock")}
              </p>
              <p className="font-mono text-lg text-on-surface">{props.quantity}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant">
            <span className="truncate">
              {t("hub.seller")}: <span className="text-on-surface">{props.seller}</span>
            </span>
            {props.expiresAt && (
              <span className="shrink-0 opacity-80">
                <ExpiryText date={props.expiresAt} />
              </span>
            )}
          </div>

          <BuyOrCancel
            locale={props.locale}
            listingId={props.listingId}
            isOwn={props.isOwn}
            canAfford={props.canAfford}
            price={props.price}
            displayName={props.item.name}
            coins={props.coins}
          />
        </div>
      </div>
    </article>
  );
}

type PokemonCardProps = {
  locale: string;
  listingId: string;
  price: number;
  seller: string;
  expiresAt: Date | null;
  isOwn: boolean;
  canAfford: boolean;
  coins: number;
  pokemon: {
    nickname: string | null;
    level: number;
    isShiny: boolean;
    ptStrength: number;
    ptDexterity: number;
    ptIntelligence: number;
    ptSpeed: number;
    ptConstitution: number;
    unspentPoints: number;
    moves: { move: { name: string; type: string } }[];
    species: {
      name: string;
      spriteUrl: string;
      types: string[];
      baseHp: number;
      baseAttack: number;
      baseDefense: number;
      baseSpAtk: number;
      baseSpDef: number;
      baseSpeed: number;
    };
  };
};

export async function MarketPokemonCard(props: PokemonCardProps) {
  const t = await getTranslations("market");
  const { pokemon } = props;
  const { species } = pokemon;
  const invested =
    pokemon.ptStrength +
    pokemon.ptDexterity +
    pokemon.ptIntelligence +
    pokemon.ptSpeed +
    pokemon.ptConstitution;
  const rarity = pokemonRarity({
    isShiny: pokemon.isShiny,
    level: pokemon.level,
    invested,
  });
  const style = RARITY_STYLES[rarity];
  const name = pokemon.nickname ?? species.name;
  const power = trainingPercent(invested, pokemon.level);
  const hp = calculateMaxHp(species.baseHp, pokemon.level, pokemon.ptConstitution);
  const atk = calculateStat(species.baseAttack, pokemon.ptStrength, pokemon.level);

  return (
    <article
      className={`market-listing-card group relative flex h-full flex-col overflow-hidden rounded-xl border bg-black/40 backdrop-blur-md ${style.border}`}
      style={{ boxShadow: `0 0 0 1px ${style.glow}` }}
    >
      <div className="relative flex aspect-[5/4] items-center justify-center bg-gradient-to-b from-white/[0.04] to-transparent p-6">
        <Image
          src={spriteFor(species.spriteUrl, pokemon.isShiny)}
          alt={species.name}
          width={96}
          height={96}
          className="h-20 w-20 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)] transition duration-300 group-hover:scale-110 sm:h-24 sm:w-24"
        />
        <div className="absolute left-3 top-3">
          <RarityBadge rarity={rarity} label={t(`hub.rarity.${rarity}`)} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 pt-2">
        <div>
          <h2 className="truncate text-[17px] font-semibold capitalize text-white">
            {name}
            {pokemon.isShiny && (
              <span className="ml-2 text-label-sm text-electric-yellow">✦ {t("shiny")}</span>
            )}
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-on-surface-variant">
              {t("level", { level: pokemon.level })}
            </span>
            {species.types.map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="rounded px-1.5 py-0.5 text-[10px] uppercase border"
                  style={{ backgroundColor: `${color}33`, color, borderColor: `${color}55` }}
                >
                  {type}
                </span>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-md border border-white/8 bg-white/[0.03] p-2 text-center">
            <div>
              <p className="text-[10px] uppercase text-on-surface-variant/70">{t("stats.hp")}</p>
              <p className="font-mono text-label-md text-on-surface">{hp}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-on-surface-variant/70">{t("stats.atk")}</p>
              <p className="font-mono text-label-md text-on-surface">{atk}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-on-surface-variant/70">{t("hub.training")}</p>
              <p className="font-mono text-label-md text-tertiary">{power}%</p>
            </div>
          </div>
          {pokemon.moves.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {pokemon.moves.slice(0, 4).map(({ move }) => {
                const color = typeColor(move.type);
                return (
                  <span
                    key={move.name}
                    className="rounded border px-1.5 py-0.5 text-[10px] capitalize"
                    style={{ backgroundColor: `${color}18`, color, borderColor: `${color}40` }}
                  >
                    {move.name.replace(/-/g, " ")}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-auto space-y-2 border-t border-white/8 pt-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/70">
                {t("hub.price")}
              </p>
              <p className="flex items-center gap-1 font-mono text-[26px] font-semibold leading-none text-electric-yellow">
                <span className="material-symbols-outlined text-[22px]!">paid</span>
                {props.price.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/70">
                {t("hub.stock")}
              </p>
              <p className="font-mono text-lg text-on-surface">1</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant">
            <span className="truncate">
              {t("hub.seller")}: <span className="text-on-surface">{props.seller}</span>
            </span>
            {props.expiresAt && (
              <span className="shrink-0 opacity-80">
                <ExpiryText date={props.expiresAt} />
              </span>
            )}
          </div>

          <BuyOrCancel
            locale={props.locale}
            listingId={props.listingId}
            isOwn={props.isOwn}
            canAfford={props.canAfford}
            price={props.price}
            displayName={name}
            coins={props.coins}
          />
        </div>
      </div>
    </article>
  );
}
