import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { BattleHistoryList, type BattleHistoryEntry } from "@/components/battle/battle-history-list";

export default async function BattleHistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [session, t] = await Promise.all([auth(), getTranslations("battleHistory")]);
  if (!session?.user) { redirect({ href: "/login", locale }); return null; }
  await redirectIfInBattle(session.user.id, locale);

  const rows = await prisma.battleSession.findMany({
    where: { userId: session.user.id, status: { not: "ACTIVE" } },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: {
      pokemonInstance: { include: { species: true } },
      wildSpecies: true,
      opponentUser: { select: { username: true } },
      gym: { select: { name: true } },
    },
  });
  const participantIds = [...new Set(rows.flatMap((row) => [row.pokemonInstanceId, ...row.participantIds]))];
  const participantRows = await prisma.pokemonInstance.findMany({
    where: { ownerId: session.user.id, id: { in: participantIds } },
    include: { species: true },
  });
  const participantsById = new Map(participantRows.map((member) => [member.id, member]));
  const entries: BattleHistoryEntry[] = rows.map((row) => ({
    id: row.id,
    status: row.status as BattleHistoryEntry["status"],
    mode: row.pvpMatchId ? "pvp" : row.towerRunId ? "tower" : row.gymId ? "gym" : "wild",
    createdAt: row.updatedAt.toISOString(),
    player: {
      name: row.pokemonInstance.nickname ?? row.pokemonInstance.species.name,
      speciesName: row.pokemonInstance.species.name,
      spriteUrl: row.pokemonInstance.species.spriteUrl,
      isShiny: row.pokemonInstance.isShiny,
      level: row.pokemonInstance.level,
    },
    foe: {
      name: row.opponentUser?.username ?? row.gym?.name ?? row.wildSpecies.name,
      speciesName: row.wildSpecies.name,
      spriteUrl: row.wildSpecies.spriteUrl,
      isShiny: row.wildIsShiny,
      level: row.wildLevel,
    },
    participants: [...new Set([row.pokemonInstanceId, ...row.participantIds])].flatMap((id) => {
      const member = participantsById.get(id);
      return member ? [{ id, speciesName: member.species.name, spriteUrl: member.species.spriteUrl, isShiny: member.isShiny }] : [];
    }),
    ...summarizeLog(
      row.log,
      row.pokemonInstance.nickname ?? row.pokemonInstance.species.name,
      row.wildSpecies.name,
    ),
    log: row.log,
  }));

  return <main className="flex-1 px-margin-mobile py-5 md:px-margin-desktop md:py-8"><div className="mx-auto max-w-4xl"><header className="mb-5"><p className="text-[11px] font-black uppercase tracking-[.18em] text-primary">{t("eyebrow")}</p><h1 className="page-title mt-1 text-headline-lg text-white md:text-display-sm">{t("title")}</h1><p className="mt-1 text-sm text-on-surface-variant">{t("subtitle")}</p></header><BattleHistoryList entries={entries} locale={locale} /></div></main>;
}

function summarizeLog(log: string[], playerName: string, foeName: string) {
  let attacker = "";
  let damageDealt = 0;
  let damageTaken = 0;
  const items = new Set<string>();
  for (const line of log) {
    if (line.startsWith("used:")) attacker = line.split(":")[1] ?? "";
    if (line.startsWith("item:")) items.add(line.slice(5));
    if (!line.startsWith("damage:")) continue;
    const amount = Number(line.split(":").at(-1));
    if (!Number.isFinite(amount)) continue;
    if (attacker === playerName) damageDealt += amount;
    else if (attacker === foeName || attacker) damageTaken += amount;
  }
  return { damageDealt, damageTaken, items: [...items] };
}
