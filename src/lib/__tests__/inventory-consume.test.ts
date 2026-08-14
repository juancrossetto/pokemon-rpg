import { describe, expect, it, vi } from "vitest";
import {
  clearEmptyInventoryRow,
  consumeInventoryItem,
  consumeInventoryItemStatement,
} from "@/lib/inventory-consume";

/**
 * Cliente Prisma falso: sólo interesa **qué consulta se arma**, no ejecutarla.
 * La carrera que este módulo evita vive en el `where`, así que es ahí donde hay
 * que mirar — un test contra la base real no diría nada más y necesitaría
 * Prisma, que la suite no toca (ver AGENTS.md).
 */
function fakeClient(count = 1) {
  const updateMany = vi.fn().mockResolvedValue({ count });
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  return {
    client: { inventoryItem: { updateMany, deleteMany } } as never,
    updateMany,
    deleteMany,
  };
}

describe("consumeInventoryItemStatement", () => {
  it("descuenta con guarda de cantidad, no con un update a ciegas", () => {
    const { client, updateMany } = fakeClient();
    consumeInventoryItemStatement(client, { userId: "u1", itemId: "i1" });

    expect(updateMany).toHaveBeenCalledTimes(1);
    const arg = updateMany.mock.calls[0]![0];
    // La guarda es el punto del módulo: sin `gte` la cantidad puede irse a
    // negativo cuando entran dos requests entre la lectura y la escritura.
    expect(arg.where).toEqual({ userId: "u1", itemId: "i1", quantity: { gte: 1 } });
    expect(arg.data).toEqual({ quantity: { decrement: 1 } });
  });

  it("respeta cantidades mayores a 1 en los dos lados", () => {
    const { client, updateMany } = fakeClient();
    consumeInventoryItemStatement(client, { userId: "u1", itemId: "i1", quantity: 5 });
    const arg = updateMany.mock.calls[0]![0];
    expect(arg.where.quantity).toEqual({ gte: 5 });
    expect(arg.data.quantity).toEqual({ decrement: 5 });
  });

  it("nunca descuenta cero ni negativo aunque se lo pidan", () => {
    const { client, updateMany } = fakeClient();
    consumeInventoryItemStatement(client, { userId: "u1", itemId: "i1", quantity: 0 });
    consumeInventoryItemStatement(client, { userId: "u1", itemId: "i1", quantity: -3 });
    for (const call of updateMany.mock.calls) {
      expect(call[0].data.quantity).toEqual({ decrement: 1 });
    }
  });

  it("trunca fracciones en vez de mandarlas a la base", () => {
    const { client, updateMany } = fakeClient();
    consumeInventoryItemStatement(client, { userId: "u1", itemId: "i1", quantity: 2.7 });
    expect(updateMany.mock.calls[0]![0].data.quantity).toEqual({ decrement: 2 });
  });
});

describe("consumeInventoryItem", () => {
  it("true cuando descontó", async () => {
    const { client } = fakeClient(1);
    await expect(consumeInventoryItem(client, { userId: "u1", itemId: "i1" })).resolves.toBe(
      true,
    );
  });

  it("false cuando otro request se adelantó — el caller tiene que abortar", async () => {
    const { client } = fakeClient(0);
    await expect(consumeInventoryItem(client, { userId: "u1", itemId: "i1" })).resolves.toBe(
      false,
    );
  });
});

describe("clearEmptyInventoryRow", () => {
  it("sólo borra filas en cero o menos", () => {
    const { client, deleteMany } = fakeClient();
    clearEmptyInventoryRow(client, { userId: "u1", itemId: "i1" });
    expect(deleteMany.mock.calls[0]![0].where).toEqual({
      userId: "u1",
      itemId: "i1",
      quantity: { lte: 0 },
    });
  });
});
