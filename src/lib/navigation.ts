/**
 * Arquitectura de navegación — fuente única para desktop y mobile.
 *
 * Antes la navegación estaba escrita cuatro veces a mano en `site-header.tsx`
 * (`primary`, `desktopLinks`, `desktopMoreLinks`, `moreLinks`) y ya había
 * derivado: `/pokedex` era link principal en desktop y vivía dentro de "Más" en
 * mobile; `/team`, `/pc` e `/inventory` aparecían a la vez en el menú del avatar
 * y en "Más". Acá se define una vez y cada superficie la representa a su manera.
 *
 * Los grupos agrupan por dominio, no por frecuencia de uso: es lo que permite
 * que un módulo nuevo tenga un lugar obvio en vez de terminar en un cajón
 * llamado "Más".
 */

export type NavItem = {
  id: string;
  /** Clave bajo `nav.` en los mensajes. */
  labelKey: string;
  /** Clave de la descripción corta del dropdown. Opcional. */
  descriptionKey?: string;
  href: string;
  /** Material Symbols — la misma familia que usa el resto de la app. */
  icon: string;
  /** Ícono custom (PNG) para drawer mobile / superficies que lo soporten. */
  iconSrc?: string;
  /**
   * Rutas que marcan este destino como activo, además de `href`. Para cuando
   * una sección vive en más de un prefijo.
   */
  matchRoutes?: string[];
  /**
   * Contador de acciones pendientes. Lo resuelve quien arma las etiquetas —la
   * config no consulta la base— y se muestra tanto en el dropdown como en el
   * grupo padre.
   */
  badgeKey?: "eventsPending";
  /** Preparado para cuando exista sistema de flags; hoy nadie lo setea. */
  hidden?: boolean;
  /** Visible pero no navegable — "Próximamente" del roadmap. */
  disabled?: boolean;
};

export type NavGroup = {
  id: string;
  labelKey: string;
  icon: string;
  children: NavItem[];
  /** Prefijos extra que activan el grupo aunque no sean de ningún hijo. */
  matchRoutes?: string[];
};

/**
 * Grupos de la barra principal.
 *
 * Decisiones que vale la pena dejar escritas:
 *
 * - **Gimnasios y Torre van en Aventura, no en Combate.** Son hitos de
 *   progreso (medallas / ascenso semanal). Combate agrupa lo que se juega por
 *   enfrentarse, no por avanzar.
 * - **`/battle` se llama "Batalla salvaje".** La ruta no cambia; el label sí,
 *   porque "Batalla" a secas no distinguía entre el PvE de exploración y el
 *   PvP. La pantalla busca Pokémon salvajes en la zona de farmeo elegida en
 *   el viaje, y el nombre ahora lo dice.
 * - **Mercado y Tienda viven en un solo hub (`/market`).** Misma economía de
 *   monedas, dos modos: tienda oficial (`?tab=shop`) y P2P (browse/sell/…).
 *   Fusionar las UIs limpia el menú; los backends siguen separados.
 * - **Ranking vive en Comunidad.** Es comparación social entre entrenadores;
 *   el ranking de clanes sigue dentro de `/clans`.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "adventure",
    labelKey: "groups.adventure",
    icon: "explore",
    children: [
      {
        id: "campaign",
        labelKey: "campaign",
        descriptionKey: "desc.campaign",
        href: "/campaign",
        icon: "map",
        iconSrc: "/nav/map-icon.png?v=4",
      },
      {
        id: "gyms",
        labelKey: "gyms",
        descriptionKey: "desc.gyms",
        href: "/gyms",
        icon: "military_tech",
        iconSrc: "/nav/gym-icon.png?v=4",
      },
      {
        id: "tower",
        labelKey: "tower",
        descriptionKey: "desc.tower",
        href: "/tower",
        icon: "apartment",
        iconSrc: "/nav/tower-icon.png?v=4",
      },
      {
        id: "events",
        labelKey: "events",
        descriptionKey: "desc.events",
        href: "/events",
        icon: "redeem",
        iconSrc: "/nav/event-icon.png?v=4",
        // El contador queda para cuando el header calcule pendientes; hoy nadie
        // lo llena, así que no se pinta ningún badge.
        badgeKey: "eventsPending",
      },
    ],
  },
  {
    id: "combat",
    labelKey: "groups.combat",
    icon: "swords",
    children: [
      {
        id: "battle",
        labelKey: "battleWild",
        descriptionKey: "desc.battleWild",
        href: "/battle",
        icon: "sports_martial_arts",
        iconSrc: "/nav/battle-wild-icon.png?v=4",
      },
      {
        id: "pvp",
        labelKey: "pvp",
        descriptionKey: "desc.pvp",
        href: "/pvp",
        icon: "sports_mma",
        iconSrc: "/nav/pvp-icon.png?v=4",
      },
    ],
  },
  {
    id: "collection",
    labelKey: "groups.collection",
    // `catching_pokemon` parece el ícono obvio, pero la ligadura no resuelve en
    // la versión de Material Symbols que sirve Google Fonts acá: se renderizaba
    // el texto crudo "CATCHING_POKEMON" a lo ancho de la bottom bar.
    icon: "pets",
    children: [
      {
        id: "team",
        labelKey: "team",
        descriptionKey: "desc.team",
        href: "/team",
        icon: "group",
        iconSrc: "/nav/team-icon.png?v=4",
        // El PC vive como tab dentro de /team; la ruta vieja redirige.
        matchRoutes: ["/pc"],
      },
      {
        id: "pokedex",
        labelKey: "pokedex",
        descriptionKey: "desc.pokedex",
        href: "/pokedex",
        icon: "auto_stories",
        iconSrc: "/nav/collection-icon.png?v=4",
      },
      {
        id: "inventory",
        labelKey: "inventory",
        descriptionKey: "desc.inventory",
        href: "/inventory",
        icon: "backpack",
        iconSrc: "/nav/bag-icon.png?v=4",
      },
    ],
  },
  {
    id: "trade",
    labelKey: "groups.trade",
    icon: "storefront",
    children: [
      {
        id: "market",
        labelKey: "market",
        descriptionKey: "desc.market",
        href: "/market",
        icon: "storefront",
        iconSrc: "/nav/shop-icon.png?v=4",
        matchRoutes: ["/shop"],
      },
    ],
  },
  {
    id: "community",
    labelKey: "groups.community",
    icon: "groups",
    children: [
      {
        id: "friends",
        labelKey: "friends",
        descriptionKey: "desc.friends",
        href: "/friends",
        icon: "handshake",
        iconSrc: "/nav/friends-icon.png?v=4",
      },
      {
        id: "clans",
        labelKey: "clans",
        descriptionKey: "desc.clans",
        href: "/clans",
        icon: "groups",
        iconSrc: "/nav/clan-icon.png?v=4",
      },
      {
        id: "ranking",
        labelKey: "ranking",
        descriptionKey: "desc.ranking",
        href: "/ranking",
        icon: "trophy",
        iconSrc: "/nav/ranking-icon.png?v=4",
      },
    ],
  },
];

/** Inicio va suelto: es un destino, no una categoría. */
export const NAV_HOME: NavItem = {
  id: "home",
  labelKey: "home",
  href: "/",
  icon: "home",
  iconSrc: "/nav/home-icon.png?v=4",
};

/**
 * Destinos de la bottom bar de mobile: los cuatro de uso frecuente más el
 * botón de menú, que abre el drawer con la navegación completa.
 *
 * Se eligen por id contra `NAV_GROUPS` en vez de repetir las rutas, así un
 * cambio de href no deja la bottom bar apuntando a una ruta vieja.
 */
export const MOBILE_BAR_GROUPS = ["adventure", "combat", "collection"] as const;

export function visibleChildren(group: NavGroup): NavItem[] {
  return group.children.filter((child) => !child.hidden);
}

/** Todas las URLs de íconos PNG de la nav (para preload en mobile). */
export function allNavIconSrcs(): string[] {
  const urls = new Set<string>();
  if (NAV_HOME.iconSrc) urls.add(NAV_HOME.iconSrc);
  for (const group of NAV_GROUPS) {
    for (const child of visibleChildren(group)) {
      if (child.iconSrc) urls.add(child.iconSrc);
    }
  }
  // Tabs de la bottom bar (grupo, no ítem).
  urls.add("/nav/adventure-icon.png?v=4");
  urls.add("/nav/battle-icon.png?v=4");
  urls.add("/nav/collection-icon.png?v=4");
  urls.add("/nav/menu-icon.png?v=4");
  return [...urls];
}

/** ¿La ruta actual cae dentro de este destino? */
export function itemMatches(pathname: string, item: NavItem): boolean {
  const candidates = [item.href, ...(item.matchRoutes ?? [])];
  return candidates.some((route) =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * ¿La ruta actual cae dentro del grupo? Es lo que hace que estando en `/pvp`
 * se marque "Combate", que era uno de los pedidos explícitos.
 */
export function groupMatches(pathname: string, group: NavGroup): boolean {
  if (group.matchRoutes?.some((route) => pathname.startsWith(route))) return true;
  return visibleChildren(group).some((child) => itemMatches(pathname, child));
}
