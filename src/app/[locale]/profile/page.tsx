import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { avatarById } from "@/lib/avatars";
import { uiSpriteUrl } from "@/lib/sprites";
import { neonTypeColor, typeColor } from "@/lib/type-colors";
import { calculateMaxHp } from "@/lib/stats";
import { pokemonPower } from "@/lib/ranking";
import {
  LEGENDARY_IDS,
  MYTHICAL_IDS,
  PSEUDO_IDS,
  STARTER_IDS,
  speciesRarity,
} from "@/lib/pokedex";
import {
  buildAchievements,
  buildCollection,
  type CollectionSlice,
  type TrainerStats,
} from "@/lib/trainer-profile";
import {
  divisionRoman,
  nextRankProgress,
  rankForRating,
} from "@/lib/pvp/tiers";
import { TrainerProfileClient } from "@/components/profile/trainer-profile-client";
import { TrainerSquadBand } from "@/components/trainer-squad-band";
import { TrainerVault } from "@/components/trainer-vault";
import { SectionLabel } from "@/components/trainer-profile-parts";
import { permissionsFor } from "@/lib/trainer-appearance";
import { findLocation } from "@/lib/campaign";
import type { StatRow } from "@/components/profile/trainer-stat-rows";

const SPECIES_SELECT = {
  id: true,
  name: true,
  spriteUrl: true,
  types: true,
  captureRate: true,
  baseHp: true,
  baseAttack: true,
  baseDefense: true,
  baseSpAtk: true,
  baseSpDef: true,
  baseSpeed: true,
} as const;

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // `tCampaign` sólo para los nombres de entrenador de la línea de tiempo: esos
  // viven en el namespace de campaña y `t` está scopeado a `profile`, así que
  // buscarlos con `t` caería siempre al fallback del id crudo.
  const [t, tCampaign, tPvp, session] = await Promise.all([
    getTranslations("profile"),
    getTranslations("campaign"),
    getTranslations("pvp"),
    auth(),
  ]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;
  await redirectIfInBattle(userId, locale);

  const [
    user,
    team,
    favoriteRow,
    badges,
    counts,
    totalGyms,
    achievementClaims,
    towerAgg,
    campaign,
  ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          username: true,
          country: true,
          avatarId: true,
          createdAt: true,
          pvpWins: true,
          pvpLosses: true,
          pvpRating: true,
        },
      }),
      prisma.pokemonInstance.findMany({
        where: { ownerId: userId, teamSlot: { not: null } },
        select: {
          id: true,
          nickname: true,
          level: true,
          currentHp: true,
          isShiny: true,
          isFavorite: true,
          teamSlot: true,
          ptStrength: true,
          ptSpeed: true,
          ptDexterity: true,
          ptIntelligence: true,
          ptConstitution: true,
          species: { select: SPECIES_SELECT },
        },
        orderBy: { teamSlot: "asc" },
      }),
      prisma.pokemonInstance.findFirst({
        where: { ownerId: userId, isFavorite: true },
        select: {
          id: true,
          nickname: true,
          level: true,
          currentHp: true,
          isShiny: true,
          isFavorite: true,
          teamSlot: true,
          ptStrength: true,
          ptSpeed: true,
          ptDexterity: true,
          ptIntelligence: true,
          ptConstitution: true,
          species: { select: SPECIES_SELECT },
        },
      }),
      prisma.badge.findMany({
        where: { userId },
        select: {
          id: true,
          earnedAt: true,
          gym: { select: { name: true, badgeName: true, type: true, leaderName: true } },
        },
        orderBy: { earnedAt: "asc" },
      }),
      // Contadores: todos son `count`/`groupBy`, no traen filas al servidor.
      Promise.all([
        prisma.pokemonInstance.count({ where: { ownerId: userId } }),
        prisma.pokemonInstance.count({ where: { ownerId: userId, isShiny: true } }),
        prisma.pokemonInstance.findMany({
          where: { ownerId: userId },
          select: { speciesId: true },
          distinct: ["speciesId"],
        }),
        prisma.pokedexEntry.count({ where: { userId } }),
        prisma.species.count(),
        prisma.trainerDefeat.count({ where: { userId } }),
        prisma.pokemonInstance.aggregate({
          where: { ownerId: userId },
          _max: { level: true },
        }),
      ]),
      // Sin el Alto Mando: el schema aclara que esos no cuentan como medalla,
      // así que incluirlos dejaría el rango Campeón fuera de alcance para
      // siempre —el denominador nunca se alcanzaría—.
      prisma.gym.count({ where: { isElite: false } }),
      prisma.achievementClaim.findMany({
        where: { userId },
        select: { achievementId: true },
      }),
      // Piso más alto de la torre en cualquier dificultad: el jugador piensa en
      // "hasta qué piso llegué", no en el desglose por modo.
      prisma.towerProgress.aggregate({
        where: { userId },
        _max: { highestFloorAllTime: true },
      }),
      prisma.campaignProgress.findUnique({
        where: { userId },
        select: { highestUnlockedLocationId: true },
      }),
    ]);

  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const [caught, shinies, distinctSpecies, dexSeen, dexTotal, trainersDefeated, levelAgg] =
    counts;

  /*
    Legendarios y míticos se cuentan sobre las especies que el jugador POSEE,
    no sobre las que vio: la sección se llama "colecciones" y ver un Mewtwo en
    un combate no lo colecciona. Los totales salen de la DB real, así que sumar
    generaciones mueve el denominador solo.
  */
  const ownedIds = new Set(distinctSpecies.map((s) => s.speciesId));
  const [legendaryTotal, mythicalTotal, starterTotal, pseudoTotal] = await Promise.all([
    prisma.species.count({ where: { id: { in: [...LEGENDARY_IDS] } } }),
    prisma.species.count({ where: { id: { in: [...MYTHICAL_IDS] } } }),
    prisma.species.count({ where: { id: { in: [...STARTER_IDS] } } }),
    prisma.species.count({ where: { id: { in: [...PSEUDO_IDS] } } }),
  ]);

  const countOwnedIn = (ids: Set<number>) =>
    [...ownedIds].filter((id) => ids.has(id)).length;

  const teamPowerTotal = team.reduce(
    (sum, p) =>
      sum +
      pokemonPower({
        level: p.level,
        ptStrength: p.ptStrength,
        ptSpeed: p.ptSpeed,
        ptDexterity: p.ptDexterity,
        ptIntelligence: p.ptIntelligence,
        ptConstitution: p.ptConstitution,
        species: p.species,
      }),
    0,
  );

  const stats: TrainerStats = {
    caught,
    shinies,
    species: ownedIds.size,
    dexSeen,
    dexTotal,
    badges: badges.length,
    totalGyms,
    pvpWins: user.pvpWins,
    pvpLosses: user.pvpLosses,
    pvpRating: user.pvpRating,
    trainersDefeated,
    legendaries: countOwnedIn(LEGENDARY_IDS),
    mythicals: countOwnedIn(MYTHICAL_IDS),
    topLevel: levelAgg._max.level ?? 0,
    power: teamPowerTotal,
  };

  const claimedAchievementIds = achievementClaims.map((c) => c.achievementId);
  const achievements = buildAchievements(stats, claimedAchievementIds);

  const pvpStanding = rankForRating(user.pvpRating);
  const pvpProgress = nextRankProgress(user.pvpRating);

  // Favorito: el marcado por el jugador (aunque esté en el PC); si no hay, el líder.
  const favorite = favoriteRow ?? team[0] ?? null;
  const favoriteAccent = favorite ? typeColor(favorite.species.types[0] ?? "normal") : "var(--color-pokeball-red)";

  /*
    Degradé del nombre según los tipos del compañero: cada perfil termina con su
    propia firma cromática. Con doble tipo cada extremo toma uno; con tipo único
    el segundo extremo es el mismo matiz corrido, para que haya recorrido y no
    un color plano.
  */
  const heroTypes = favorite?.species.types ?? [];
  const heroGradientFrom = neonTypeColor(heroTypes[0] ?? "normal");
  const heroGradientTo = heroTypes[1]
    ? neonTypeColor(heroTypes[1])
    : neonTypeColor(heroTypes[0] ?? "normal", 42);

  const collections: CollectionSlice[] = [
    buildCollection("legendary", stats.legendaries, legendaryTotal, "#f5cb46"),
    buildCollection("mythical", stats.mythicals, mythicalTotal, "#f072c0"),
    buildCollection("shiny", shinies, Math.max(shinies, dexTotal), "#f2c000"),
    buildCollection("starter", countOwnedIn(STARTER_IDS), starterTotal, "#4ade80"),
    buildCollection("pseudo", countOwnedIn(PSEUDO_IDS), pseudoTotal, "#a78bfa"),
  ];

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });

  const pvpTierLabel = tPvp(`tiers.${pvpStanding.tier}`);
  const pvpStandingLabel = `${pvpTierLabel} ${divisionRoman(pvpStanding.division)}`;
  const nextPvpLabel = pvpProgress.next
    ? `${tPvp(`tiers.${pvpProgress.next.tier}`)} ${divisionRoman(pvpProgress.next.division)}`
    : null;

  const rarityLabels = Object.fromEntries(
    ["common", "rare", "epic", "legendary", "mythical", "ultraBeast", "paradox"].map(
      (id) => [id, t(`rarity.${id}`)],
    ),
  );

  const companionName = favorite
    ? (favorite.nickname ?? favorite.species.name)
    : null;
  // El nombre del compañero va solo, sin el "y ": bajo el nombre del entrenador
  // y en cuerpo chico, nombra al Pokémon sin robarle protagonismo.
  const companionLine = companionName;
  const sceneLabel = companionName
    ? t("sceneLabel", { name: user.username, companion: companionName })
    : user.username;
  const perms = permissionsFor("own");
  // `stageSrc` y no `profileSrc`: la escena alinea los pies con la línea de
  // piso, y para eso el arte tiene que venir sin margen transparente.
  const trainerSprite = avatarById(user.avatarId)?.stageSrc ?? null;

  const avatarLabels = {
    change: t("avatar.change"),
    title: t("avatar.title"),
    hint: t("avatar.hint"),
    save: t("avatar.save"),
    saving: t("avatar.saving"),
    cancel: t("avatar.cancel"),
    error: t("avatar.error"),
  };

  const vaultNode = (
    <>
      <SectionLabel color="#ff6a00">{t("vault")}</SectionLabel>
      <TrainerVault
        badges={badges.map((b) => ({
          id: b.id,
          gymName: b.gym.name,
          badgeName: b.gym.badgeName,
          leaderName: b.gym.leaderName,
          type: b.gym.type,
          accent: typeColor(b.gym.type),
          earnedAt: dateFmt.format(b.earnedAt),
        }))}
        achievements={achievements}
        collections={collections}
        labels={{
          tabBadges: t("tabs.badges"),
          tabAchievements: t("tabs.achievements"),
          tabCollections: t("tabs.collections"),
          noBadges: t("noBadges"),
          locked: t("locked"),
          earnedOn: t("earnedOn"),
          claim: t("achievements.claim"),
          claiming: t("achievements.claiming"),
          claimAll: t("achievements.claimAll", { count: "{count}" }),
          claimed: t("achievements.claimed"),
          claimError: t("achievements.claimError"),
          rewardUnits: {
            coins: t("achievements.rewardCoins"),
            energy: t("achievements.rewardEnergy"),
            gems: t("achievements.rewardGems"),
          },
          achievement: Object.fromEntries(
            achievements.map((a) => [
              a.id,
              { name: t(`achievements.${a.id}.name`), hint: t(`achievements.${a.id}.hint`) },
            ]),
          ),
          collection: Object.fromEntries(
            collections.map((c) => [c.id, t(`collections.${c.id}`)]),
          ),
          rarity: rarityLabels,
        }}
      />
    </>
  );

  const teamNode = (
    <TrainerSquadBand
      members={Array.from({ length: 6 }, (_, i) => {
        const p = team.find((m) => m.teamSlot === i + 1);
        if (!p) return null;
        const maxHp = calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution);
        return {
          instanceId: p.id,
          name: p.nickname ?? p.species.name,
          spriteUrl: p.species.spriteUrl,
          level: p.level,
          currentHp: Math.min(p.currentHp, maxHp),
          maxHp,
          cp: pokemonPower({
            level: p.level,
            ptStrength: p.ptStrength,
            ptSpeed: p.ptSpeed,
            ptDexterity: p.ptDexterity,
            ptIntelligence: p.ptIntelligence,
            ptConstitution: p.ptConstitution,
            species: p.species,
          }),
          types: p.species.types,
          accent: typeColor(p.species.types[0] ?? "normal"),
          rarity: speciesRarity(p.species),
          isShiny: p.isShiny,
        };
      })}
      labels={{
        lead: t("lead"),
        level: t("levelShort"),
        cp: t("cp"),
        hp: t("hp"),
        shiny: t("shiny"),
        empty: t("emptySlot"),
        rarity: rarityLabels,
      }}
    />
  );

  /*
    Ficha del entrenador: una fila por dato, cada dato una sola vez.

    Antes esto estaba repartido en tres lugares —insignias destacadas, grilla de
    métricas y pestaña de estadísticas— y los tres contaban partes de lo mismo.
    Las medallas siguen enteras en su pestaña, así que acá no se repiten.
  */
  const highestFloor = towerAgg._max.highestFloorAllTime ?? 0;
  const reachedLocation = campaign?.highestUnlockedLocationId
    ? findLocation(campaign.highestUnlockedLocationId)?.location
    : null;

  /*
    Un solo acento en toda la ficha (ver TRAINER_FACT_ACCENT). Los PNG de nav
    traían su propia paleta y rompían esa unidad — salvo el Pokédex outline,
    que ya viene en la misma tinta dorada.
  */
  const trainerFacts: StatRow[] = [
    {
      id: "power",
      icon: "bolt",
      iconSrc: "/nav/cp-profile.png",
      label: t("cp"),
      value: stats.power.toLocaleString(),
    },
    /*
      Rango y título salieron del banner. El rango absorbe además la barra de
      medallas que vivía ahí: el `hint` dice cuánto falta y la fila lleva el
      mismo progreso, así que el dato completo entra en un renglón.
    */
    {
      id: "rank",
      icon: "workspace_premium",
      iconSrc: "/nav/trophy-profile.png",
      label: t("factsRows.rank"),
      value: pvpStandingLabel,
      hint: nextPvpLabel
        ? t("toNextLeague", {
            pct: Math.round(pvpProgress.pct),
            rank: nextPvpLabel,
          })
        : t("stats.rating", { rating: user.pvpRating }),
      pct: pvpProgress.pct / 100,
    },
    {
      id: "since",
      icon: "calendar_month",
      iconSrc: "/nav/birth-profile.png",
      label: t("startDate"),
      value: monthFmt.format(user.createdAt),
    },
    {
      id: "dex",
      icon: "menu_book",
      iconSrc: "/nav/pokedex-profile.png",
      label: t("stats.dex"),
      value: String(dexSeen),
      hint: `${dexSeen}/${dexTotal}`,
      pct: dexSeen / Math.max(1, dexTotal),
    },
    {
      id: "pvp",
      icon: "swords",
      iconSrc: "/nav/pvp-profile.png",
      label: t("factsRows.pvpWins"),
      value: String(user.pvpWins),
      hint: t("stats.rating", { rating: user.pvpRating }),
    },
    {
      id: "tower",
      icon: "apartment",
      iconSrc: "/nav/tower-profile.png",
      label: t("factsRows.tower"),
      value: highestFloor > 0 ? t("factsRows.floor", { floor: highestFloor }) : "—",
    },
    {
      id: "journey",
      icon: "map",
      iconSrc: "/nav/map-profile.png",
      label: t("factsRows.journey"),
      value: reachedLocation ? tCampaign(reachedLocation.nameKey) : "—",
    },
  ];

  return (
    <div
      className="flex-1 px-margin-mobile py-5 pb-bottom-nav md:px-margin-desktop md:py-8"
    >
      <TrainerProfileClient
        hero={{
          username: user.username,
          companionLine,
          sceneLabel,
          country: user.country,
          rankPct: pvpProgress.pct / 100,
          rankAccent: "#2eb8ff",
          rankLabel: pvpStandingLabel,
          pvpTier: pvpStanding.tier,
          pvpDivision: pvpStanding.division,
          pvpTierLabel,
          gradientFrom: heroGradientFrom,
          gradientTo: heroGradientTo,
          topLevel: stats.topLevel,
          badges: stats.badges,
          totalGyms: stats.totalGyms,
          power: stats.power,
          trainerSpriteUrl: trainerSprite,
          companionSpriteUrl: favorite
            ? uiSpriteUrl(favorite.species.spriteUrl, favorite.isShiny)
            : null,
          companionName,
          companionAccent: favoriteAccent,
          appearance: null,
          canEdit: perms.canEdit,
          currentAvatarId: user.avatarId,
          avatarLabels,
          labels: {
            power: t("cp"),
            level: t("levelShort"),
            badges: t("badgesShort"),
          },
        }}
        hubLabels={{
          tabs: {
            summary: t("nav.summary"),
            badges: t("nav.badges"),
            team: t("nav.team"),
          },
          facts: t("facts"),
          manageTeam: t("manageTeam"),
        }}
        facts={trainerFacts}
        vault={vaultNode}
        team={teamNode}
      />
    </div>
  );
}
