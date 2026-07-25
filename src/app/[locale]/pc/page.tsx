import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMaxHp } from "@/lib/stats";
import { PC_ERRORS, PC_NOTICES, pickCode } from "@/lib/feedback-codes";
import { TEAM_SIZE } from "@/lib/market-rules";
import { PcTransfer, type PcMon } from "@/components/pc-transfer";
import { BreedingPanel } from "@/components/breeding-panel";
import { BREEDING_MIN_LEVEL, msUntilHatch } from "@/lib/breeding";
import { spriteFor } from "@/lib/shiny";
import { redirectIfInBattle } from "@/lib/battle-lock";

export default async function PcPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [t, session] = await Promise.all([getTranslations("pc"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  await redirectIfInBattle(session.user.id, locale);

  // Lista blanca: los códigos llegan por querystring y sin validarlos
  // ?error=loquesea le muestra la clave de traducción cruda al jugador.
  const error = pickCode(query.error, PC_ERRORS);
  const notice = pickCode(query.notice, PC_NOTICES);

  const pokemon = await prisma.pokemonInstance.findMany({
    where: { ownerId: session.user.id },
    include: {
      species: true,
      listings: { where: { status: "ACTIVE" }, select: { id: true } },
    },
    orderBy: [{ teamSlot: { sort: "asc", nulls: "last" } }, { caughtAt: "asc" }],
  });

  if (pokemon.length === 0) {
    redirect({ href: "/starter", locale });
    return null;
  }

  const team = pokemon.filter((p) => p.teamSlot !== null);
  const stored = pokemon.filter((p) => p.teamSlot === null);

  // Sólo los de la PC, sin publicar y con nivel suficiente pueden criar.
  const breedCandidates = stored
    .filter((p) => p.listings.length === 0 && p.level >= BREEDING_MIN_LEVEL)
    .map((p) => ({
      id: p.id,
      name: p.nickname ?? p.species.name,
      level: p.level,
      spriteUrl: spriteFor(p.species.spriteUrl, p.isShiny),
    }));

  const eggs = (
    await prisma.egg.findMany({
      where: { ownerId: session.user.id, hatchedAt: null },
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
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-headline-lg md:text-display-lg text-white">{t("title")}</h1>
          <p className="text-label-md text-on-surface-variant mt-1">{t("subtitle")}</p>
        </div>

        {notice && (
          <div className="mb-4 rounded-lg border border-tertiary/40 bg-tertiary/10 px-4 py-2 text-label-md text-tertiary">
            {t(`notices.${notice}`)}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-error/40 bg-error-container/30 px-4 py-2 text-label-md text-error">
            {t(`errors.${error}`)}
          </div>
        )}

        <PcTransfer
          key={pokemon.map((p) => `${p.id}:${p.teamSlot ?? "box"}`).join("|")}
          locale={locale}
          teamSize={TEAM_SIZE}
          initialTeam={team.map(toPcMon)}
          initialBox={stored.map(toPcMon)}
        />

        <BreedingPanel locale={locale} candidates={breedCandidates} eggs={eggs} />
      </div>
    </div>
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
  species: { name: string; spriteUrl: string; types: string[]; baseHp: number };
  listings: { id: string }[];
};

function toPcMon(instance: PokemonRowSource): PcMon {
  return {
    id: instance.id,
    name: instance.nickname ?? instance.species.name,
    speciesName: instance.species.name,
    level: instance.level,
    spriteUrl: spriteFor(instance.species.spriteUrl, instance.isShiny),
    types: instance.species.types,
    currentHp: instance.currentHp,
    maxHp: calculateMaxHp(instance.species.baseHp, instance.level, instance.ptConstitution),
    listed: instance.listings.length > 0,
  };
}
