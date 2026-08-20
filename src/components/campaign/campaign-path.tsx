"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useTranslations } from "next-intl";
import { ZoneIcon } from "@/components/zone-icons";
import { campaignMapHasArt, campaignMapSrc } from "@/lib/campaign/maps";
import type { Chapter } from "@/lib/campaign/chapters";
import type { MapLocation } from "@/lib/campaign/map-selection";
import type { CampaignLocationKind } from "@/lib/campaign/types";
import type { CampaignNodeStatus } from "@/lib/campaign";

/**
 * El recorrido del capítulo, dibujado como camino.
 *
 * Reemplaza la lista vertical de zonas. La lista decía lo mismo pero se leía
 * como un índice: filas de altura pareja donde ninguna parada pesa más que
 * otra. Un capítulo es un *camino* —hay un antes, un acá y un después— y eso
 * lo comunica la forma antes que el texto.
 *
 * Los contadores por zona (entrenadores, Pokédex, niveles) ya no viven acá:
 * están en el panel de la derecha, que es donde el detalle tiene lugar para
 * respirar. El nodo se queda con lo que necesita para orientar de un vistazo
 * —arte, nombre, estado— y, si está bloqueado, el requisito para abrirlo.
 */

/** Zigzag horizontal. Se cicla, así sirve para capítulos de cualquier largo. */
const X_PATTERN = [22, 71, 27, 74, 24, 69];

export type CampaignPathNode = {
  zone: MapLocation;
  status: CampaignNodeStatus;
  /** Único nodo recomendado del capítulo. */
  isNext: boolean;
  /** Dónde está parado el jugador ahora. */
  isFarming: boolean;
  /** Texto corto que explica el candado. `null` si no está bloqueado. */
  requirement: string | null;
};

function kindOf(zone: MapLocation): CampaignLocationKind {
  return zone.kindKey.replace("kinds.", "") as CampaignLocationKind;
}

/**
 * Posición horizontal de cada parada, en porcentaje.
 *
 * El gimnasio se centra: cierra el capítulo y un cierre descentrado se lee
 * como una parada más en vez de como el final del camino.
 */
function xFor(index: number, total: number, isGym: boolean): number {
  if (isGym && index === total - 1) return 50;
  return X_PATTERN[index % X_PATTERN.length];
}

/**
 * Curva entre dos paradas.
 *
 * Los puntos de control salen en vertical desde cada extremo, lo que produce
 * una S suave en lugar de una diagonal: el trazo entra y sale de los nodos por
 * arriba y por abajo, que es como se lee un camino que baja.
 */
function segmentPath(x1: number, y1: number, x2: number, y2: number): string {
  const bow = (y2 - y1) * 0.55;
  return `M ${x1} ${y1} C ${x1} ${y1 + bow}, ${x2} ${y2 - bow}, ${x2} ${y2}`;
}

export function CampaignPath({
  chapter,
  nodes,
  selectedZoneId,
  leadSpriteUrl,
  onPick,
}: {
  chapter: Chapter;
  nodes: CampaignPathNode[];
  selectedZoneId: string | null;
  /**
   * Sprite del líder del equipo, parado sobre la zona actual.
   *
   * Es lo que convierte el recorrido en "mi viaje" en vez de un índice de
   * zonas: el muñeco marca dónde estás con más fuerza que cualquier borde de
   * color, porque es *tu* Pokémon.
   */
  leadSpriteUrl: string | null;
  onPick: (zoneId: string) => void;
}) {
  const t = useTranslations("campaign");
  const total = nodes.length;
  if (total === 0) return null;

  const lastIsGym = kindOf(nodes[total - 1].zone) === "gym";
  /*
    Coordenadas del viewBox: X en porcentaje (0–100) e Y en unidades de tramo
    (0–total-1) escaladas a 100. El SVG va con `preserveAspectRatio: none`, así
    que estas mismas cifras sirven para posicionar los nodos en CSS.
  */
  const points = nodes.map((node, i) => ({
    x: xFor(i, total, lastIsGym),
    y: total === 1 ? 50 : (i / (total - 1)) * 100,
    node,
  }));

  return (
    <div
      className="campaign-path"
      style={{
        // Medio tramo de aire arriba y abajo para que el primer y el último
        // nodo no queden cortados por el borde del contenedor.
        height: `calc(var(--path-row) * ${Math.max(1, total - 1)} + var(--path-row))`,
      }}
    >
      <svg
        className="campaign-path__trail"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {points.slice(0, -1).map((p, i) => {
          const next = points[i + 1];
          /*
            El tramo se pinta como recorrido si la parada de la que sale ya
            está cerrada. Colorear por segmento en vez de recortar una curva
            larga evita tener que medir longitudes de bezier a mano.
          */
          const done =
            p.node.status === "completed" || p.node.status === "reward_pending";
          return (
            <path
              key={`${p.node.zone.id}-seg`}
              className={`campaign-path__seg campaign-path__seg--${done ? "done" : "todo"}`}
              d={segmentPath(p.x, p.y, next.x, next.y)}
            />
          );
        })}
      </svg>

      <ol className="contents">
        {points.map(({ x, y, node }) => {
          const { zone, status, isNext, isFarming, requirement } = node;
          const kind = kindOf(zone);
          const isGym = kind === "gym";
          const locked = status === "locked";
          const done = status === "completed" || status === "reward_pending";
          const current = isFarming || status === "current" || status === "in_progress";
          const hasArt = campaignMapHasArt(zone.id);
          const label = t(zone.nameKey);

          const state = locked
            ? "locked"
            : current
              ? "current"
              : done
                ? "done"
                : isNext
                  ? "next"
                  : "idle";

          return (
            <li
              key={zone.id}
              /* `CampaignJourney` busca este atributo para centrar el sendero
                 en la zona enfocada al cambiar de capítulo. */
              data-zone-row={zone.id}
              className={[
                "campaign-path__node",
                `campaign-path__node--${state}`,
                isGym ? "campaign-path__node--gym" : "",
                selectedZoneId === zone.id ? "campaign-path__node--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                left: `${x}%`,
                // Mismo cálculo que el alto del contenedor: medio tramo de
                // margen más `y` tramos completos.
                top: `calc(var(--path-row) * 0.5 + var(--path-row) * ${
                  total === 1 ? 0 : (y / 100) * (total - 1)
                })`,
              }}
            >
              {current ? (
                <span className="campaign-path__chip campaign-path__chip--play">
                  {t("playChip")}
                </span>
              ) : isNext && !locked ? (
                <span className="campaign-path__chip campaign-path__chip--next">
                  {t("nextChip")}
                </span>
              ) : null}

              <button
                type="button"
                className="campaign-path__bubble"
                onClick={() => onPick(zone.id)}
                aria-label={label}
                aria-current={selectedZoneId === zone.id ? "true" : undefined}
              >
                {hasArt ? (
                  <Image
                    src={campaignMapSrc(zone.id, true)}
                    alt=""
                    width={140}
                    height={140}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ZoneIcon kind={kind} className="h-1/2 w-1/2 text-white/45" />
                )}
                {locked ? (
                  <span className="campaign-path__lock" aria-hidden>
                    <span className="material-symbols-outlined text-[20px]!">lock</span>
                  </span>
                ) : null}
              </button>

              {isFarming && leadSpriteUrl ? (
                <span className="campaign-path__hiker" aria-hidden>
                  <Image src={leadSpriteUrl} alt="" width={72} height={72} />
                </span>
              ) : null}

              <span className="campaign-path__label">{label}</span>
              {locked && requirement ? (
                <span className="campaign-path__req">{requirement}</span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <span className="sr-only">
        {t("chapterPathSummary", {
          done: chapter.zones.filter((z) => z.completedStages >= z.totalStages).length,
          total: chapter.zones.length,
        })}
      </span>
    </div>
  );
}
