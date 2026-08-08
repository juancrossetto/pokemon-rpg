/**
 * Dónde se puede conseguir cada objeto en este juego.
 *
 * No hay campo en BD: las fuentes viven en tablas de recompensa
 * (tienda, exploración, objetivos, gimnasios, torre, eventos). Este módulo
 * las concentra para la UI del inventario sin arrastrar Prisma.
 */

import { EVENT_ITEM_NAMES } from "@/lib/campaign/events";
import { DAILY_CYCLE } from "@/lib/events/daily";
import { GYM_TM_REWARD_BY_TYPE } from "@/lib/gym-tm-rewards";
import { SHOP_ITEM_CATEGORIES } from "@/lib/shop";

/** Clave de `campaign.locations.*` para el gimnasio que regala la MT. */
const GYM_TYPE_LOCATION: Record<string, string> = {
  rock: "pewter_gym",
  water: "cerulean_gym",
  electric: "vermilion_gym",
  grass: "celadon_gym",
  poison: "fuchsia_gym",
  psychic: "saffron_gym",
  fire: "cinnabar_gym",
  ground: "viridian_gym",
};

const MOVE_TO_GYM_LOCATION: Record<string, string> = Object.fromEntries(
  Object.entries(GYM_TM_REWARD_BY_TYPE).map(([type, move]) => [
    move,
    GYM_TYPE_LOCATION[type]!,
  ]),
);

const EXPLORE_ITEMS = new Set<string>(EVENT_ITEM_NAMES);

/** Objetivos de zona (Viaje): balls / caramelos / revivir según el hito. */
const ZONE_OBJECTIVE_ITEMS = new Set([
  "Poke Ball",
  "Great Ball",
  "Ultra Ball",
  "Rare Candy",
  "Revive",
  "Max Revive",
]);

const TOWER_ITEMS = new Set(["Potion", "Revive", "Max Revive"]);

function itemNamesFromBundles(
  bundles: ReadonlyArray<ReadonlyArray<{ kind: string; itemName?: string }>>,
): Set<string> {
  const out = new Set<string>();
  for (const bundle of bundles) {
    for (const reward of bundle) {
      if (reward.kind === "item" && reward.itemName) out.add(reward.itemName);
    }
  }
  return out;
}

const DAILY_ITEMS = itemNamesFromBundles(DAILY_CYCLE.slots.map((s) => s.rewards));

/** Semanales + limitados (nombres que aparecen en `events/weekly` y `limited`). */
const EVENT_ITEMS = new Set([
  "Poke Ball",
  "Great Ball",
  "Ultra Ball",
  "Potion",
  "Super Potion",
  "Full Restore",
  "Oran Berry",
  "Rare Candy",
]);

const WEEKLY_ITEMS = new Set(["Poke Ball", "Potion", "Great Ball", "Rare Candy"]);

export type ItemSourceRef =
  | { kind: "shop" }
  | { kind: "gems" }
  | { kind: "explore" }
  | { kind: "zoneObjectives" }
  | { kind: "gym"; locationKey: string }
  | { kind: "tower" }
  | { kind: "daily" }
  | { kind: "weekly" }
  | { kind: "events" }
  | { kind: "market" };

export type ItemSourceInput = {
  name: string;
  type: string;
  buyPrice: number;
  gemPrice?: number | null;
  /** Nombre canónico del movimiento (MACHINE), p. ej. `rock-slide`. */
  moveName?: string | null;
};

/**
 * Fuentes ordenadas de más “mapa / aventura” a más genéricas.
 * Siempre incluye mercado si hay al menos una otra, o sola si no hay nada más
 * (catálogo puro de trading).
 */
export function resolveItemSources(item: ItemSourceInput): ItemSourceRef[] {
  const sources: ItemSourceRef[] = [];

  if (item.name === "Linking Cord" || (item.gemPrice != null && item.gemPrice > 0)) {
    sources.push({ kind: "gems" });
  } else if (
    item.buyPrice > 0 &&
    SHOP_ITEM_CATEGORIES.includes(item.type as (typeof SHOP_ITEM_CATEGORIES)[number])
  ) {
    sources.push({ kind: "shop" });
  }

  if (EXPLORE_ITEMS.has(item.name)) {
    sources.push({ kind: "explore" });
  }

  if (ZONE_OBJECTIVE_ITEMS.has(item.name)) {
    sources.push({ kind: "zoneObjectives" });
  }

  if (item.moveName && MOVE_TO_GYM_LOCATION[item.moveName]) {
    sources.push({
      kind: "gym",
      locationKey: MOVE_TO_GYM_LOCATION[item.moveName]!,
    });
  }

  if (item.name === "Exp. Share") {
    sources.push({ kind: "gym", locationKey: "pewter_gym" });
  }

  if (TOWER_ITEMS.has(item.name)) {
    sources.push({ kind: "tower" });
  }

  if (DAILY_ITEMS.has(item.name)) {
    sources.push({ kind: "daily" });
  }

  if (WEEKLY_ITEMS.has(item.name)) {
    sources.push({ kind: "weekly" });
  }

  if (EVENT_ITEMS.has(item.name)) {
    sources.push({ kind: "events" });
  }

  // Mercado siempre: es el backstop entre jugadores.
  sources.push({ kind: "market" });

  return dedupe(sources);
}

function dedupe(sources: ItemSourceRef[]): ItemSourceRef[] {
  const seen = new Set<string>();
  const out: ItemSourceRef[] = [];
  for (const s of sources) {
    const key = s.kind === "gym" ? `gym:${s.locationKey}` : s.kind;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function formatItemSource(
  source: ItemSourceRef,
  labels: {
    shop: string;
    gems: string;
    explore: string;
    zoneObjectives: string;
    tower: string;
    daily: string;
    weekly: string;
    events: string;
    market: string;
    gym: (locationName: string) => string;
  },
  locationName: (locationKey: string) => string,
): string {
  switch (source.kind) {
    case "shop":
      return labels.shop;
    case "gems":
      return labels.gems;
    case "explore":
      return labels.explore;
    case "zoneObjectives":
      return labels.zoneObjectives;
    case "tower":
      return labels.tower;
    case "daily":
      return labels.daily;
    case "weekly":
      return labels.weekly;
    case "events":
      return labels.events;
    case "market":
      return labels.market;
    case "gym":
      return labels.gym(locationName(source.locationKey));
  }
}
