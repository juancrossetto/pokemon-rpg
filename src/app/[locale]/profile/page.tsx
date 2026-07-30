import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { avatarById } from "@/lib/avatars";
import { typeColor } from "@/lib/type-colors";
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
  mergeTimeline,
  rankProgress,
  trainerTitle,
  type CollectionSlice,
  type TimelineEvent,
  type TrainerStats,
} from "@/lib/trainer-profile";
import { TrainerProfileClient } from "@/components/profile/trainer-profile-client";
import { TrainerSquadBand } from "@/components/trainer-squad-band";
import { TrainerVault, RecentCatchStrip } from "@/components/trainer-vault";
import { TrainerTimeline } from "@/components/trainer-timeline";
import { MetricTile } from "@/components/metric-tile";
import { SectionLabel } from "@/components/trainer-profile-parts";
import { permissionsFor } from "@/lib/trainer-appearance";

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
  const [t, tCampaign, session] = await Promise.all([
    getTranslations("profile"),
    getTranslations("campaign"),
    auth(),
  ]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;
  await redirectIfInBattle(userId, locale);

  const [user, team, badges, counts, recentCatches, recentDefeats, totalGyms, achievementClaims] =
    await Promise.all([
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
      prisma.pokemonInstance.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          nickname: true,
          level: true,
          isShiny: true,
          caughtAt: true,
          species: {
            select: {
              name: true,
              spriteUrl: true,
              types: true,
              captureRate: true,
              id: true,
            },
          },
        },
        orderBy: { caughtAt: "desc" },
        take: 10,
      }),
      prisma.trainerDefeat.findMany({
        where: { userId },
        select: { trainerId: true, locationId: true, defeatedAt: true },
        orderBy: { defeatedAt: "desc" },
        take: 5,
      }),
      // Sin el Alto Mando: el schema aclara que esos no cuentan como medalla,
      // así que incluirlos dejaría el rango Campeón fuera de alcance para
      // siempre —el denominador nunca se alcanzaría—.
      prisma.gym.count({ where: { isElite: false } }),
      prisma.achievementClaim.findMany({
        where: { userId },
        select: { achievementId: true },
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

  const rank = rankProgress(stats.badges, totalGyms);
  const title = trainerTitle(stats);

  // Favorito: el marcado por el jugador; si no marcó ninguno, el líder.
  const favorite = team.find((p) => p.isFavorite) ?? team[0] ?? null;
  const favoriteAccent = favorite ? typeColor(favorite.species.types[0] ?? "normal") : "#ee1515";

  const collections: CollectionSlice[] = [
    buildCollection("legendary", stats.legendaries, legendaryTotal, "#f5cb46"),
    buildCollection("mythical", stats.mythicals, mythicalTotal, "#f072c0"),
    buildCollection("shiny", shinies, Math.max(shinies, dexTotal), "#f2c000"),
    buildCollection("starter", countOwnedIn(STARTER_IDS), starterTotal, "#4ade80"),
    buildCollection("pseudo", countOwnedIn(PSEUDO_IDS), pseudoTotal, "#a78bfa"),
  ];

  const timeline = mergeTimeline([
    ...recentCatches.map<TimelineEvent>((p) => ({
      id: `catch-${p.id}`,
      kind: p.isShiny ? "shiny" : "catch",
      label: p.nickname ?? p.species.name,
      at: p.caughtAt,
      spriteUrl: p.species.spriteUrl,
      accent: typeColor(p.species.types[0] ?? "normal"),
    })),
    ...badges.map<TimelineEvent>((b) => ({
      id: `badge-${b.id}`,
      kind: "badge",
      label: b.gym.badgeName,
      at: b.earnedAt,
      accent: typeColor(b.gym.type),
    })),
    ...recentDefeats.map<TimelineEvent>((d) => ({
      id: `trainer-${d.trainerId}-${d.locationId}`,
      kind: "trainer",
      label: tCampaign.has(`trainers.${d.trainerId}`)
        ? tCampaign(`trainers.${d.trainerId}`)
        : d.trainerId.replace(/_/g, " "),
      at: d.defeatedAt,
    })),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  const now = new Date();

  const rankLabels = Object.fromEntries(
    ["bronze", "silver", "gold", "diamond", "master", "champion"].map((id) => [
      id,
      t(`rank.${id}`),
    ]),
  );
  const titleLabels = Object.fromEntries(
    [
      "rookie", "trainer", "collector", "gymLeaderBane", "researcher",
      "duelist", "legendTamer", "shinyHunter", "mythKeeper", "champion",
    ].map((id) => [id, t(`titles.${id}`)]),
  );
  const rarityLabels = Object.fromEntries(
    ["common", "rare", "epic", "legendary", "mythical", "ultraBeast", "paradox"].map(
      (id) => [id, t(`rarity.${id}`)],
    ),
  );

  const dexPct = Math.round((dexSeen / Math.max(1, dexTotal)) * 100);
  const companionName = favorite
    ? (favorite.nickname ?? favorite.species.name)
    : null;
  const companionLine = companionName
    ? t("andCompanion", { companion: companionName })
    : null;
  const sceneLabel = companionName
    ? t("sceneLabel", { name: user.username, companion: companionName })
    : user.username;
  const perms = permissionsFor("own");
  const trainerSprite = avatarById(user.avatarId)?.src ?? null;

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
      <SectionLabel>{t("vault")}</SectionLabel>
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

  const statsNode = (
    <div className="flex flex-col gap-4">
      <section>
        <SectionLabel>{t("metrics")}</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <MetricTile
            icon="sports_baseball"
            label={t("stats.caught")}
            numericValue={caught}
            accent="#4ade80"
            delayMs={40}
          />
          <MetricTile
            icon="auto_awesome"
            label={t("stats.shinies")}
            numericValue={shinies}
            accent="#f2c000"
            delayMs={80}
          />
          <MetricTile
            icon="hiking"
            label={t("stats.trainers")}
            numericValue={trainersDefeated}
            accent="#fb923c"
            delayMs={120}
          />
          <MetricTile
            icon="bolt"
            label={t("stats.power")}
            numericValue={stats.power}
            accent="#f2c000"
            delayMs={160}
          />
          <MetricTile
            icon="menu_book"
            label={t("stats.dex")}
            numericValue={dexPct}
            suffix="%"
            barPct={dexSeen / Math.max(1, dexTotal)}
            hint={`${dexSeen}/${dexTotal}`}
            accent="#60a5fa"
            delayMs={200}
          />
          <MetricTile
            icon="swords"
            label={t("stats.pvp")}
            value={`${user.pvpWins}-${user.pvpLosses}`}
            hint={t("stats.rating", { rating: user.pvpRating })}
            accent="#a78bfa"
            delayMs={240}
          />
        </div>
      </section>

      <section>
        <SectionLabel>{t("recentCatches")}</SectionLabel>
        <RecentCatchStrip
          levelLabel={t("levelShort")}
          items={recentCatches.slice(0, 8).map((p) => {
            const rarity = speciesRarity(p.species);
            return {
              id: p.id,
              name: p.nickname ?? p.species.name,
              spriteUrl: p.species.spriteUrl,
              accent: typeColor(p.species.types[0] ?? "normal"),
              isShiny: p.isShiny,
              level: p.level,
              rarityLabel: rarityLabels[rarity] ?? rarity,
            };
          })}
          emptyLabel={t("noCatches")}
        />
      </section>

      <section className="rounded-[1.4rem] border border-white/8 bg-[#080a10]/80 p-3 backdrop-blur-md">
        <SectionLabel>{t("activity")}</SectionLabel>
        <TrainerTimeline
          events={timeline}
          now={now}
          labels={{
            empty: t("noActivity"),
            kind: {
              catch: t("timeline.catch"),
              badge: t("timeline.badge"),
              trainer: t("timeline.trainer"),
              shiny: t("timeline.shiny"),
            },
            agoMinutes: t("time.minutes", { n: "{n}" }),
            agoHours: t("time.hours", { n: "{n}" }),
            agoDays: t("time.days", { n: "{n}" }),
            justNow: t("time.now"),
          }}
        />
      </section>
    </div>
  );

  const companionStrip =
    favorite && companionName ? (
      <section className="rounded-2xl border border-white/8 bg-[#0e1118]/90 px-4 py-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/70">
          {t("companion")}
        </p>
        <p className="mt-1 text-[14px] font-semibold text-white">
          {companionName}
          <span className="ml-2 font-mono text-[12px] font-medium text-white/55">
            {t("levelShort")} {favorite.level} · {t("cp")}{" "}
            {pokemonPower({
              level: favorite.level,
              ptStrength: favorite.ptStrength,
              ptSpeed: favorite.ptSpeed,
              ptDexterity: favorite.ptDexterity,
              ptIntelligence: favorite.ptIntelligence,
              ptConstitution: favorite.ptConstitution,
              species: favorite.species,
            }).toLocaleString()}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] capitalize text-on-surface-variant">
          {favorite.species.types.join(" / ")}
        </p>
      </section>
    ) : null;

  return (
    <div className="flex-1 px-margin-mobile py-5 pb-bottom-nav md:px-margin-desktop md:py-8">
      <TrainerProfileClient
        hero={{
          username: user.username,
          companionLine,
          sceneLabel,
          country: user.country,
          title,
          rank,
          power: stats.power,
          badges: stats.badges,
          totalGyms,
          memberSince: monthFmt.format(user.createdAt),
          trainerSpriteUrl: trainerSprite,
          companionSpriteUrl: favorite?.species.spriteUrl ?? null,
          companionName,
          companionAccent: favoriteAccent,
          appearance: null,
          canEdit: perms.canEdit,
          currentAvatarId: user.avatarId,
          avatarLabels,
          labels: {
            rank: rankLabels,
            title: titleLabels,
            power: t("cp"),
            badges: t("badgesShort"),
            startDate: t("startDate"),
            toNextRank: rank.next
              ? t("toNextRank", {
                  count: rank.badgesToNext,
                  rank: rankLabels[rank.next.id] ?? rank.next.id,
                })
              : t("maxRank"),
            maxRank: t("maxRank"),
          },
        }}
        hubLabels={{
          tabs: {
            summary: t("nav.summary"),
            badges: t("nav.badges"),
            team: t("nav.team"),
            stats: t("nav.stats"),
          },
          metrics: t("metrics"),
          featuredBadges: t("featuredBadges"),
          viewAllBadges: t("viewAllBadges"),
          manageTeam: t("manageTeam"),
        }}
        metrics={{
          sectionLabel: t("metrics"),
          power: stats.power,
          dexPct,
          dexHint: `${dexSeen}/${dexTotal}`,
          badgesLabel: `${stats.badges}/${totalGyms}`,
          badgesPct: stats.badges / Math.max(1, totalGyms),
          pvpRecord: `${user.pvpWins}-${user.pvpLosses}`,
          pvpHint: t("stats.rating", { rating: user.pvpRating }),
          labels: {
            power: t("cp"),
            dex: t("stats.dex"),
            badges: t("stats.badges"),
            pvp: t("stats.pvp"),
          },
        }}
        featured={{
          gymBadges: badges.map((b) => ({
            id: b.id,
            badgeName: b.gym.badgeName,
            type: b.gym.type,
            accent: typeColor(b.gym.type),
          })),
          achievements,
          labels: {
            title: t("featuredBadges"),
            seeAll: t("viewAllBadges"),
            locked: t("locked"),
            achievement: Object.fromEntries(
              achievements.map((a) => [a.id, { name: t(`achievements.${a.id}.name`) }]),
            ),
          },
        }}
        vault={vaultNode}
        team={teamNode}
        stats={statsNode}
        summaryExtra={companionStrip}
      />
    </div>
  );
}
