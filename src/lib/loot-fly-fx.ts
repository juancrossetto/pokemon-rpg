import { itemHdIconUrl, itemSpriteUrl } from "@/lib/item-sprites";
import { announceCoinDelta } from "@/lib/coin-fx";
import { getUiSfxVolume } from "@/lib/battle-sfx";
import type { RewardDef } from "@/lib/events/rewards";

export type LootFlyTarget = "coins" | "energy" | "gems" | "avatar" | "inventory";

export type LootFlyPiece = {
  src: string;
  target: LootFlyTarget;
  pixelated?: boolean;
  /**
   * Unidades que representa. Los recursos vuelan moneda por moneda (o energía
   * por energía) hasta `MAX_CHIPS_PER_PIECE`; sin esto una recompensa de 500
   * monedas mandaba un solo PNG y no se leía la cantidad.
   */
  count?: number;
};

const COIN_HD = "/items/hd/poke-coin.png";
const ENERGY_HD = "/items/hd/energy.png";
const GEM_HD = "/items/hd/gem.png";
/** Igual que `loot-fly-chip-move` en globals.css — si cambia una, cambia la otra. */
const FLY_MS = 680;
const STAGGER_MS = 90;
/** Tope de chips por recurso: más que esto es ruido y no se distingue. */
const MAX_CHIPS_PER_PIECE = 10;
/** Ventana total de salida: con muchos chips el stagger se comprime. */
const SPAWN_WINDOW_MS = 460;
/** Cuántos chips suenan al aterrizar (si no, 10 chips = 10 sonidos). */
const MAX_LAND_SFX = 4;

let sfxCtx: AudioContext | null = null;

function getSfxCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sfxCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      sfxCtx = new AC();
    }
    if (sfxCtx.state === "suspended") void sfxCtx.resume();
    return sfxCtx;
  } catch {
    return null;
  }
}

function tone(
  audio: AudioContext,
  freq: number,
  when: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine",
) {
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

/** Chime corto al reclamar (respeta volumen de SFX; el mute de batalla no aplica). */
function playLootCollectSfx(pieceCount: number): void {
  const audio = getSfxCtx();
  if (!audio) return;
  const vol = getUiSfxVolume() * 0.5;
  if (vol <= 0) return;
  const now = audio.currentTime + 0.01;
  // Subida brillante + cierre suave — “agarraste el loot”.
  tone(audio, 660, now, 0.07, vol * 0.38, "triangle");
  tone(audio, 990, now + 0.055, 0.09, vol * 0.42, "sine");
  tone(audio, 1320, now + 0.12, 0.12, vol * 0.32, "sine");
  if (pieceCount > 1) {
    tone(audio, 880, now + 0.2, 0.08, vol * 0.22, "triangle");
  }
}

function playLootLandSfx(): void {
  const audio = getSfxCtx();
  if (!audio) return;
  const vol = getUiSfxVolume() * 0.4;
  if (vol <= 0) return;
  const now = audio.currentTime + 0.01;
  tone(audio, 520, now, 0.05, vol * 0.28, "sine");
  tone(audio, 780, now + 0.04, 0.07, vol * 0.22, "triangle");
}

function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

/** Fallback: esquina del header (avatar), nunca el fondo de la pantalla. */
function headerFallback(): { x: number; y: number } {
  return {
    x: Math.max(48, window.innerWidth - 52),
    y: 36,
  };
}

function centerOf(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Destino del vuelo: pastilla de recurso o avatar del header. */
export function resolveLootTarget(kind: LootFlyTarget): { x: number; y: number } {
  if (kind === "coins" || kind === "energy" || kind === "gems") {
    const pill = document.querySelector<HTMLElement>(`[data-loot-target="${kind}"]`);
    if (pill && isVisible(pill)) return centerOf(pill);
  }

  if (kind === "inventory") {
    const bag = document.querySelector<HTMLElement>('[data-loot-target="inventory"]');
    if (bag && isVisible(bag)) return centerOf(bag);
  }

  // Ítems (y fallback de inventory en desktop): avatar del header.
  const avatar = document.querySelector<HTMLElement>('[data-loot-target="avatar"]');
  if (avatar && isVisible(avatar)) return centerOf(avatar);

  return headerFallback();
}

export function pulseLootTarget(kind: LootFlyTarget): void {
  const sel =
    kind === "inventory"
      ? '[data-loot-target="inventory"], [data-loot-target="avatar"]'
      : kind === "avatar"
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
      // Avatar del header: en desktop no hay Bag del dock y el viejo fallback
      // mandaba el ítem al fondo de la pantalla.
      target: "avatar",
      pixelated: !hd,
    };
  }
  if (reward.kind === "coins") {
    return { src: COIN_HD, target: "coins", pixelated: false, count: reward.amount };
  }
  if (reward.kind === "energy") {
    return { src: ENERGY_HD, target: "energy", pixelated: false, count: reward.amount };
  }
  return { src: GEM_HD, target: "gems", pixelated: false, count: reward.amount };
}

function spawnFlyer(
  piece: LootFlyPiece,
  origin: { x: number; y: number },
  delayMs: number,
  opts: { landSfx: boolean; jitter: number } = { landSfx: true, jitter: 0 },
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
  // Arco lateral suave: perpendicular al vector de vuelo, acotado.
  const len = Math.hypot(dx, dy) || 1;
  // El jitter abre el abanico: sin esto los chips de un mismo recurso se
  // superponen exactos y parecen uno solo con motion blur.
  const arc = Math.min(56, Math.max(22, len * 0.14)) + opts.jitter;
  const arcX = (-dy / len) * arc;
  const arcY = (dx / len) * arc * 0.35 - 28 + opts.jitter * 0.4;

  window.setTimeout(() => {
    layer.classList.add("is-flying");
    layer.style.setProperty("--loot-dx", `${dx}px`);
    layer.style.setProperty("--loot-dy", `${dy}px`);
    layer.style.setProperty("--loot-arc-x", `${arcX}px`);
    layer.style.setProperty("--loot-arc-y", `${arcY}px`);
    pulseLootTarget(piece.target);
  }, delayMs);

  if (opts.landSfx) {
    window.setTimeout(() => {
      playLootLandSfx();
    }, delayMs + FLY_MS - 80);
  }

  window.setTimeout(() => {
    layer.remove();
  }, delayMs + FLY_MS + 60);
}

/**
 * Collect FX al reclamar: monedas → contador del header; ítems → avatar.
 * Sin modal de revelación.
 */
export function playLootCollectFx(opts: {
  pieces: LootFlyPiece[];
  origin?: { x: number; y: number };
  /** Si se pasa, dispara el +N/−N del badge de monedas. */
  coinsDelta?: number;
  /**
   * Se llama cuando el primer chip toca el header. Sirve para que el contador
   * arranque a subir junto con la llegada y no antes (ej. el flush de energía
   * de la tienda).
   */
  onFirstLanding?: () => void;
}): void {
  if (typeof window === "undefined") return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced || opts.pieces.length === 0) {
    // Sin vuelo no hay nada que esperar: el contador sube ya.
    if (opts.coinsDelta) announceCoinDelta(opts.coinsDelta);
    opts.onFirstLanding?.();
    return;
  }

  const origin = opts.origin ?? {
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.45,
  };

  /*
    Un chip por unidad (topeado): monedas y energía se arrastran de a una hasta
    la pastilla del header, que es lo que hace legible la cantidad. Antes las
    monedas ni siquiera volaban — se filtraban acá porque el contador ya se
    animaba solo, pero el contador sin el vuelo no muestra de dónde salieron.
  */
  const chips: LootFlyPiece[] = [];
  for (const piece of opts.pieces) {
    const units = Math.max(1, Math.min(MAX_CHIPS_PER_PIECE, Math.floor(piece.count ?? 1)));
    for (let i = 0; i < units; i++) chips.push(piece);
  }
  if (chips.length === 0) return;

  playLootCollectSfx(chips.length);

  // Con pocos chips el stagger es el de siempre; con muchos se comprime para
  // que la ráfaga entera entre en la misma ventana.
  const stagger = Math.min(STAGGER_MS, Math.max(40, SPAWN_WINDOW_MS / chips.length));

  chips.forEach((piece, index) => {
    spawnFlyer(piece, origin, index * stagger, {
      landSfx: index < MAX_LAND_SFX,
      // Abanico alterno a los costados, creciendo hacia el medio de la ráfaga.
      jitter: (index % 2 === 0 ? 1 : -1) * (index % 5) * 9,
    });
  });

  // El contador arranca con la llegada del primer chip, no con el click.
  const landAt = Math.max(0, FLY_MS - 60);
  window.setTimeout(() => {
    if (opts.coinsDelta) announceCoinDelta(opts.coinsDelta);
    opts.onFirstLanding?.();
  }, landAt);
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
