/**
 * DTOs del hub de inicio. Sin Prisma: el client importa estos tipos.
 */

export type HomeIdentity = {
  username: string;
  avatarId: string | null;
  /** Retrato compacto (`*1`) — chips / fallback. */
  avatarSrc: string | null;
  /** Cuerpo completo (`*2`). */
  avatarProfileSrc: string | null;
  /** `*2` recortado al bounding box — mejor para el banner. */
  avatarStageSrc: string | null;
  level: number;
  titleId: string;
  rankTierId: string;
  /** Liga clasificatoria PvP (Elo). */
  pvpTier: string;
  /** División I / II / III dentro de la liga. */
  pvpDivision: 1 | 2 | 3;
  pvpRating: number;
  regionId: string;
  regionLabel: string;
  combatPower: number;
  clanTag: string | null;
  clanName: string | null;
  /** Emblema Prisma JSON — lo renderiza `ClanEmblemBadge`. */
  clanEmblem: unknown | null;
  loginStreak: number;
  lastAchievementId: string | null;
  country: string | null;
  /** Tipos del favorito (o líder) — firman el flúor del banner. */
  companionTypes: string[];
  /** Id de HOME_BANNER_OPTIONS — arte de fondo del banner de home. */
  homeBannerId: string | null;
  /** Id de HOME_FRAME_OPTIONS — marco ornamentado del banner. */
  homeFrameId: string | null;
};

/** Tile de “acciones diarias” (ex Quick Access). */
export type HomeDailyAction = {
  id: string;
  href: string | null;
  /** Si true, abre el modal de daily gift en vez de navegar. */
  openDailyGift?: boolean;
  iconSrc: string;
  labelKey: string;
  /** Chip de estado: "Disponible", "Día 7", "6/0", etc. */
  status: string | null;
  /** Resalta el tile (regalo listo, gym listo…). */
  hot?: boolean;
};

export type HomeObjective = {
  id: string;
  labelKey: string;
  current: number;
  target: number;
  done: boolean;
  claimable: boolean;
  claimed: boolean;
  rewardCoins: number;
  rewardItem: string;
  rewardQty: number;
};

export type HomeFeedItem = {
  id: string;
  kind: "friend" | "history" | "notice";
  text: string;
  at: string | null;
  href?: string | null;
  accent?: string | null;
};

/** @deprecated Preferí HomeDailyAction. */
export type HomeQuickLink = {
  id: string;
  href: string;
  iconSrc: string;
  labelKey: string;
};

/** Resumen PvP para el rail izquierdo del home. */
export type HomeRailPvpMatch = {
  id: string;
  won: boolean;
  opponentName: string;
  opponentCountry: string;
  opponentAvatarId: string | null;
  mode: "RANKED" | "QUICK";
  ratingDelta: number;
  /** Fecha corta `dd.MM` para la lista. */
  dateLabel: string;
};

export type HomeRailPvp = {
  rating: number;
  wins: number;
  losses: number;
  tier: string;
  division: 1 | 2 | 3;
  selfName: string;
  selfAvatarId: string | null;
  selfCountry: string;
  recent: HomeRailPvpMatch[];
};

/** Guerras de clan: identidad + marcador si hay guerra activa. */
export type HomeRailClanWars = {
  clanId: string | null;
  clanName: string | null;
  clanTag: string | null;
  clanEmblem: unknown | null;
  scoreSelf: number | null;
  scoreRival: number | null;
  rivalName: string | null;
  rivalTag: string | null;
  rivalEmblem: unknown | null;
  status: "none" | "active" | "completed";
};
