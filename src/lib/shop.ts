/**
 * Catálogo de la tienda oficial.
 *
 * La tienda vende a precio de sistema; el mercado es entre jugadores. Esa
 * diferencia se sostiene acá: categorías fijas, precio del catálogo y ninguna
 * noción de vendedor ni de vencimiento.
 *
 * Todo lo que la card muestra sale de datos reales (`Item`, `InventoryItem`).
 * Los campos que el backend todavía no tiene —stock, descuentos, requisitos,
 * otras monedas— están declarados como opcionales para que la card los soporte
 * el día que existan, pero hoy nadie los completa y por lo tanto no se dibujan.
 */

import { isReviveItemName } from "@/lib/squad-bag";

/** Tope por compra. Evita que un stepper mande 10.000 de un click. */
export const MAX_PURCHASE_QUANTITY = 99;

export type ShopCategory = "POKEBALL" | "POTION" | "EVOLUTION_STONE" | "HELD";

export const SHOP_CATEGORIES: ShopCategory[] = [
  "POKEBALL",
  "POTION",
  "EVOLUTION_STONE",
  "HELD",
];

/**
 * Orden de vitrina: categoría → dentro de pociones, curas de HP juntas
 * (Potion…Full Restore), luego Revivir / Max Revivir, y después potas de PP.
 * Así Hyper queda al lado de Super y no intercalada con Ether.
 */
export function sortShopCatalog<
  T extends {
    type: string;
    name: string;
    buyPrice: number;
    healAmount: number | null;
  },
>(items: T[]): T[] {
  const cat = (type: string) => {
    const i = SHOP_CATEGORIES.indexOf(type as ShopCategory);
    return i === -1 ? SHOP_CATEGORIES.length : i;
  };

  /** 0 = cura HP, 1 = revive, 2 = PP / otros POTION sin healAmount. */
  const potionBand = (item: { name: string; healAmount: number | null }) => {
    if (item.healAmount != null) return 0;
    if (isReviveItemName(item.name)) return 1;
    return 2;
  };

  return [...items].sort((a, b) => {
    const byCat = cat(a.type) - cat(b.type);
    if (byCat !== 0) return byCat;

    if (a.type === "POTION" && b.type === "POTION") {
      const byBand = potionBand(a) - potionBand(b);
      if (byBand !== 0) return byBand;
      if (a.healAmount != null && b.healAmount != null) {
        const byHeal = a.healAmount - b.healAmount;
        if (byHeal !== 0) return byHeal;
      }
    }

    return a.buyPrice - b.buyPrice || a.name.localeCompare(b.name);
  });
}

/**
 * Identidad visual por categoría. El acento es un detalle —ícono del chip y
 * glow suave del sprite—, nunca un marco/card por producto.
 */
export const SHOP_CATEGORY_META: Record<
  ShopCategory,
  { icon: string; accent: string; ring: string; pedestal: string }
> = {
  POKEBALL: {
    icon: "sports_baseball",
    accent: "text-sky-300",
    ring: "border-sky-400/25",
    pedestal: "rgba(56,189,248,0.10)",
  },
  POTION: {
    icon: "healing",
    accent: "text-emerald-300",
    ring: "border-emerald-400/25",
    pedestal: "rgba(52,211,153,0.10)",
  },
  EVOLUTION_STONE: {
    icon: "diamond",
    accent: "text-fuchsia-300",
    ring: "border-fuchsia-400/25",
    pedestal: "rgba(232,121,249,0.10)",
  },
  HELD: {
    icon: "shield",
    accent: "text-violet-300",
    ring: "border-violet-400/25",
    pedestal: "rgba(167,139,250,0.10)",
  },
};

/** Moneda del precio. Hoy solo existe `coins`; el tipo deja lugar a más. */
export type ShopCurrency = "coins";

export type ShopProduct = {
  id: string;
  /** Nombre canónico del seed (`Eviolite`, `Full Restore`) — keys de sprite/lógica. */
  name: string;
  /** Etiqueta localizada para UI (`Mineral Evolutivo`, …). */
  displayName: string;
  category: ShopCategory;
  price: number;
  currency: ShopCurrency;
  /** Descripción ya resuelta y traducida. `null` si el ítem no tiene ninguna. */
  description: string | null;
  /** Unidades que el jugador ya tiene. Viene de una sola consulta agregada. */
  owned: number;
  /** Sin dato de stock en el modelo: queda declarado, hoy siempre `undefined`. */
  stock?: number;
  /** Requisito de nivel/medalla/región. El modelo todavía no los tiene. */
  requirement?: { kind: "level" | "badge" | "region"; label: string };
  /** Precio anterior y descuento, para cuando existan rotaciones. */
  discount?: { originalPrice: number; percent: number; endsAt?: string };
};

type ItemRow = {
  id: string;
  name: string;
  type: string;
  buyPrice: number;
  effectText: string | null;
  catchMultiplier: number | null;
  healAmount: number | null;
};

/** El valor centinela del seed: la curación queda acotada al HP máximo. */
const FULL_HEAL_SENTINEL = 9999;

/**
 * Descripción del producto.
 *
 * Tres fuentes, en orden:
 *
 * 1. **Derivada de datos reales** para Poké Balls (`catchMultiplier`) y
 *    pociones de HP (`healAmount`). Esos ítems no tienen `effectText` en la
 *    base y salían sin ninguna descripción, mientras los de al lado sí tenían.
 * 2. **Traducción por nombre**, cuando existe. `Item.effectText` está sembrado
 *    en español, así que en inglés y portugués la tienda mezclaba idiomas —
 *    visible en la pantalla actual: "Ether · Restaura 10 PP de un movimiento".
 * 3. **`effectText` de la base**, como último recurso, para que un ítem nuevo
 *    del seed muestre algo aunque todavía no esté traducido.
 *
 * No se inventa texto: si no hay ninguna de las tres, la card no muestra
 * descripción y el layout ya contempla ese caso.
 */
export function resolveDescription(
  item: ItemRow,
  t: {
    catchRate: (multiplier: string) => string;
    healAmount: (amount: number) => string;
    healFull: () => string;
    byName: (name: string) => string | null;
  },
): string | null {
  if (item.type === "POKEBALL" && item.catchMultiplier != null) {
    // "1.5" y no "1,5": el multiplicador se muestra como en los juegos.
    const multiplier = Number.isInteger(item.catchMultiplier)
      ? String(item.catchMultiplier)
      : item.catchMultiplier.toFixed(1);
    return t.catchRate(multiplier);
  }

  if (item.type === "POTION" && item.healAmount != null) {
    return item.healAmount >= FULL_HEAL_SENTINEL ? t.healFull() : t.healAmount(item.healAmount);
  }

  return t.byName(item.name) ?? item.effectText;
}

/** Clave i18n de un ítem: "Max Ether" → "maxEther". */
export function itemKey(name: string): string {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return parts
    .map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join("");
}

/** Nombre visible: `shop.names.<itemKey>` si existe, si no el canónico del seed. */
export function resolveItemDisplayName(
  canonicalName: string,
  lookup: (key: string) => string | null,
): string {
  return lookup(itemKey(canonicalName)) ?? canonicalName;
}

export function toProduct(
  item: ItemRow,
  owned: number,
  description: string | null,
  displayName?: string,
): ShopProduct {
  return {
    id: item.id,
    name: item.name,
    displayName: displayName ?? item.name,
    category: item.type as ShopCategory,
    price: item.buyPrice,
    currency: "coins",
    description,
    owned,
  };
}
