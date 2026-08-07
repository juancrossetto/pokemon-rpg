"use client";

import { useEffect, useRef } from "react";
import { announceCoinDelta } from "@/lib/coin-fx";
import { playLootCollectFx, type LootFlyPiece } from "@/lib/loot-fly-fx";

/**
 * Feedback de "algo pasó" al volver de una acción del mercado.
 *
 * Las acciones de `@/actions/market` no devuelven nada: redirigen con
 * `?notice=…`, así que el FX no puede salir del handler del cliente. Este
 * componente lo dispara al aterrizar, una sola vez por navegación.
 *
 * Comprar descontaba monedas sin que el contador del header se moviera, y
 * retirar una compra era un revalidate mudo — el jugador no veía llegar nada.
 */

const PC_ICON = "/nav/pc-icon.png";
const BAG_ICON = "/nav/bag-icon.png";

/**
 * Techo del delta animado. El número viene del querystring, que el jugador
 * puede editar; el saldo real lo pone el server al revalidar, así que acá sólo
 * hace falta que un `?coins=999999999` no dibuje un contador absurdo.
 */
const MAX_ANIMATED_DELTA = 1_000_000;

export function MarketCollectFx({
  notice,
  coins,
  got,
}: {
  notice: string | null;
  /** Delta crudo del querystring — se valida acá. */
  coins?: string;
  got?: string;
}) {
  const fired = useRef<string | null>(null);

  useEffect(() => {
    // Una sola vez por combinación: el efecto se re-corre en cada render del
    // layout compartido y el FX no debe repetirse mientras la URL no cambie.
    const key = `${notice ?? ""}|${coins ?? ""}|${got ?? ""}`;
    if (!notice || fired.current === key) return;
    fired.current = key;

    const delta = Number(coins);
    if (Number.isFinite(delta) && delta !== 0 && Math.abs(delta) <= MAX_ANIMATED_DELTA) {
      announceCoinDelta(delta);
    }

    if (notice !== "claimed") return;
    const pieces: LootFlyPiece[] =
      got === "pokemon"
        ? [{ src: PC_ICON, target: "avatar" }]
        : got === "item"
          ? [{ src: BAG_ICON, target: "inventory" }]
          : [];
    if (pieces.length > 0) playLootCollectFx({ pieces });
  }, [notice, coins, got]);

  return null;
}
