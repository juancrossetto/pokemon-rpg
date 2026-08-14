import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Consumo atómico de un objeto de la mochila.
 *
 * El patrón que había en casi todos los usos era leer la cantidad, decidir, y
 * después `update({ data: { quantity: { decrement: 1 } } })`. Entre la lectura
 * y la escritura no hay nada que impida que llegue un segundo request: con dos
 * pestañas, un doble click o un reintento, la misma poción se gasta dos veces
 * y la cantidad puede quedar en negativo. Es la misma carrera que `market.ts`
 * ya resolvía —y comentaba— con una guarda en el `where`; acá se generaliza
 * para que no haya dos criterios en el mismo repo.
 *
 * `updateMany` con `quantity: { gte }` hace la comprobación y el descuento en
 * una sola sentencia: si otro request se adelantó, la condición no matchea y
 * `count` vuelve 0 en vez de descontar de más.
 */
export function consumeInventoryItemStatement(
  client: Pick<typeof prisma, "inventoryItem">,
  params: { userId: string; itemId: string; quantity?: number },
): Prisma.PrismaPromise<Prisma.BatchPayload> {
  const quantity = Math.max(1, Math.floor(params.quantity ?? 1));
  return client.inventoryItem.updateMany({
    where: { userId: params.userId, itemId: params.itemId, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });
}

/**
 * Versión `await` para transacciones con callback. Devuelve `false` cuando el
 * objeto ya no estaba disponible — el caller tiene que abortar, no seguir.
 */
export async function consumeInventoryItem(
  client: Pick<typeof prisma, "inventoryItem">,
  params: { userId: string; itemId: string; quantity?: number },
): Promise<boolean> {
  const result = await consumeInventoryItemStatement(client, params);
  return result.count > 0;
}

/** Limpia la fila si quedó en cero. Cosmético: `gte` ya impide el negativo. */
export function clearEmptyInventoryRow(
  client: Pick<typeof prisma, "inventoryItem">,
  params: { userId: string; itemId: string },
): Prisma.PrismaPromise<Prisma.BatchPayload> {
  return client.inventoryItem.deleteMany({
    where: { userId: params.userId, itemId: params.itemId, quantity: { lte: 0 } },
  });
}
