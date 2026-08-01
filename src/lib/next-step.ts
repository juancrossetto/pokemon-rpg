/**
 * Qué debería hacer el jugador ahora — una sola respuesta.
 *
 * El home ya muestra la expedición, el escuadrón, el ranking, las medallas y el
 * regalo diario, y la navegación ofrece diez destinos al mismo nivel. Con la
 * historia en curso eso funciona porque el hero de expedición es un CTA único y
 * evidente; el problema aparece en los extremos del recorrido:
 *
 * - **Sin equipo**: el home lleva a `/starter`, pero cualquier otra pantalla no.
 * - **Con las 8 medallas**: el hito pasa a ser el Alto Mando, que **no** se
 *   lista en `/gyms` (`computeGymStatuses` filtra `isElite`). El CTA de la
 *   expedición apuntaba ahí igual, así que el jugador aterrizaba en un hub que
 *   se ve terminado y no encontraba a dónde seguir.
 * - **Campeón**: `nextMilestone` devuelve `complete` y el CTA queda en "ver
 *   viaje" — un final sin salida, con la Torre y el PvP ya desbloqueados pero
 *   sin que nada los proponga.
 *
 * Este módulo resuelve la etapa a partir de datos que el home ya tiene y
 * devuelve **un** paso. `standalone: false` significa "no dibujes una card: el
 * hero de expedición ya es la acción recomendada" — la regla que evita sumar un
 * segundo CTA compitiendo con el primero.
 *
 * Es puro a propósito (sin Prisma, sin next-intl): lo consumen tanto el Server
 * Component del home como componentes de cliente.
 */

import type { CampaignMilestone } from "@/lib/campaign/types";

export type PlayerStage = "rookie" | "adventuring" | "elite" | "champion";

export type NextStepId = "choose_starter" | "story" | "elite_four" | "tower" | "pvp";

export type NextStep = {
  id: NextStepId;
  stage: PlayerStage;
  /** Claves bajo `nextStep.` en los mensajes. */
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  href: string;
  /** Material Symbols, la familia que usa el resto de la app. */
  icon: string;
  /**
   * `false` = el hero de expedición ya expresa este paso y la card no se
   * dibuja. Sin esta distinción el home mostraría dos CTA para lo mismo.
   */
  standalone: boolean;
  /** Destino secundario opcional (el endgame ofrece dos frentes, no uno). */
  secondary?: { ctaKey: string; href: string; icon: string };
};

export type NextStepContext = {
  /** Pokémon en el equipo activo. 0 = todavía no eligió inicial. */
  teamSize: number;
  /** Medallas de gimnasio regulares (excluye sellos del Alto Mando). */
  badgeCount: number;
  /** Cuántas medallas regulares tiene la región (8 en Kanto). */
  totalBadges: number;
  milestone: CampaignMilestone | null;
  /**
   * Ruta del gimnasio del Alto Mando pendiente. El hub `/gyms` no los lista,
   * así que sin esto el CTA no tendría a dónde ir.
   */
  eliteGymHref?: string | null;
};

export function resolvePlayerStage(ctx: NextStepContext): PlayerStage {
  if (ctx.teamSize <= 0) return "rookie";
  if (ctx.milestone?.kind === "complete") return "champion";
  // Tener las 8 medallas no alcanza: entre la última y Lorelei todavía hay
  // stages de historia (Calle Victoria). Si sólo se mirara el contador, la card
  // diría "te espera el Alto Mando" mientras el hero de expedición dice "seguí
  // explorando" — dos instrucciones distintas para el mismo momento.
  if (
    ctx.badgeCount >= ctx.totalBadges &&
    isEliteMilestone(ctx.milestone ?? null, ctx.totalBadges)
  ) {
    return "elite";
  }
  return "adventuring";
}

/**
 * El hito actual es un gimnasio del Alto Mando.
 *
 * Se deduce del orden: los 8 gimnasios de medalla son 1..8 y los nodos élite
 * siguen numerando desde ahí (ver `KANTO_REGION`). Comparar contra
 * `totalBadges` evita duplicar la lista de ids élite en un segundo lugar.
 */
export function isEliteMilestone(
  milestone: CampaignMilestone | null,
  totalBadges: number,
): milestone is Extract<CampaignMilestone, { kind: "gym" }> {
  return milestone?.kind === "gym" && milestone.gymOrder > totalBadges;
}

export function getNextStep(ctx: NextStepContext): NextStep {
  const stage = resolvePlayerStage(ctx);

  if (stage === "rookie") {
    return {
      id: "choose_starter",
      stage,
      titleKey: "starterTitle",
      bodyKey: "starterBody",
      ctaKey: "starterCta",
      href: "/starter",
      icon: "catching_pokemon",
      standalone: true,
    };
  }

  if (stage === "champion") {
    return {
      id: "tower",
      stage,
      titleKey: "championTitle",
      bodyKey: "championBody",
      ctaKey: "championCta",
      href: "/tower",
      icon: "apartment",
      standalone: true,
      secondary: { ctaKey: "championSecondaryCta", href: "/pvp", icon: "swords" },
    };
  }

  if (stage === "elite") {
    return {
      id: "elite_four",
      stage,
      titleKey: "eliteTitle",
      bodyKey: "eliteBody",
      ctaKey: "eliteCta",
      // Sin ruta concreta cae al viaje, que sí muestra los nodos del Alto Mando.
      href: ctx.eliteGymHref ?? "/campaign",
      icon: "workspace_premium",
      standalone: true,
      secondary: { ctaKey: "eliteSecondaryCta", href: "/tower", icon: "apartment" },
    };
  }

  return {
    id: "story",
    stage,
    titleKey: "storyTitle",
    bodyKey: "storyBody",
    ctaKey: "storyCta",
    href: "/campaign",
    icon: "map",
    standalone: false,
  };
}
