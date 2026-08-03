import { itemHdIconUrl } from "@/lib/item-hd-icons";

export { itemHdIconUrl } from "@/lib/item-hd-icons";

const ITEM_SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items";


/**
 * Convierte el nombre del ítem (seed) al slug kebab-case del CDN de PokeAPI.
 *
 * La puntuación se descarta: "King's Rock" daba `king's-rock.png`, que no
 * existe — el archivo del CDN es `kings-rock.png`. Afectaba a cualquier ítem
 * con apóstrofe o punto, tanto en la tienda como en el mercado.
 */
export function itemSpriteSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Tipo del movimiento por código TM — PokeAPI no tiene `tm22.png`, solo
 * `tm-grass.png`, `tm-fire.png`, etc. (un disco por tipo, no por número).
 */
const TM_TYPE_BY_CODE: Record<string, string> = {
  TM01: "normal",
  TM02: "normal",
  TM03: "normal",
  TM04: "normal",
  TM05: "normal",
  TM06: "poison",
  TM07: "normal",
  TM08: "normal",
  TM09: "normal",
  TM10: "normal",
  TM11: "water",
  TM12: "water",
  TM13: "ice",
  TM14: "ice",
  TM15: "normal",
  TM16: "normal",
  TM17: "fighting",
  TM18: "fighting",
  TM19: "fighting",
  TM20: "normal",
  TM21: "grass",
  TM22: "grass",
  TM23: "dragon",
  TM24: "electric",
  TM25: "electric",
  TM26: "ground",
  TM27: "ground",
  TM28: "ground",
  TM29: "psychic",
  TM30: "psychic",
  TM31: "normal",
  TM32: "normal",
  TM33: "psychic",
  TM34: "normal",
  TM35: "normal",
  TM36: "normal",
  TM37: "normal",
  TM38: "fire",
  TM39: "normal",
  TM40: "normal",
  TM41: "normal",
  TM42: "psychic",
  TM43: "flying",
  TM44: "psychic",
  TM45: "electric",
  TM46: "psychic",
  TM47: "normal",
  TM48: "rock",
  TM49: "normal",
  TM50: "normal",
};

/** URL del sprite de ítem en el CDN de PokeAPI/sprites (pixel). */
export function itemSpriteUrl(name: string): string {
  const code = name.trim().toUpperCase();

  const tmType = TM_TYPE_BY_CODE[code];
  if (tmType) {
    return `${ITEM_SPRITE_BASE}/tm-${tmType}.png`;
  }

  const hm = code.match(/^HM(\d+)$/);
  if (hm) {
    return `${ITEM_SPRITE_BASE}/hm${hm[1].padStart(2, "0")}.png`;
  }

  return `${ITEM_SPRITE_BASE}/${itemSpriteSlug(name)}.png`;
}

/**
 * Icono para UI moderna: HD local si existe, si no cae al pixel de PokeAPI.
 * Usar en tienda / daily reward / popups — no en combate pixel.
 */
export function itemDisplayUrl(
  name: string,
  style: "hd" | "pixel" = "hd",
): string {
  if (style === "hd") {
    return itemHdIconUrl(name) ?? itemSpriteUrl(name);
  }
  return itemSpriteUrl(name);
}
