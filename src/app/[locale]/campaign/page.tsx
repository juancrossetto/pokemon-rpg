import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { gymLeaderImageUrl } from "@/lib/gym-art";
import { prisma } from "@/lib/prisma";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { ensureCampaignProgress } from "@/lib/campaign/ensure";
import {
  activeChapterIndex,
  buildChapters,
  journeyProgressPercent,
  nextMilestone,
  regionMapSrc,
} from "@/lib/campaign";
import { loadMapLocations } from "@/lib/campaign/map-data";
import {
  CampaignJourney,
  type GymRequirement,
  type JourneySummary,
} from "@/components/campaign-journey";
import type { CampaignDockMember } from "@/components/campaign-party-dock";
import type { HeldItemInfo, OwnedHeldItem } from "@/components/held-item-panel";
import { loadSquadBagCounts } from "@/lib/load-squad-bag";
import { calculateMaxHp } from "@/lib/stats";
import { spriteFor } from "@/lib/shiny";
import { resolveItemDisplayName } from "@/lib/shop";
import { startJohtoFromForm } from "@/actions/campaign";
import { SubmitButton } from "@/components/submit-button";
import {
  healCooldownMsLeft,
  healRushCost,
  isPokemonCenterFree,
} from "@/lib/healing";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  const userId = session.user.id;

  await redirectIfInBattle(userId, locale);

  const [tHome, tTeam, tShop, progress] = await Promise.all([
    getTranslations("home"),
    getTranslations("team"),
    getTranslations("shop"),
    ensureCampaignProgress(userId),
  ]);

  const [zones, badges, gyms, team, shinies, bagCounts, userHeal, ownedHeldItemsRows] =
    await Promise.all([
    loadMapLocations(userId, progress),
    prisma.badge.findMany({
      where: { userId, gym: { regionId: progress.currentRegionId } },
      include: { gym: { select: { order: true } } },
    }),
    // El nivel recomendado sale del equipo real del líder, no de un número fijo.
    prisma.gym.findMany({
      where: { regionId: progress.currentRegionId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        order: true,
        regionId: true,
        name: true,
        type: true,
        badgeName: true,
        leaderName: true,
        isElite: true,
        team: { select: { level: true } },
      },
    }),
    prisma.pokemonInstance.findMany({
      where: { ownerId: userId, teamSlot: { not: null } },
      select: {
        id: true,
        level: true,
        currentHp: true,
        ptConstitution: true,
        nickname: true,
        isFavorite: true,
        isTradeLocked: true,
        isShiny: true,
        species: { select: { name: true, spriteUrl: true, baseHp: true } },
        heldItem: {
          select: {
            id: true,
            name: true,
            effectText: true,
            heldEffect: true,
          },
        },
      },
      orderBy: { teamSlot: "asc" },
    }),
    prisma.pokemonInstance.count({ where: { ownerId: userId, isShiny: true } }),
    loadSquadBagCounts(userId),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { coins: true, lastHealAt: true },
    }),
    prisma.inventoryItem.findMany({
      where: { userId, quantity: { gt: 0 }, item: { type: "HELD" } },
      include: { item: true },
    }),
  ]);

  // El match va por `gymOrder`, que la zona ya trae de la data de campaña: por
  // nombre fallaba con el Alto Mando ("elite-lorelei" vs "Elite Four Lorelei").
  const gymOrderByLocationId: Record<string, number> = {};
  const requirementByLocationId: Record<string, GymRequirement> = {};
  for (const zone of zones) {
    if (zone.kindKey !== "kinds.gym" || zone.gymOrder === null) continue;
    const matched = gyms.find((g) => g.order === zone.gymOrder);
    if (!matched) continue;
    gymOrderByLocationId[zone.id] = matched.order;
    requirementByLocationId[zone.id] = {
      gymId: matched.id,
      badgeName: matched.badgeName,
      gymOrder: matched.order,
      badgeType: matched.type,
      recommendedLevel: Math.max(...matched.team.map((p) => p.level), 1),
      // Sprite pixel del líder: identifica el gimnasio mejor que una medalla
      // genérica repetida en los ocho nodos.
      leaderSpriteUrl: gymLeaderImageUrl(matched.leaderName),
    };
  }

  const earnedOrders = badges.map((b) => b.gym.order);
  const eliteOrders = new Set(gyms.filter((g) => g.isElite).map((g) => g.order));
  const chapters = buildChapters(zones, earnedOrders, gymOrderByLocationId, eliteOrders);
  const initialChapter = activeChapterIndex(chapters, progress.farmingLocationId);

  const teamMaxLevel = Math.max(...team.map((p) => p.level), 1);
  const itemLabel = (name: string) =>
    resolveItemDisplayName(name, (key) => {
      const path = `names.${key}`;
      return tShop.has(path) ? tShop(path) : null;
    });

  const dockMembers: CampaignDockMember[] = team.map((p) => {
    const maxHp = calculateMaxHp(p.species.baseHp, p.level, p.ptConstitution);
    const held: HeldItemInfo | null = p.heldItem
      ? {
          itemId: p.heldItem.id,
          name: p.heldItem.name,
          displayName: itemLabel(p.heldItem.name),
          effectText: p.heldItem.effectText,
        }
      : null;
    return {
      id: p.id,
      speciesName: p.species.name,
      nickname: p.nickname,
      spriteUrl: spriteFor(p.species.spriteUrl, p.isShiny),
      level: p.level,
      currentHp: Math.min(p.currentHp, maxHp),
      maxHp,
      isFavorite: p.isFavorite,
      isTradeLocked: p.isTradeLocked,
      heldItem: held,
    };
  });

  const ownedHeldById = new Map<string, OwnedHeldItem>(
    ownedHeldItemsRows.map((inv) => [
      inv.itemId,
      {
        itemId: inv.itemId,
        name: inv.item.name,
        displayName: itemLabel(inv.item.name),
        effectText: inv.item.effectText,
        quantity: inv.quantity,
      },
    ]),
  );
  // Exp. Share equipado sigue disponible en el panel para moverlo a otro mon.
  for (const m of dockMembers) {
    if (
      m.heldItem &&
      !ownedHeldById.has(m.heldItem.itemId) &&
      team.find((p) => p.id === m.id)?.heldItem?.heldEffect === "EXP_SHARE"
    ) {
      ownedHeldById.set(m.heldItem.itemId, {
        ...m.heldItem,
        quantity: 1,
      });
    }
  }
  const ownedHeldItems = [...ownedHeldById.values()];

  const hurtCount = dockMembers.filter((m) => m.currentHp < m.maxHp).length;
  const needsHealing = hurtCount > 0;
  const healCdMs = isPokemonCenterFree(teamMaxLevel)
    ? 0
    : healCooldownMsLeft(userHeal.lastHealAt);

  const allSpecies = new Map(zones.flatMap((z) => z.encounters).map((e) => [e.speciesId, e]));
  const summary: JourneySummary = {
    badges: earnedOrders.filter((o) => !eliteOrders.has(o)).length,
    // Los sellos del Alto Mando no son medallas de gimnasio.
    badgesTotal:
      gyms.filter((g) => !g.isElite && g.regionId === progress.currentRegionId).length ||
      8,
    speciesCaught: [...allSpecies.values()].filter((e) => e.caught).length,
    speciesTotal: allSpecies.size,
    zonesUnlocked: zones.filter((z) => z.unlocked).length,
    zonesTotal: zones.length,
    shinies,
    journeyPercent: journeyProgressPercent(progress),
    teamMaxLevel,
    teamLevels: team.map((p) => p.level),
  };

  const defeatedTrainerIds = zones.flatMap((z) =>
    z.trainers.filter((tr) => tr.defeated).map((tr) => tr.id),
  );
  const milestone = nextMilestone(progress, earnedOrders, defeatedTrainerIds);
  const canStartJohto = progress.currentRegionId === "kanto" && summary.badges >= 8 && summary.journeyPercent >= 100;

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-4 md:py-6">
      <div className="mx-auto max-w-[1400px]">
        {canStartJohto ? (
          <section className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-sky-300/20 bg-[radial-gradient(circle_at_90%_20%,rgba(56,189,248,.16),transparent_38%),#11151c] p-4 sm:p-5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">{tHome("johtoUnlock.eyebrow")}</p>
              <h2 className="mt-1 text-lg font-bold text-white">{tHome("johtoUnlock.title")}</h2>
              <p className="mt-1 text-xs text-white/50">{tHome("johtoUnlock.body")}</p>
            </div>
            <form action={startJohtoFromForm.bind(null, locale)}>
              <SubmitButton label={tHome("johtoUnlock.cta")} pendingLabel={tHome("johtoUnlock.traveling")} className="ui-btn-primary min-h-11 px-5 text-xs font-bold" />
            </form>
          </section>
        ) : null}
        <CampaignJourney
          key={progress.currentRegionId}
          locale={locale}
          chapters={chapters}
          initialChapter={initialChapter}
          farmingLocationId={progress.farmingLocationId}
          farmingStageId={progress.farmingStageId}
          summary={summary}
          gymRequirements={requirementByLocationId}
          regionMapSrc={regionMapSrc(progress.currentRegionId)}
          regionNameKey={`regions.${progress.currentRegionId}`}
          milestone={milestone}
          progress={progress}
          earnedGymOrders={earnedOrders}
          party={{
            members: dockMembers,
            bagCounts,
            ownedHeldItems,
            heal: {
              needsHealing,
              cooldownMsLeft: healCdMs,
              rushCost: healRushCost(hurtCount),
              coins: userHeal.coins,
              teamMaxLevel,
            },
            menuLabels: {
              favoriteOn: tHome("squadMenu.favoriteOn"),
              favoriteOff: tHome("squadMenu.favoriteOff"),
              lockOn: tHome("squadMenu.lockOn"),
              lockOff: tHome("squadMenu.lockOff"),
              viewTeam: tHome("squadMenu.viewTeam"),
              depositToPc: tHome("squadMenu.depositToPc"),
              depositLastBlocked: tHome("squadMenu.depositLastBlocked"),
              depositLockedBlocked: tHome("squadMenu.depositLockedBlocked"),
              hint: tHome("squadMenu.hint"),
              heal: tHome("squadMenu.heal"),
              revive: tHome("squadMenu.revive"),
              restorePp: tHome("squadMenu.restorePp"),
              rareCandy: tHome("squadMenu.rareCandy"),
              heldItem: tHome("squadMenu.heldItem"),
            },
            heldLabels: {
              title: tTeam("drawer.heldItemTitle"),
              hint: tTeam("drawer.heldItemHint"),
              change: tTeam("drawer.equip"),
              noneOwned: tTeam("drawer.noHeldItems"),
              unequip: tTeam("drawer.unequip"),
              equipping: tTeam("drawer.equipping"),
              cancel: tTeam("drawer.cancel"),
              close: tTeam("drawer.close"),
              equipped: tTeam("drawer.equipped"),
              equipErrors: {
                unauthorized: tTeam("drawer.teachErrors.unauthorized"),
                not_found: tTeam("drawer.teachErrors.not_found"),
                no_item: tTeam("drawer.equipErrors.no_item"),
                in_combat: tTeam("drawer.teachErrors.in_combat"),
              },
            },
          }}
        />
      </div>
    </div>
  );
}
