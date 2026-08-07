import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { PC_ERRORS, PC_NOTICES, pickCode } from "@/lib/feedback-codes";
import { TEAM_SIZE } from "@/lib/market-rules";
import { PcTransfer, type PcMon } from "@/components/pc-transfer";
import { PcAlert } from "@/components/pc-alert";
import { BreedingPanel } from "@/components/breeding-panel";
import { BREEDING_MIN_LEVEL, msUntilHatch } from "@/lib/breeding";
import { breedingParentIds } from "@/lib/breeding-lock";
import { spriteFor } from "@/lib/shiny";
import { loadSquadBagCounts } from "@/lib/load-squad-bag";

/**
 * Contenido de la tab "PC y Guardería" del hub de Pokémon. Era la página /pc;
 * la carga de datos vive acá para que la tab Equipo no la pague.
 */
export async function PcTab({
  locale,
  userId,
  query,
}: {
  locale: string;
  userId: string;
  query: { error?: string; notice?: string };
}) {
  const [t, th] = await Promise.all([getTranslations("pc"), getTranslations("home")]);

  // Lista blanca: los códigos llegan por querystring y sin validarlos
  // ?error=loquesea le muestra la clave de traducción cruda al jugador.
  const error = pickCode(query.error, PC_ERRORS);
  const notice = pickCode(query.notice, PC_NOTICES);

  const [pokemon, bagCounts] = await Promise.all([
    prisma.pokemonInstance.findMany({
      where: {
        ownerId: userId,
        // Escrow de mochila del mercado: no aparecen hasta reclamar la compra.
        listings: {
          none: {
            status: "SOLD",
            buyerId: userId,
            buyerClaimedAt: null,
          },
        },
      },
      include: {
        species: true,
        listings: { where: { status: "ACTIVE" }, select: { id: true } },
      },
      orderBy: [{ teamSlot: { sort: "asc", nulls: "last" } }, { caughtAt: "asc" }],
    }),
    loadSquadBagCounts(userId),
  ]);

  if (pokemon.length === 0) {
    redirect({ href: "/starter", locale });
    return null;
  }

  const team = pokemon.filter((p) => p.teamSlot !== null);
  const stored = pokemon.filter((p) => p.teamSlot === null);

  // Sólo los de la PC, sin publicar y con nivel suficiente pueden criar.
  const busyParents = await breedingParentIds(userId);
  const breedCandidates = stored
    .filter(
      (p) =>
        p.listings.length === 0 &&
        p.level >= BREEDING_MIN_LEVEL &&
        !busyParents.has(p.id),
    )
    .map((p) => ({
      id: p.id,
      name: p.nickname ?? p.species.name,
      level: p.level,
      spriteUrl: spriteFor(p.species.spriteUrl, p.isShiny),
    }));

  const eggs = (
    await prisma.egg.findMany({
      where: { ownerId: userId, hatchedAt: null },
      include: { species: { select: { name: true, spriteUrl: true } } },
      orderBy: { readyAt: "asc" },
    })
  ).map((e) => ({
    id: e.id,
    speciesName: e.species.name,
    spriteUrl: e.species.spriteUrl,
    isShiny: e.isShiny,
    ready: msUntilHatch(e.readyAt) === 0,
    minutesLeft: Math.ceil(msUntilHatch(e.readyAt) / 60000),
  }));

  return (
    <>
      <div className="mb-6">
        <h1 className="page-title text-headline-lg text-white md:text-display-lg">{t("title")}</h1>
        <p className="text-label-md text-on-surface-variant mt-1">{t("subtitle")}</p>
      </div>

      {notice && (
        <PcAlert kind="success">{t(`notices.${notice}`)}</PcAlert>
      )}
      {error && (
        <PcAlert kind="error">{t(`errors.${error}`)}</PcAlert>
      )}

      <PcTransfer
        key={pokemon
          .map((p) => `${p.id}:${p.teamSlot ?? "box"}:${p.speciesId}`)
          .join("|")}
        locale={locale}
        teamSize={TEAM_SIZE}
        initialTeam={team.map((p) => toPcMon(p, busyParents))}
        initialBox={stored.map((p) => toPcMon(p, busyParents))}
        initialBagCounts={bagCounts}
        menuLabels={{
          favoriteOn: th("squadMenu.favoriteOn"),
          favoriteOff: th("squadMenu.favoriteOff"),
          lockOn: th("squadMenu.lockOn"),
          lockOff: th("squadMenu.lockOff"),
          viewTeam: th("squadMenu.viewTeam"),
          depositToPc: th("squadMenu.depositToPc"),
          depositLastBlocked: th("squadMenu.depositLastBlocked"),
          depositLockedBlocked: th("squadMenu.depositLockedBlocked"),
          hint: th("squadMenu.hint"),
          heal: th("squadMenu.heal"),
          revive: th("squadMenu.revive"),
          restorePp: th("squadMenu.restorePp"),
          rareCandy: th("squadMenu.rareCandy"),
        }}
      />

      <BreedingPanel locale={locale} candidates={breedCandidates} eggs={eggs} />
    </>
  );
}

type PokemonRowSource = {
  id: string;
  nickname: string | null;
  level: number;
  currentHp: number;
  ptConstitution: number;
  teamSlot: number | null;
  isShiny: boolean;
  isFavorite: boolean;
  isTradeLocked: boolean;
  species: { name: string; spriteUrl: string; types: string[]; baseHp: number };
  listings: { id: string }[];
};

function toPcMon(instance: PokemonRowSource, breedingIds: Set<string>): PcMon {
  return {
    id: instance.id,
    name: instance.nickname ?? instance.species.name,
    speciesName: instance.species.name,
    level: instance.level,
    spriteUrl: spriteFor(instance.species.spriteUrl, instance.isShiny),
    types: instance.species.types,
    currentHp: instance.currentHp,
    maxHp: calculateMaxHp(instance.species.baseHp, instance.level, instance.ptConstitution),
    isFavorite: instance.isFavorite,
    isTradeLocked: instance.isTradeLocked,
    listed: instance.listings.length > 0,
    breeding: breedingIds.has(instance.id),
  };
}
