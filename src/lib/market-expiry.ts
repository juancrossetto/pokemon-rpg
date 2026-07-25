import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/db-locks";

// Expiración lazy de publicaciones: no hay cron, así que la carga del mercado
// barre las vencidas y devuelve el escrow al vendedor.
//
// El barrido está throttleado y deduplicado a propósito: sin eso, cada carga
// de cada jugador dispara un barrido completo y bloquea el render de la
// página. Con el throttle, entre dos barridos lo peor que pasa es que una
// publicación vencida siga visible un minuto — y comprarla ya no es posible
// porque `buyListing` valida `expiresAt` al reclamarla.
const SWEEP_INTERVAL_MS = 60_000;
const SWEEP_BATCH = 50;

let lastSweepAt = 0;
let inFlight: Promise<void> | null = null;

export async function expireDueListings(): Promise<void> {
  if (Date.now() - lastSweepAt < SWEEP_INTERVAL_MS) return;
  // Cargas concurrentes comparten el mismo barrido en vez de lanzar N.
  if (inFlight) return inFlight;

  inFlight = sweep().finally(() => {
    lastSweepAt = Date.now();
    inFlight = null;
  });
  return inFlight;
}

async function sweep(): Promise<void> {
  const due = await prisma.marketListing.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    select: { id: true, sellerId: true },
    orderBy: { expiresAt: "asc" },
    take: SWEEP_BATCH,
  });

  for (const { id, sellerId } of due) {
    let didExpire = false;
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, sellerId);

      // Guarda atómica: si alguien compró o canceló entre el findMany y acá,
      // esta publicación ya no está ACTIVE y no la tocamos.
      const claimed = await tx.marketListing.updateMany({
        where: { id, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
      if (claimed.count === 0) return;
      didExpire = true;

      const listing = await tx.marketListing.findUniqueOrThrow({ where: { id } });

      if (listing.kind === "ITEM" && listing.itemId && listing.quantity) {
        await tx.inventoryItem.upsert({
          where: { userId_itemId: { userId: listing.sellerId, itemId: listing.itemId } },
          create: { userId: listing.sellerId, itemId: listing.itemId, quantity: listing.quantity },
          update: { quantity: { increment: listing.quantity } },
        });
      }
      // Los Pokémon quedan con teamSlot null: vuelven al PC del vendedor, que
      // puede retirarlos al equipo desde la pantalla de almacenamiento. El
      // vendedor se entera por notificación + el contador de "Mis publicaciones".
    });

    if (didExpire) {
      const { notifyMarketExpired } = await import("@/lib/notifications");
      await notifyMarketExpired(id);
    }
  }
}
