import { itemHdIconUrl, itemSpriteUrl } from "@/lib/item-sprites";
import { announceCoinDelta } from "@/lib/coin-fx";
import type { RewardDef } from "@/lib/events/rewards";

export type LootFlyTarget = "coins" | "energy" | "gems" | "avatar" | "inventory";

export type LootFlyPiece = {
  src: string;
  target: LootFlyTarget;
  pixelated?: boolean;
};

const COIN_HD = "/items/hd/poke-coin.png";
const ENERGY_HD = "/items/hd/energy.png";
const GEM_HD = "/items/hd/gem.png";
const FLY_MS = 680;
const STAGGER_MS = 70;

function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

/** Destino del vuelo: pastilla de recurso, Bag del dock, avatar o inventario. */
export function resolveLootTarget(kind: LootFlyTarget): { x: number; y: number } {
  if (kind === "inventory") {
    const bag = document.querySelector<HTMLElement>('[data-loot-target="inventory"]');
    if (bag && isVisible(bag)) {
      const r = bag.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }

  if (kind === "avatar") {
    const avatar = document.querySelector<HTMLElement>('[data-loot-target="avatar"]');
    if (avatar && isVisible(avatar)) {
      const r = avatar.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }

  if (kind === "coins" || kind === "energy" || kind === "gems") {
    const pill = document.querySelector(`[data-loot-target="${kind}"]`);
    if (pill && isVisible(pill)) {
      const r = pill.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }

  const inv = [...document.querySelectorAll<HTMLElement>('a[href*="/inventory"]')].find(
    isVisible,
  );
  if (inv) {
    const r = inv.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  const collection = document.querySelector<HTMLElement>(
    '[data-nav-group="collection"], a[href*="/team"]',
  );
  if (collection && isVisible(collection)) {
    const r = collection.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  return {
    x: window.innerWidth * 0.68,
    y: window.innerHeight * 0.92,
  };
}

export function pulseLootTarget(kind: LootFlyTarget): void {
  const sel =
    kind === "avatar"
      ? '[data-loot-target="avatar"]'
      : `[data-loot-target="${kind}"]`;
  const node = document.querySelector(sel);
  if (!node) return;
  node.classList.remove("loot-target-pulse");
  void (node as HTMLElement).offsetWidth;
  node.classList.add("loot-target-pulse");
  window.setTimeout(() => node.classList.remove("loot-target-pulse"), 900);
}

export function rewardToLootPiece(reward: RewardDef): LootFlyPiece {
  if (reward.kind === "item") {
    const hd = itemHdIconUrl(reward.itemName);
    return {
      src: hd ?? itemSpriteUrl(reward.itemName),
      target: "inventory",
      pixelated: !hd,
    };
  }
  if (reward.kind === "coins") {
    return { src: COIN_HD, target: "coins", pixelated: false };
  }
  if (reward.kind === "energy") {
    return { src: ENERGY_HD, target: "energy", pixelated: false };
  }
  return { src: GEM_HD, target: "gems", pixelated: false };
}

function spawnFlyer(
  piece: LootFlyPiece,
  origin: { x: number; y: number },
  delayMs: number,
): void {
  const target = resolveLootTarget(piece.target);
  const layer = document.createElement("div");
  layer.className = "loot-fly-chip";
  layer.style.left = `${origin.x}px`;
  layer.style.top = `${origin.y}px`;
  layer.setAttribute("aria-hidden", "true");

  const img = document.createElement("img");
  img.src = piece.src;
  img.alt = "";
  img.draggable = false;
  if (piece.pixelated) img.style.imageRendering = "pixelated";
  layer.appendChild(img);
  document.body.appendChild(layer);

  const dx = target.x - origin.x;
  const dy = target.y - origin.y;

  window.setTimeout(() => {
    layer.classList.add("is-flying");
    layer.style.setProperty("--loot-dx", `${dx}px`);
    layer.style.setProperty("--loot-dy", `${dy}px`);
    pulseLootTarget(piece.target);
  }, delayMs);

  window.setTimeout(() => {
    layer.remove();
  }, delayMs + FLY_MS + 40);
}

/**
 * Collect FX al reclamar: monedas → contador del header; ítems → avatar
 * (mochila). Sin modal de revelación.
 */
export function playLootCollectFx(opts: {
  pieces: LootFlyPiece[];
  origin?: { x: number; y: number };
  /** Si se pasa, dispara el +N del badge de monedas. */
  coinsDelta?: number;
}): void {
  if (typeof window === "undefined") return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (opts.coinsDelta && opts.coinsDelta !== 0) {
    announceCoinDelta(opts.coinsDelta);
  }

  if (reduced || opts.pieces.length === 0) return;

  const origin = opts.origin ?? {
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.55,
  };

  // Monedas ya tienen el contador: no hace falta clonar el PNG hacia la pastilla.
  const flyPieces = opts.pieces.filter((p) => p.target !== "coins");
  flyPieces.forEach((piece, index) => {
    spawnFlyer(piece, origin, index * STAGGER_MS);
  });
}

/** Atajo desde `RewardDef[]` (events / daily). */
export function playRewardCollectFx(
  rewards: RewardDef[],
  origin?: { x: number; y: number },
): void {
  const coinsDelta = rewards.reduce(
    (sum, r) => (r.kind === "coins" ? sum + r.amount : sum),
    0,
  );
  playLootCollectFx({
    pieces: rewards.map(rewardToLootPiece),
    origin,
    coinsDelta: coinsDelta || undefined,
  });
}
