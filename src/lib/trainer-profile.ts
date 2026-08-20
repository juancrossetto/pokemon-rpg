/**
 * Identidad del entrenador: rango, título, logros y colecciones.
 *
 * Sin Prisma a propósito — la pantalla de perfil es mayormente cliente y basta
 * con que un componente importe un tipo desde un módulo con `prisma` para que
 * `pg` entre al bundle del browser y el build muera con "Can't resolve 'dns'".
 * Mismo motivo por el que existen `rarity.ts` y `evolution-readiness.ts`.
 *
 * TODO lo de acá se deriva de datos que el jugador realmente generó. No hay
 * campo `rank` en el schema: son una capa de lectura sobre contadores
 * auténticos (medallas, capturas, shinies, victorias). El cobro one-shot de
 * recompensas vive en `AchievementClaim` + `claimAchievement`.
 *
 * Lo que la spec pedía y NO está acá porque el dato no existe en el schema:
 * amistad, horas jugadas, rachas, incursiones y estrellas de rareza por
 * instancia. Agregarlos requiere migración y lógica de juego, no maquetado.
 */

export type RankTierId =
  | "bronze"
  | "silver"
  | "gold"
  | "diamond"
  | "master"
  | "champion";

export type RankTier = {
  id: RankTierId;
  /** Fracción de medallas necesaria (0–1). El total real llega por parámetro. */
  minRatio: number;
  /** Gradiente del marco — metal, no color plano: el relieve sale de acá. */
  metal: string;
  /** Color de acento para brillos y bordes. */
  accent: string;
  /** Halo exterior. */
  glow: string;
};

/*
  El rango sale de las medallas y no del poder del equipo a propósito: el
  ranking del juego ya ordena por medallas primero porque son "progresión
  real", mientras que el poder sube solo con criar y subir de nivel. Un marco
  Campeón tiene que costar lo mismo que ser campeón.

  Las proporciones se calculan sobre el total de gimnasios que existan, así que
  sumar regiones no rompe la escala ni deja el marco Maestro inalcanzable.
*/
export const RANK_TIERS: RankTier[] = [
  {
    id: "bronze",
    minRatio: 0,
    metal: "linear-gradient(145deg,#8c5a2b,#d9915a,#7a4a22)",
    accent: "#d9915a",
    glow: "rgba(217,145,90,0.35)",
  },
  {
    id: "silver",
    minRatio: 0.2,
    metal: "linear-gradient(145deg,#8f98a3,#e2e8f0,#78828e)",
    accent: "#dbe3ec",
    glow: "rgba(219,227,236,0.35)",
  },
  {
    id: "gold",
    minRatio: 0.45,
    metal: "linear-gradient(145deg,#a97b12,#f5cb46,#8d6410)",
    accent: "#f5cb46",
    glow: "rgba(245,203,70,0.4)",
  },
  {
    id: "diamond",
    minRatio: 0.7,
    metal: "linear-gradient(145deg,#3f7fa6,#8fe3f5,#2f6a8d)",
    accent: "#8fe3f5",
    glow: "rgba(143,227,245,0.4)",
  },
  {
    id: "master",
    minRatio: 0.9,
    metal: "linear-gradient(145deg,#6d3a9e,#c79bf0,#54277d)",
    accent: "#c79bf0",
    glow: "rgba(199,155,240,0.45)",
  },
  {
    id: "champion",
    minRatio: 1,
    metal: "linear-gradient(145deg,#a11d1d,#ff5f5f,#7d1414)",
    accent: "#ff6b6b",
    glow: "rgba(255,107,107,0.5)",
  },
];

export type RankProgress = {
  tier: RankTier;
  next: RankTier | null;
  /** Progreso hacia el siguiente rango (0–1). 1 si ya es el máximo. */
  pct: number;
  badgesToNext: number;
};

/** Rango actual y cuánto falta para el próximo. */
export function rankProgress(badges: number, totalGyms: number): RankProgress {
  const safeTotal = Math.max(1, totalGyms);
  const ratio = Math.min(1, badges / safeTotal);

  let index = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (ratio >= RANK_TIERS[i].minRatio) index = i;
  }
  const tier = RANK_TIERS[index];
  const next = RANK_TIERS[index + 1] ?? null;

  if (!next) return { tier, next: null, pct: 1, badgesToNext: 0 };

  const from = tier.minRatio * safeTotal;
  const to = next.minRatio * safeTotal;
  const span = Math.max(1e-9, to - from);
  return {
    tier,
    next,
    pct: Math.max(0, Math.min(1, (badges - from) / span)),
    badgesToNext: Math.max(0, Math.ceil(to - badges)),
  };
}

/** Contadores reales del jugador. Todos salen de una fila o un count. */
export type TrainerStats = {
  caught: number;
  shinies: number;
  species: number;
  dexSeen: number;
  dexTotal: number;
  badges: number;
  totalGyms: number;
  pvpWins: number;
  pvpLosses: number;
  pvpRating: number;
  trainersDefeated: number;
  legendaries: number;
  mythicals: number;
  topLevel: number;
  power: number;
};

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export type AchievementDef = {
  id: string;
  icon: string;
  rarity: AchievementRarity;
  goal: number;
  /** Contador real que lo alimenta. */
  metric: keyof TrainerStats;
};

/*
  Los umbrales son deliberadamente alcanzables al principio y largos después:
  un perfil nuevo tiene que mostrar algo ya conseguido —si todo arranca en 0%
  la sección se lee como un error— y a la vez dejar objetivos lejanos para que
  la pantalla siga teniendo sentido a las 50 horas.
*/
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "firstSteps", icon: "sports_baseball", rarity: "common", goal: 10, metric: "caught" },
  { id: "collector", icon: "inventory_2", rarity: "rare", goal: 100, metric: "caught" },
  { id: "hoarder", icon: "warehouse", rarity: "legendary", goal: 1000, metric: "caught" },
  { id: "firstShiny", icon: "auto_awesome", rarity: "rare", goal: 1, metric: "shinies" },
  { id: "shinyHunter", icon: "flare", rarity: "legendary", goal: 10, metric: "shinies" },
  { id: "researcher", icon: "menu_book", rarity: "rare", goal: 50, metric: "species" },
  { id: "fieldObserver", icon: "visibility", rarity: "rare", goal: 100, metric: "dexSeen" },
  // 151 = tope dex Kanto (`REGIONS.kanto.speciesRange`); 13 = 8 medallas + 5 élite.
  { id: "taxonomist", icon: "biotech", rarity: "epic", goal: 151, metric: "species" },
  // Kanto + Johto: investigación regional completa, aunque no las haya capturado todas.
  { id: "regionalScholar", icon: "travel_explore", rarity: "legendary", goal: 251, metric: "dexSeen" },
  { id: "gymGoer", icon: "military_tech", rarity: "common", goal: 1, metric: "badges" },
  { id: "champion", icon: "workspace_premium", rarity: "legendary", goal: 13, metric: "badges" },
  { id: "duelist", icon: "swords", rarity: "rare", goal: 10, metric: "pvpWins" },
  { id: "gladiator", icon: "shield", rarity: "epic", goal: 100, metric: "pvpWins" },
  { id: "roadWarrior", icon: "hiking", rarity: "common", goal: 25, metric: "trainersDefeated" },
  { id: "mythSeeker", icon: "diamond", rarity: "epic", goal: 1, metric: "legendaries" },
  { id: "mythKeeper", icon: "stars", rarity: "legendary", goal: 1, metric: "mythicals" },
  { id: "veteran", icon: "trending_up", rarity: "epic", goal: 60, metric: "topLevel" },
];

export type Achievement = AchievementDef & {
  current: number;
  pct: number;
  unlocked: boolean;
  /** Ya cobró la recompensa one-shot. */
  claimed: boolean;
  /** Desbloqueado y todavía sin cobrar. */
  claimable: boolean;
};

/**
 * Resuelve cada logro contra los contadores reales. Los desbloqueados primero
 * y, dentro de cada grupo, los más cercanos a completarse: la sección abre
 * mostrando lo conseguido y sigue con lo que está a un paso, que es lo que
 * invita a seguir jugando.
 */
export function buildAchievements(
  stats: TrainerStats,
  claimedIds: Iterable<string> = [],
): Achievement[] {
  const claimed = claimedIds instanceof Set ? claimedIds : new Set(claimedIds);
  return ACHIEVEMENTS.map((def) => {
    const current = Math.max(0, stats[def.metric] ?? 0);
    const pct = def.goal > 0 ? Math.min(1, current / def.goal) : 0;
    const unlocked = current >= def.goal;
    const isClaimed = claimed.has(def.id);
    return {
      ...def,
      current,
      pct,
      unlocked,
      claimed: isClaimed,
      claimable: unlocked && !isClaimed,
    };
  }).sort((a, b) => {
    if (a.claimable !== b.claimable) return a.claimable ? -1 : 1;
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return b.pct - a.pct;
  });
}

export type CollectionSlice = {
  id: "legendary" | "mythical" | "shiny" | "starter" | "pseudo";
  owned: number;
  total: number;
  pct: number;
  accent: string;
};

/** Porcentaje por categoría de colección. `total` 0 ⇒ 0%, nunca NaN. */
export function buildCollection(
  id: CollectionSlice["id"],
  owned: number,
  total: number,
  accent: string,
): CollectionSlice {
  return {
    id,
    owned,
    total,
    pct: total > 0 ? Math.min(1, owned / total) : 0,
    accent,
  };
}

export type TimelineKind = "catch" | "badge" | "trainer" | "shiny";

export type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  /** Nombre del Pokémon / gimnasio / entrenador. */
  label: string;
  at: Date;
  spriteUrl?: string | null;
  accent?: string | null;
};

/**
 * Une los hitos de distintas tablas en una sola línea de tiempo. No hay tabla
 * de actividad: cada fuente aporta su propia marca temporal (`caughtAt`,
 * `earnedAt`, `defeatedAt`) y acá se mezclan y recortan.
 */
export function mergeTimeline(events: TimelineEvent[], limit = 12): TimelineEvent[] {
  return [...events].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/**
 * Título del entrenador. Se elige el más específico que haya conseguido, no el
 * primero que matchee: un jugador con 5 shinies y 1 medalla merece leerse como
 * cazador de shinies antes que como "Aprendiz".
 */
export function trainerTitle(stats: TrainerStats): string {
  if (stats.badges >= stats.totalGyms && stats.totalGyms > 0) return "champion";
  if (stats.mythicals > 0) return "mythKeeper";
  if (stats.shinies >= 5) return "shinyHunter";
  if (stats.legendaries > 0) return "legendTamer";
  if (stats.pvpWins >= 50) return "duelist";
  if (stats.species >= 100) return "researcher";
  if (stats.badges >= 4) return "gymLeaderBane";
  if (stats.caught >= 50) return "collector";
  if (stats.caught >= 10) return "trainer";
  return "rookie";
}
