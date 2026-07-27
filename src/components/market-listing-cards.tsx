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

/**
 * Rareza: estrellas + texto, nunca solo color. El borde tintado sigue estando,
 * pero un daltónico tiene que poder distinguir épico de legendario igual.
 */
function RarityBadge({ rarity, label }: { rarity: MarketRarity; label: string }) {
  const style = RARITY_STYLES[rarity];
  return (
    <span
      className={`inline-flex max-w-full items-center gap-0.5 truncate rounded border bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm ${style.border} ${style.text}`}
    >
      <span aria-hidden>{"★".repeat(style.stars)}</span>
      {label}
    </span>
  );
}

/**
 * Marco del sprite: el tamaño lo fija `.market-sprite-frame` (56px mobile /
 * 72px desde `sm`), no la imagen. Antes el sprite vivía en una caja
 * `aspect-[5/4]` con `p-6` y crecía a 96px sobre un área que era la mitad del
 * alto de la card.
 */
function SpriteFrame({
  src,
  alt,
  pixelated,
}: {
  src: string;
  alt: string;
  pixelated?: boolean;
}) {
  return (
    <div
      className={`market-sprite-frame border border-white/[0.07] bg-black/25 ${
        pixelated ? "market-sprite-pixel" : ""
      }`}
    >
      <Image
        src={src}
        alt={alt}
        width={96}
        height={96}
        sizes="96px"
        className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
        unoptimized={pixelated}
      />
    </div>
  );
}

/** Precio dominante + unidades a la derecha, en una sola fila. */
async function PriceRow({
  price,
  quantity,
  showUnit,
}: {
  price: number;
  quantity: number;
  showUnit: boolean;
}) {
  const t = await getTranslations("market");
  const unit = Math.round(price / Math.max(1, quantity));

  return (
    <div className="flex items-baseline justify-between gap-2">
      <p className="flex min-w-0 items-center gap-1 font-mono text-[19px] font-semibold leading-none text-electric-yellow">
        <span className="material-symbols-outlined text-[16px]!">paid</span>
        <span className="truncate">{price.toLocaleString()}</span>
      </p>
      <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">
        {showUnit ? t("unitPrice", { price: unit }) : `×${quantity}`}
      </span>
    </div>
  );
}

async function MetaRow({
  seller,
  expiresAt,
}: {
  seller: string;
  expiresAt: Date | null;
}) {
  const t = await getTranslations("market");
  const closing = expiresAt ? expiryIn(expiresAt).kind === "soon" : false;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] text-on-surface-variant">
      <span className="min-w-0 truncate" title={seller}>
        <span className="material-symbols-outlined mr-0.5 align-[-3px] text-[13px]!">person</span>
        {seller}
      </span>
      {expiresAt && (
        <span
          className={`inline-flex shrink-0 items-center gap-0.5 ${
            closing ? "font-semibold text-error" : "opacity-80"
          }`}
        >
          {/* Por vencer: además del color, un ícono — el color solo no alcanza. */}
          <span className="material-symbols-outlined text-[13px]!">
            {closing ? "warning" : "schedule"}
          </span>
          <ExpiryText date={expiresAt} />
        </span>
      )}
      <span className="sr-only">{t("hub.seller")}</span>
    </div>
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
    <form action={cancelListing.bind(null, locale)} className="w-full">
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
      className="market-buy-btn h-10 w-full rounded-md bg-pokeball-red px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-on-surface-variant disabled:opacity-100"
      confirmMessage={
        price >= CONFIRM_PRICE_THRESHOLD ? t("confirmBuy", { name: displayName, price }) : undefined
      }
    />
  );
}

/**
 * Cancelar es secundaria y destructiva: contorno, no relleno rojo. El rojo
 * lleno queda reservado para la acción primaria (comprar).
 */
async function CancelButton() {
  const t = await getTranslations("market");
  return (
    <MarketSubmitButton
      label={t("cancel")}
      pendingLabel={t("cancelling")}
      className="h-10 w-full rounded-md border border-white/15 px-3 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant transition hover:border-white/30 hover:text-on-surface"
    />
  );
}

/**
 * Envoltorio común de card: mismo esqueleto para objetos y Pokémon.
 * `min-w-0` en todos los niveles — es lo que evita que un nombre largo o un
 * precio grande estiren la columna de la grilla.
 */
function CardShell({
  rarity,
  children,
}: {
  rarity: MarketRarity;
  children: React.ReactNode;
}) {
  const style = RARITY_STYLES[rarity];
  return (
    <article
      className={`market-listing-card group relative flex h-full min-w-0 flex-col gap-2.5 overflow-hidden rounded-xl border bg-black/40 p-3 backdrop-blur-md ${style.border}`}
      style={{ boxShadow: `0 0 0 1px ${style.glow}` }}
    >
      {children}
    </article>
  );
}

/**
 * Fila de badges. "Tuya" iba posicionado en absoluto sobre la esquina y en
 * cards de 2 columnas se montaba encima del badge de rareza; en flujo normal
 * los dos conviven y ninguno se recorta.
 */
function BadgeRow({
  rarity,
  rarityLabel,
  isOwn,
  ownLabel,
}: {
  rarity: MarketRarity;
  rarityLabel: string;
  isOwn: boolean;
  ownLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <RarityBadge rarity={rarity} label={rarityLabel} />
      {isOwn && (
        <span className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
          {ownLabel}
        </span>
      )}
    </div>
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

  return (
    <CardShell rarity={rarity}>
      {/* Cabecera: sprite a la izquierda, identidad a la derecha. En horizontal
          la card baja de ~420px de alto a ~190px sin perder información. */}
      <div className="flex min-w-0 items-start gap-2.5">
        <SpriteFrame src={itemSpriteUrl(props.item.name)} alt={props.item.name} pixelated />
        <div className="min-w-0 flex-1">
          <BadgeRow
            rarity={rarity}
            rarityLabel={t(`hub.rarity.${rarity}`)}
            isOwn={props.isOwn}
            ownLabel={t("hub.yours")}
          />
          <h2
            className="mt-1 line-clamp-2 text-[13px] font-semibold leading-tight text-white sm:text-label-md"
            title={props.item.name}
          >
            {props.item.name}
          </h2>
          <p className="text-[10px] uppercase tracking-wide text-on-surface-variant">
            {t(`hub.itemType.${props.item.type}`)}
          </p>
          {props.item.effectText && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-on-surface-variant/75">
              {props.item.effectText}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-white/[0.08] pt-2.5">
        <PriceRow price={props.price} quantity={props.quantity} showUnit={props.quantity > 1} />
        <MetaRow seller={props.seller} expiresAt={props.expiresAt} />
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
    </CardShell>
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
  const rarity = pokemonRarity({ isShiny: pokemon.isShiny, level: pokemon.level, invested });
  const name = pokemon.nickname ?? species.name;
  const power = trainingPercent(invested, pokemon.level);
  const hp = calculateMaxHp(species.baseHp, pokemon.level, pokemon.ptConstitution);
  const atk = calculateStat(species.baseAttack, pokemon.ptStrength, pokemon.level);

  return (
    <CardShell rarity={rarity}>
      <div className="flex min-w-0 items-start gap-2.5">
        <SpriteFrame src={spriteFor(species.spriteUrl, pokemon.isShiny)} alt={species.name} />
        <div className="min-w-0 flex-1">
          <BadgeRow
            rarity={rarity}
            rarityLabel={t(`hub.rarity.${rarity}`)}
            isOwn={props.isOwn}
            ownLabel={t("hub.yours")}
          />
          <h2
            className="mt-1 line-clamp-2 text-[13px] font-semibold capitalize leading-tight text-white sm:text-label-md"
            title={name}
          >
            {name}
          </h2>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
            <span className="font-mono text-[10px] uppercase text-on-surface-variant">
              {t("level", { level: pokemon.level })}
            </span>
            {pokemon.isShiny && (
              <span className="text-[10px] font-bold text-electric-yellow">✦ {t("shiny")}</span>
            )}
            {/* Un solo tipo en la card compacta; el segundo vive en el detalle. */}
            {species.types.slice(0, 2).map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="rounded px-1 py-px text-[9px] uppercase"
                  style={{ backgroundColor: `${color}26`, color }}
                >
                  {type}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats en una línea, no en la grilla de tres celdas con borde: es el
          dato que se usa para valuar la compra, pero ocupaba 70px de alto. */}
      <p className="flex min-w-0 items-center gap-x-2 gap-y-0.5 overflow-hidden text-[10px] font-mono uppercase text-on-surface-variant">
        <span className="shrink-0">
          {t("stats.hp")} <span className="text-on-surface">{hp}</span>
        </span>
        <span className="shrink-0">
          {t("stats.atk")} <span className="text-on-surface">{atk}</span>
        </span>
        <span className="shrink-0">
          {t("hub.training")} <span className="text-tertiary">{power}%</span>
        </span>
      </p>

      <div className="mt-auto flex flex-col gap-2 border-t border-white/[0.08] pt-2.5">
        <PriceRow price={props.price} quantity={1} showUnit={false} />
        <MetaRow seller={props.seller} expiresAt={props.expiresAt} />
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
    </CardShell>
  );
}
