import type { ShopProduct } from "@/lib/shop";

/** Producto virtual de la tienda oficial (no vive en `Item` / inventario). */
export const ENERGY_PACK_PRODUCT_ID = "shop:energy-pack";
export const ENERGY_PACK_NAME = "Energy Pack";
export const ENERGY_PACK_PRICE = 300;
/** Energía por paquete (acotada a energyMax al aplicar). */
export const ENERGY_PACK_ENERGY = 10;

export function isEnergyPackProductId(id: string): boolean {
  return id === ENERGY_PACK_PRODUCT_ID;
}

export function buildEnergyPackProduct(opts: {
  displayName: string;
  description: string;
  requirement?: ShopProduct["requirement"];
}): ShopProduct {
  return {
    id: ENERGY_PACK_PRODUCT_ID,
    name: ENERGY_PACK_NAME,
    displayName: opts.displayName,
    category: "ENERGY",
    price: ENERGY_PACK_PRICE,
    currency: "coins",
    description: opts.description,
    owned: 0,
    grantEnergy: ENERGY_PACK_ENERGY,
    hideOwned: true,
    requirement: opts.requirement,
  };
}
