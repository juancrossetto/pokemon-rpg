"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";
import { allowAction } from "@/lib/rate-limit";
import {
  isPriceValid,
  listingExpiry,
  listingFeeFor,
  proceedsFor,
} from "@/lib/market-rules";
import { applyMarketFeeDiscount } from "@/lib/badge-perks";
import { blockIfInCombat } from "@/lib/battle-lock";
import { compactTeamSlots } from "@/lib/team";
import { isPokemonBusy } from "@/lib/pokemon-busy";
import type { Prisma } from "@/generated/prisma/client";

// Reglas del dossier (fase 5): auction house con moneda 100% interna,
// comisión al vender (sumidero de economía) y transacciones atómicas para que
// nada se duplique ni se pierda a mitad de operación.
//
// Toda transacción arranca tomando el lock de fila del/los jugador(es)
// involucrados: sin eso, las validaciones read-then-write (¿ya está publicado?,
// ¿le queda equipo?) no son atómicas en READ COMMITTED. Ver src/lib/db-locks.ts.

const RATE_LIMIT_WINDOW_MS = 60_000;
const PUBLISH_LIMIT = 10;
const BUY_LIMIT = 20;
const CANCEL_LIMIT = 20;

// Errores esperables de negocio — viajan como ?error= en el redirect.
class MarketError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

function parsePrice(raw: FormDataEntryValue | null): number | null {
  const price = Number(raw);
  return isPriceValid(price) ? price : null;
}

function backToMarket(
  locale: string,
  tab: string,
  result: { error?: string; notice?: string; coins?: number; got?: "pokemon" | "item" },
) {
  // 'layout' refresca el SiteHeader (saldo de monedas), no solo la página.
  revalidatePath(`/${locale}`, "layout");
  revalidatePath(`/${locale}/market`);
  revalidatePath(`/${locale}/pc`);
  revalidatePath(`/${locale}/team`);
  const param = result.error ? `&error=${result.error}` : `&notice=${result.notice}`;
  // El delta viaja en la URL sólo para animar el contador del header: el saldo
  // real lo pone el revalidate de arriba. Por eso el cliente lo valida y lo
  // acota antes de usarlo — es un parámetro que el jugador puede escribir.
  const coins = !result.error && result.coins ? `&coins=${result.coins}` : "";
  const got = !result.error && result.got ? `&got=${result.got}` : "";
  redirect({ href: `/market?tab=${tab}${param}${coins}${got}`, locale });
}

/** Cobra la tarifa de publicación. No se devuelve al cancelar ni al expirar. */
async function chargeListingFee(
  tx: Prisma.TransactionClient,
  userId: string,
  price: number,
): Promise<void> {
  const badgeCount = await tx.badge.count({ where: { userId } });
  const fee = applyMarketFeeDiscount(listingFeeFor(price), badgeCount);
  const paid = await tx.user.updateMany({
    where: { id: userId, coins: { gte: fee } },
    data: { coins: { decrement: fee } },
  });
  if (paid.count === 0) throw new MarketError("insufficient_fee");
}

export async function listPokemon(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) return;

  if (!allowAction(`market:publish:${userId}`, PUBLISH_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    backToMarket(locale, "sell", { error: "rate_limited" });
    return;
  }

  const pokemonId = String(formData.get("pokemonId") ?? "");
  const price = parsePrice(formData.get("price"));
  if (!pokemonId || price === null) {
    backToMarket(locale, "sell", { error: "invalid_price" });
    return;
  }

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const instance = await tx.pokemonInstance.findFirst({
        where: { id: pokemonId, ownerId: userId },
        include: {
          listings: {
            where: {
              OR: [
                { status: "ACTIVE" },
                { status: "SOLD", buyerId: userId, buyerClaimedAt: null },
              ],
            },
            select: { id: true, status: true },
          },
          battleSessions: { where: { status: "ACTIVE" }, select: { id: true } },
          moves: { select: { moveId: true } },
        },
      });
      if (!instance) throw new MarketError("not_found");
      if (instance.listings.some((l) => l.status === "ACTIVE")) {
        throw new MarketError("already_listed");
      }
      if (instance.listings.some((l) => l.status === "SOLD")) {
        throw new MarketError("not_available");
      }
      if (instance.battleSessions.length > 0) throw new MarketError("in_battle");
      if (instance.isTradeLocked) throw new MarketError("trade_locked");
      if (instance.moves.length === 0) throw new MarketError("no_moves");

      // No podés quedarte sin equipo: siempre tiene que quedar al menos
      // un Pokémon en un slot activo.
      if (instance.teamSlot !== null) {
        const others = await tx.pokemonInstance.count({
          where: { ownerId: userId, teamSlot: { not: null }, id: { not: instance.id } },
        });
        if (others === 0) throw new MarketError("last_team_member");
      }

      // Incubando, pensión o trueque pendiente: no se puede poner en venta.
      if (await isPokemonBusy(tx, userId, instance.id)) throw new MarketError("occupied");


      await chargeListingFee(tx, userId, price);

      // Escrow: sale del equipo mientras está publicado — no puede batallar
      // ni cambiar de estado hasta que se venda, se cancele o expire.
      await tx.pokemonInstance.update({
        where: { id: instance.id },
        data: { teamSlot: null },
      });

      // El Pokémon publicado sale del equipo: renumeramos para no dejar hueco.
      await compactTeamSlots(tx, userId);

      await tx.marketListing.create({
        data: {
          sellerId: userId,
          kind: "POKEMON",
          pokemonInstanceId: instance.id,
          price,
          expiresAt: listingExpiry(),
        },
      });
    });
  } catch (e) {
    if (e instanceof MarketError) error = e.code;
    else throw e;
  }

  backToMarket(locale, error ? "sell" : "mine", error ? { error } : { notice: "listed" });
}

export async function listItem(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) return;

  if (!allowAction(`market:publish:${userId}`, PUBLISH_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    backToMarket(locale, "sell", { error: "rate_limited" });
    return;
  }

  const itemId = String(formData.get("itemId") ?? "");
  const price = parsePrice(formData.get("price"));
  const quantity = Number(formData.get("quantity"));
  if (!itemId || price === null || !Number.isInteger(quantity) || quantity < 1) {
    backToMarket(locale, "sell", { error: "invalid_price" });
    return;
  }

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      // Escrow atómico: el decremento con guarda de cantidad evita vender
      // más unidades de las que hay si llegan dos requests a la vez.
      const taken = await tx.inventoryItem.updateMany({
        where: { userId, itemId, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      if (taken.count === 0) throw new MarketError("not_enough_items");

      await chargeListingFee(tx, userId, price);

      await tx.marketListing.create({
        data: { sellerId: userId, kind: "ITEM", itemId, quantity, price, expiresAt: listingExpiry() },
      });
    });
  } catch (e) {
    if (e instanceof MarketError) error = e.code;
    else throw e;
  }

  backToMarket(locale, error ? "sell" : "mine", error ? { error } : { notice: "listed" });
}

export async function buyListing(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) return;

  if (!allowAction(`market:buy:${userId}`, BUY_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    backToMarket(locale, "browse", { error: "rate_limited" });
    return;
  }

  const listingId = String(formData.get("listingId") ?? "");

  let error: string | undefined;
  let boughtPokemon = false;
  let paidPrice = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({ where: { id: listingId } });
      if (!listing || listing.status !== "ACTIVE") throw new MarketError("not_available");
      if (listing.sellerId === userId) throw new MarketError("own_listing");

      // Comprador y vendedor, siempre en el mismo orden para no deadlockear.
      await lockUsers(tx, userId, listing.sellerId);

      // Reclamo atómico: si dos compradores llegan a la vez, solo uno pasa
      // esta guarda. La guarda de expiración cierra la ventana entre que una
      // publicación vence y el barrido la marca EXPIRED.
      const now = new Date();
      const claimed = await tx.marketListing.updateMany({
        where: {
          id: listingId,
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: { status: "SOLD", buyerId: userId, soldAt: now },
      });
      if (claimed.count === 0) throw new MarketError("not_available");

      // Cobro con guarda de saldo — nunca deja monedas en negativo.
      const paid = await tx.user.updateMany({
        where: { id: userId, coins: { gte: listing.price } },
        data: { coins: { decrement: listing.price } },
      });
      if (paid.count === 0) throw new MarketError("insufficient_coins");
      paidPrice = listing.price;

      // El vendedor cobra el precio menos la comisión (esa plata desaparece
      // de la economía a propósito — control de inflación).
      await tx.user.update({
        where: { id: listing.sellerId },
        data: { coins: { increment: proceedsFor(listing.price) } },
      });

      if (listing.kind === "POKEMON" && listing.pokemonInstanceId) {
        // Pasa a escrow del comprador (ownerId) pero sigue oculto del PC hasta
        // que lo retire de la mochila (`claimPurchase` / buyerClaimedAt).
        await tx.pokemonInstance.update({
          where: { id: listing.pokemonInstanceId },
          data: { ownerId: userId, teamSlot: null },
        });
        boughtPokemon = true;
      }
      // Ítems: NO van al inventario acá. Quedan en la mochila hasta reclamar.
    });
  } catch (e) {
    if (e instanceof MarketError) error = e.code;
    else throw e;
  }

  if (!error) {
    const { notifyMarketSold } = await import("@/lib/notifications");
    await notifyMarketSold(listingId);
  }

  backToMarket(
    locale,
    "bought",
    error
      ? { error }
      : { notice: boughtPokemon ? "bought_pokemon" : "bought", coins: -paidPrice },
  );
}

const CLAIM_LIMIT = 30;

/** Retira una compra de la mochila: Pokémon → PC visible; ítem → inventario. */
export async function claimPurchase(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) return;

  if (!allowAction(`market:claim:${userId}`, CLAIM_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    backToMarket(locale, "bought", { error: "rate_limited" });
    return;
  }

  const listingId = String(formData.get("listingId") ?? "");

  let error: string | undefined;
  // Qué se retiró, para que el collect FX vuele al destino correcto. Va en un
  // objeto y no en un `let`: al asignarse dentro del callback de la
  // transacción, el control-flow analysis de TS estrecharía la variable suelta
  // a `null` y las comparaciones de abajo darían error.
  const claimedRef: { kind: "pokemon" | "item" | null } = { kind: null };
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const claimed = await tx.marketListing.updateMany({
        where: {
          id: listingId,
          buyerId: userId,
          status: "SOLD",
          buyerClaimedAt: null,
        },
        data: { buyerClaimedAt: new Date() },
      });
      if (claimed.count === 0) throw new MarketError("not_available");

      const listing = await tx.marketListing.findUniqueOrThrow({ where: { id: listingId } });

      if (listing.kind === "POKEMON" && listing.pokemonInstanceId) {
        // Siempre reafirma dueño + PC: si un rollback/test dejó el owner mal,
        // reclamar no puede marcar "recibido" sin entregar el Pokémon.
        const poke = await tx.pokemonInstance.findUnique({
          where: { id: listing.pokemonInstanceId },
        });
        if (!poke) throw new MarketError("not_found");
        await tx.pokemonInstance.update({
          where: { id: poke.id },
          data: { ownerId: userId, teamSlot: null },
        });
        claimedRef.kind = "pokemon";
      } else if (listing.kind === "ITEM" && listing.itemId && listing.quantity) {
        await tx.inventoryItem.upsert({
          where: { userId_itemId: { userId, itemId: listing.itemId } },
          create: { userId, itemId: listing.itemId, quantity: listing.quantity },
          update: { quantity: { increment: listing.quantity } },
        });
        claimedRef.kind = "item";
      }
    });
  } catch (e) {
    if (e instanceof MarketError) error = e.code;
    else throw e;
  }

  backToMarket(
    locale,
    "bought",
    error ? { error } : { notice: "claimed", got: claimedRef.kind ?? undefined },
  );
}

export async function cancelListing(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  const userId = session.user.id;

  if (await blockIfInCombat(userId, locale)) return;

  if (!allowAction(`market:cancel:${userId}`, CANCEL_LIMIT, RATE_LIMIT_WINDOW_MS)) {
    backToMarket(locale, "mine", { error: "rate_limited" });
    return;
  }

  const listingId = String(formData.get("listingId") ?? "");

  let error: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, userId);

      const cancelled = await tx.marketListing.updateMany({
        where: { id: listingId, sellerId: userId, status: "ACTIVE" },
        data: { status: "CANCELLED", sellerSeenAt: new Date() },
      });
      if (cancelled.count === 0) throw new MarketError("not_available");

      const listing = await tx.marketListing.findUniqueOrThrow({ where: { id: listingId } });

      if (listing.kind === "ITEM" && listing.itemId && listing.quantity) {
        await tx.inventoryItem.upsert({
          where: { userId_itemId: { userId, itemId: listing.itemId } },
          create: { userId, itemId: listing.itemId, quantity: listing.quantity },
          update: { quantity: { increment: listing.quantity } },
        });
      }
      // Los Pokémon ya están en el PC (teamSlot null desde el escrow): salir
      // de la publicación alcanza para que el dueño pueda volver a usarlos.
    });
  } catch (e) {
    if (e instanceof MarketError) error = e.code;
    else throw e;
  }

  backToMarket(locale, "mine", error ? { error } : { notice: "cancelled" });
}
