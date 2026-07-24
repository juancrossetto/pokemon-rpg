import Image from "next/image";
import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { typeColor } from "@/lib/type-colors";
import { calculateMaxHp, calculateStat, xpForLevel, xpToNextLevel } from "@/lib/stats";
import { healTeam } from "@/actions/heal-team";
import { redirectIfInBattle } from "@/lib/battle-lock";

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

  await redirectIfInBattle(session.user.id, locale);

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
  const healthyCount = pokemon.filter((p) => p.currentHp > 0).length;

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6 md:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-0.5 flex items-center gap-2 text-label-sm uppercase tracking-[0.2em] text-pokeball-red">
              <span className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
              {t("activeSquad")}
            </p>
            <h1 className="text-headline-lg text-white tracking-tight">{t("title")}</h1>
            <p className="mt-0.5 text-label-md text-on-surface-variant">
              {t("rosterSummary", { ready: healthyCount, total: pokemon.length })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form action={healTeam.bind(null, locale)}>
              <button
                type="submit"
                disabled={!needsHealing}
                className="inline-flex items-center gap-1.5 rounded-full bg-pokeball-red px-4 py-2 text-label-sm font-semibold text-white shadow-[0_6px_18px_rgba(238,21,21,0.25)] transition hover:bg-pokeball-red/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
              >
                <span className="material-symbols-outlined text-[16px]">healing</span>
                {t("autoHeal")}
              </button>
            </form>
            <Link
              href="/pc"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-label-sm text-on-surface transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              <span className="material-symbols-outlined text-[16px]">storage</span>
              {t("manage")}
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {slots.map((instance, i) =>
            instance ? (
              <PokemonCard
                key={instance.id}
                slot={i + 1}
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
                moves={instance.moves.map((m) => ({
                  name: m.move.name,
                  type: m.move.type,
                }))}
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
                  lead: t("lead"),
                  slot: (n: number) => t("slotLabel", { slot: n }),
                  fainted: t("fainted"),
                }}
              />
            ) : (
              <EmptySlot key={`empty-${i}`} slot={i + 1} label={t("emptySlot")} hint={t("slotAvailable", { slot: i + 1 })} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function PokemonCard({
  slot,
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
  slot: number;
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
  moves: { name: string; type: string }[];
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
    lead: string;
    slot: (n: number) => string;
    fainted: string;
  };
}) {
  const displayName = nickname ?? speciesName;
  const primaryType = types[0] ?? "normal";
  const accent = typeColor(primaryType);
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  const fainted = currentHp <= 0;
  const xpIntoLevel = xp - xpForCurrentLevel;
  const levelSpan = xpIntoLevel + xpToNext;
  const xpPct = levelSpan > 0 ? Math.max(0, Math.min(100, (xpIntoLevel / levelSpan) * 100)) : 0;

  return (
    <article
      className={`team-card group relative overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-0.5 ${
        isLead
          ? "border-pokeball-red/40 shadow-[0_12px_32px_rgba(238,21,21,0.12)]"
          : "border-white/[0.08] hover:border-white/20"
      } ${fainted ? "opacity-75" : ""}`}
      style={
        {
          "--type-accent": accent,
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute -top-16 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full opacity-35 blur-3xl transition-opacity duration-300 group-hover:opacity-55"
        style={{ background: accent }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/20" />

      <div className="relative flex flex-col p-3">
        <div className="mb-0.5 flex items-start justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant">
              {labels.slot(slot)}
            </span>
            {isLead && (
              <span className="rounded-full bg-pokeball-red px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                {labels.lead}
              </span>
            )}
            {fainted && (
              <span className="rounded-full bg-error/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-error">
                {labels.fainted}
              </span>
            )}
          </div>
          <span className="rounded-full border border-white/10 bg-black/25 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
            {labels.level(level)}
          </span>
        </div>

        <div className="relative mx-auto my-0.5 flex h-20 w-full items-center justify-center">
          <div
            className="absolute bottom-1 h-8 w-16 rounded-[100%] opacity-45 blur-lg"
            style={{ background: accent }}
          />
          {spriteUrl ? (
            <Image
              src={spriteUrl}
              alt={speciesName}
              width={80}
              height={80}
              className={`relative z-[1] h-20 w-20 object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] transition duration-300 group-hover:scale-105 ${
                fainted ? "grayscale" : ""
              }`}
            />
          ) : (
            <span className="material-symbols-outlined relative z-[1] text-[40px] text-on-surface-variant/40">
              catching_pokemon
            </span>
          )}
        </div>

        <div className="mb-2 text-center">
          <h2 className="truncate text-sm font-bold tracking-tight text-white capitalize leading-tight">
            {displayName}
          </h2>
          {nickname && (
            <p className="mt-0.5 text-[10px] capitalize text-on-surface-variant">{speciesName}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
            {types.map((type) => {
              const color = typeColor(type);
              return (
                <span
                  key={type}
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                  style={{
                    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                    boxShadow: `0 2px 8px ${color}33`,
                  }}
                >
                  {type}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mb-2 rounded-xl border border-white/[0.06] bg-black/25 px-2.5 py-2">
          <div className="mb-1 flex items-end justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
              {labels.hp}
            </span>
            <span className="font-mono text-[11px] font-semibold text-white">
              {currentHp}
              <span className="text-on-surface-variant">/{maxHp}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${hpBarClass(hpPct)}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
              {labels.exp}
            </span>
            <span className="truncate text-[9px] text-on-surface-variant">{labels.expToNext(xpToNext)}</span>
          </div>
          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-tertiary/80 to-tertiary"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        <div className="mb-2 grid grid-cols-5 gap-1">
          <StatChip label={labels.atk} value={atk} />
          <StatChip label={labels.def} value={def} />
          <StatChip label={labels.spAtk} value={spAtk} />
          <StatChip label={labels.spDef} value={spDef} />
          <StatChip label={labels.speed} value={speed} />
        </div>

        <div className="mt-auto grid grid-cols-2 gap-1">
          {moves.map((move) => {
            const color = typeColor(move.type);
            return (
              <div
                key={move.name}
                className="flex items-center justify-between gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-1.5 py-1"
              >
                <span className="truncate text-[10px] font-medium capitalize text-on-surface">
                  {move.name}
                </span>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  title={move.type}
                  style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
                />
              </div>
            );
          })}
        </div>

        {unspentPoints > 0 && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-tertiary/25 bg-tertiary/10 px-2 py-1.5">
            <span className="material-symbols-outlined text-[14px] text-tertiary">bolt</span>
            <span className="text-[10px] text-tertiary">{labels.unspentPoints(unspentPoints)}</span>
          </div>
        )}
      </div>
    </article>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-0.5 py-1 text-center">
      <p className="text-[8px] font-bold uppercase tracking-wide text-on-surface-variant leading-none">{label}</p>
      <p className="mt-0.5 font-mono text-[11px] font-semibold text-white leading-none">{value}</p>
    </div>
  );
}

function EmptySlot({ slot, label, hint }: { slot: number; label: string; hint: string }) {
  void slot;
  return (
    <article className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.015] px-4 py-6 text-center transition hover:border-white/20 hover:bg-white/[0.03]">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.02]">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant/50">add</span>
      </div>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="mt-0.5 text-[10px] text-on-surface-variant/60">{hint}</p>
    </article>
  );
}

function hpBarClass(pct: number): string {
  if (pct > 50) return "bg-gradient-to-r from-emerald-500 to-lime-400 shadow-[0_0_12px_rgba(74,222,128,0.45)]";
  if (pct > 20) return "bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.4)]";
  return "bg-gradient-to-r from-red-600 to-rose-400 shadow-[0_0_12px_rgba(248,113,113,0.45)]";
}
