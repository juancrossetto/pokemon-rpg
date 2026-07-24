// Reglas de economía del mercado (módulo de intercambio del dossier, fase 5).
// Viven acá y no en el server action porque un archivo "use server" solo puede
// exportar funciones async — y estos valores también los necesita la UI.

export const TEAM_SIZE = 6;

/** Comisión que se le descuenta al vendedor cuando la venta se concreta. */
export const COMMISSION_RATE = 0.05;

/**
 * Tarifa que se cobra al publicar, no reembolsable. Cumple dos funciones:
 * es otro sumidero de monedas y encarece el lavado de moneda entre cuentas
 * (publicar algo carísimo y comprárselo a uno mismo desde una cuenta alterna
 * para transferir el saldo).
 */
export const LISTING_FEE_RATE = 0.02;

export const MIN_PRICE = 1;
export const MAX_PRICE = 1_000_000;
export const LISTING_TTL_DAYS = 7;

/** A partir de este precio la compra pide confirmación explícita al comprador. */
export const CONFIRM_PRICE_THRESHOLD = 10_000;

export function commissionFor(price: number): number {
  return Math.floor(price * COMMISSION_RATE);
}

export function proceedsFor(price: number): number {
  return price - commissionFor(price);
}

/** Mínimo de 1 moneda: publicar nunca sale gratis, ni con precios de 1. */
export function listingFeeFor(price: number): number {
  return Math.max(1, Math.floor(price * LISTING_FEE_RATE));
}

export function listingExpiry(from: number = Date.now()): Date {
  return new Date(from + LISTING_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isPriceValid(price: number): boolean {
  return Number.isInteger(price) && price >= MIN_PRICE && price <= MAX_PRICE;
}
