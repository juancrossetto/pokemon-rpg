import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { typeColor } from "@/lib/type-colors";
import { calculateMaxHp, calculateStat, xpForLevel, xpToNextLevel } from "@/lib/stats";
import { healTeam } from "@/actions/heal-team";

const TEAM_SIZE = 6;

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, session] = await Promise.all([getTranslations("team"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const pokemon = await prisma.pokemonInstance.findMany({
    where: { ownerId: session.user.id, teamSlot: { not: null } },
    include: { species: true, moves: { include: { move: true }, orderBy: { slot: "asc" } } },
    orderBy: { teamSlot: "asc" },
  });

  if (pokemon.length === 0) {
    redirect({ href: "/starter", locale });
    return null;
  }

  const bySlot = new Map(pokemon.map((p) => [p.teamSlot, p]));
  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => bySlot.get(i + 1) ?? null);
  const needsHealing = pokemon.some(
    (p) => p.currentHp < calculateMaxHp(p.species.baseHp, p.level),
  );

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-6">
          <div>
            <h1 className="text-headline-lg md:text-display-lg text-white">{t("title")}</h1>
            <p className="text-label-md text-on-surface-variant mt-1">
              {t("systemStatus")}:{" "}
              <span className="text-tertiary">{t("statusOptimal")}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/pc"
              className="bg-glass-surface border border-white/10 px-4 py-1.5 rounded hover:bg-white/10 transition-all text-on-surface text-label-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">storage</span>
              {t("openPc")}
            </Link>
            <form action={healTeam.bind(null, locale)}>
              <button
                type="submit"
                disabled={!needsHealing}
                className="bg-glass-surface border border-white/10 px-4 py-1.5 rounded hover:bg-white/10 transition-all text-on-surface text-label-md flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">autorenew</span>
                {t("autoHeal")}
              </button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {slots.map((instance, i) =>
            instance ? (
              <PokemonCard
                key={instance.id}
                isLead={i === 0}
                nickname={instance.nickname}
                speciesName={instance.species.name}
                level={instance.level}
                types={instance.species.types}
                spriteUrl={instance.species.spriteUrl}
                currentHp={instance.currentHp}
                maxHp={calculateMaxHp(instance.species.baseHp, instance.level)}
                xp={instance.xp}
                xpForCurrentLevel={xpForLevel(instance.level)}
                xpToNext={xpToNextLevel(instance.xp, instance.level)}
                atk={calculateStat(instance.species.baseAttack, instance.ptStrength, instance.level)}
                def={calculateStat(instance.species.baseDefense, instance.ptDexterity, instance.level)}
                spAtk={calculateStat(instance.species.baseSpAtk, instance.ptIntelligence, instance.level)}
                spDef={calculateStat(instance.species.baseSpDef, instance.ptIntelligence, instance.level)}
                speed={calculateStat(instance.species.baseSpeed, instance.ptSpeed, instance.level)}
                unspentPoints={instance.unspentPoints}
                moves={instance.moves.map((m) => ({ name: m.move.name, type: m.move.type, pp: m.move.pp }))}
                labels={{
                  hp: t("stats.hp"),
                  exp: t("stats.exp"),
                  expToNext: (n: number) => t("expToNext", { xp: n }),
                  atk: t("stats.atk"),
                  def: t("stats.def"),
                  spAtk: t("stats.spAtk"),
                  spDef: t("stats.spDef"),
                  speed: t("stats.speed"),
                  level: (lvl: number) => t("level", { level: lvl }),
                  unspentPoints: (n: number) => t("unspentPoints", { count: n }),
                  heldItem: t("heldItem"),
                  noItem: t("noItem"),
                  moves: t("moves"),
                }}
              />
            ) : (
              <article
                key={`empty-${i}`}
                className="bg-glass-surface backdrop-blur-xl border border-white/5 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-on-surface-variant min-h-[350px]"
              >
                <span className="material-symbols-outlined text-[48px] mb-2 opacity-50">
                  add_circle
                </span>
                <span className="text-label-md">{t("emptySlot")}</span>
                <span className="text-label-sm opacity-50 mt-1">
                  {t("slotAvailable", { slot: i + 1 })}
                </span>
              </article>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function PokemonCard({
  isLead,
  nickname,
  speciesName,
  level,
  types,
  spriteUrl,
  currentHp,
  maxHp,
  xp,
  xpForCurrentLevel,
  xpToNext,
  atk,
  def,
  spAtk,
  spDef,
  speed,
  unspentPoints,
  moves,
  labels,
}: {
  isLead: boolean;
  nickname: string | null;
  speciesName: string;
  level: number;
  types: string[];
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
  xp: number;
  xpForCurrentLevel: number;
  xpToNext: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
  unspentPoints: number;
  moves: { name: string; type: string; pp: number }[];
  labels: {
    hp: string;
    exp: string;
    expToNext: (n: number) => string;
    atk: string;
    def: string;
    spAtk: string;
    spDef: string;
    speed: string;
    level: (lvl: number) => string;
    unspentPoints: (n: number) => string;
    heldItem: string;
    noItem: string;
    moves: string;
  };
}) {
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  const hpClass = hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red";
  const xpIntoLevel = xp - xpForCurrentLevel;
  const levelSpan = xpIntoLevel + xpToNext;
  const xpPct = levelSpan > 0 ? Math.max(0, Math.min(100, (xpIntoLevel / levelSpan) * 100)) : 0;

  return (
    <article
      className={`bg-glass-surface backdrop-blur-xl rounded-xl p-4 relative overflow-hidden ${
        isLead
          ? "border border-pokeball-red/50 shadow-[0_0_30px_rgba(238,21,21,0.15)]"
          : "border border-white/10"
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 items-center">
          <div
            className={`w-12 h-12 rounded-full bg-surface-container-high border-2 flex items-center justify-center overflow-hidden ${
              isLead ? "border-primary" : "border-surface-variant"
            }`}
          >
            {spriteUrl && (
              <Image src={spriteUrl} alt={speciesName} width={48} height={48} className="w-full h-full object-cover" />
            )}
          </div>
          <div>
            <h2 className="text-headline-md text-on-surface leading-tight capitalize">
              {nickname ?? speciesName}
            </h2>
            <span className={`text-label-sm ${isLead ? "text-primary" : "text-on-surface-variant"}`}>
              {labels.level(level)}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {types.map((type) => {
            const color = typeColor(type);
            return (
              <span
                key={type}
                className="px-2 py-1 rounded text-label-sm border uppercase"
                style={{ backgroundColor: `${color}33`, color, borderColor: `${color}55` }}
              >
                {type}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-label-sm mb-1">
          <span className="text-on-surface-variant">{labels.hp}</span>
          <span className="text-on-surface">
            {currentHp} / {maxHp}
          </span>
        </div>
        <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
          <div className={`h-full health-bar-fill ${hpClass}`} style={{ width: `${hpPct}%` }} />
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-label-sm mb-1">
          <span className="text-on-surface-variant">{labels.exp}</span>
          <span className="text-on-surface-variant">{labels.expToNext(xpToNext)}</span>
        </div>
        <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
          <div className="h-full bg-tertiary" style={{ width: `${xpPct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-label-sm bg-surface-container/50 p-2 rounded border border-white/5">
        <div className="flex justify-between">
          <span className="text-on-surface-variant">{labels.atk}</span>
          <span className="text-on-surface">{atk}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">{labels.spAtk}</span>
          <span className="text-on-surface">{spAtk}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">{labels.def}</span>
          <span className="text-on-surface">{def}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">{labels.spDef}</span>
          <span className="text-on-surface">{spDef}</span>
        </div>
        <div className="flex justify-between col-span-2 border-t border-white/10 pt-1 mt-1">
          <span className="text-on-surface-variant">{labels.speed}</span>
          <span className="text-on-surface">{speed}</span>
        </div>
      </div>

      <div className="mt-2">
        <span className="text-label-sm text-on-surface-variant">{labels.moves}</span>
        <div className="flex flex-col gap-1 mt-1">
          {moves.map((move) => {
            const color = typeColor(move.type);
            return (
              <div
                key={move.name}
                className="flex justify-between items-center gap-2 px-2 py-1 rounded border bg-surface-container/50"
                style={{ borderColor: `${color}55` }}
              >
                <span className="text-label-sm text-on-surface capitalize">{move.name}</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] uppercase shrink-0"
                  style={{ backgroundColor: `${color}33`, color }}
                >
                  {move.type}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 bg-surface-container-low p-2 rounded border border-white/5">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">diamond</span>
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant text-[10px]">{labels.heldItem}</span>
          <span className="text-label-md text-on-surface-variant leading-none">{labels.noItem}</span>
        </div>
      </div>

      {unspentPoints > 0 && (
        <div className="mt-2 flex items-center gap-2 bg-tertiary/10 p-2 rounded border border-tertiary/30">
          <span className="material-symbols-outlined text-tertiary text-[20px]">bolt</span>
          <span className="text-label-md text-tertiary leading-none">
            {labels.unspentPoints(unspentPoints)}
          </span>
        </div>
      )}
    </article>
  );
}
