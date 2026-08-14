"use client";

import Image from "next/image";
import { useState, useTransition, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  finishSafariRun,
  searchSafariEncounter,
  skipSafariEncounter,
  startSafariRun,
  throwSafariBall,
  type SafariActionResult,
} from "@/actions/safari";
import { spriteFor } from "@/lib/shiny";

type SpeciesPreview = { id: number; name: string; spriteUrl: string; rarity: string };
type SafariActionSuccess = Extract<SafariActionResult, { ok: true }>;

const SAFARI_ARTWORK_BY_BIOME: Record<string, string> = {
  verdant: "/safari/reserva-esmeralda-diorama.png",
  wetlands: "/safari/humedales-azules.png",
  badlands: "/safari/canon-ambar.png",
};

export type SafariViewData = {
  attemptsRemaining: number;
  attemptsMax: number;
  resetAt: string;
  biomes: Array<{
    id: string;
    accent: string;
    levelMin: number;
    levelMax: number;
    species: SpeciesPreview[];
  }>;
  activeRun: null | {
    id: string;
    biomeId: string;
    encountersUsed: number;
    encountersMax: number;
    ballsRemaining: number;
    catches: number;
    bestScore: number;
    best: null | { name: string; spriteUrl: string; level: number; isShiny: boolean };
    encounter: null | {
      name: string;
      spriteUrl: string;
      level: number;
      isShiny: boolean;
      rarity: string;
      catchChance: number;
    };
  };
  lastRun: null | {
    bestScore: number;
    rewardCoins: number;
    rewardGems: number;
    catches: number;
    best: null | { name: string; spriteUrl: string; level: number; isShiny: boolean };
  };
  leaderboard: Array<{
    rank: number;
    username: string;
    score: number;
    speciesName: string | null;
    isShiny: boolean;
  }>;
};

function displayName(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function SafariExpedition({ locale, data }: { locale: string; data: SafariViewData }) {
  const t = useTranslations("safari");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedBiome, setSelectedBiome] = useState(data.biomes[0]?.id ?? "verdant");

  function run(
    action: () => Promise<SafariActionResult>,
    success?: (result: SafariActionSuccess) => string,
  ) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setFeedback(t(`errors.${result.error}`));
        return;
      }
      if (success) setFeedback(success(result));
      router.refresh();
    });
  }

  const active = data.activeRun;
  const activeBiome = active ? data.biomes.find((biome) => biome.id === active.biomeId) : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-margin-mobile py-5 md:px-margin-desktop md:py-8">
      <section className="relative overflow-hidden rounded-[26px] border border-emerald-300/25 bg-[#07110e] px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:min-h-[13.5rem] md:px-7 md:py-5">
        <Image
          src="/safari/safari-banner.png"
          alt=""
          fill
          sizes="(min-width: 1152px) 1152px, 100vw"
          className="object-cover object-[68%_center] md:object-center"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,15,12,0.9)_0%,rgba(5,15,12,0.76)_54%,rgba(5,12,10,0.28)_100%)] md:bg-[linear-gradient(90deg,#07110e_0%,rgba(7,17,14,0.96)_45%,rgba(7,17,14,0.48)_72%,rgba(7,17,14,0.08)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,9,7,0.66)_0%,transparent_62%)]" />
        <div className="relative z-10 md:max-w-[74%]">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">{t("eyebrow")}</p>
          <h1 className="page-title mt-1.5 text-3xl text-white md:text-[2.6rem] md:leading-none">{t("title")}</h1>
          <p className="mt-2.5 text-xs leading-5 text-white/65 md:whitespace-nowrap">{t("subtitle")}</p>
        </div>
        <div className="relative z-10 mt-4 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Metric imageSrc="/safari/tickets/ticket-pink.png" value={`${data.attemptsRemaining}/${data.attemptsMax}`} label={t("attempts")} />
          <Metric imageSrc="/safari/metrics/clock.png" value={new Date(data.resetAt).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short" })} label={t("reset")} />
          <Metric imageSrc="/safari/metrics/encounters.png" value={active ? `${active.encountersUsed}/${active.encountersMax}` : "10"} label={t("encounters")} />
        </div>
      </section>

      {feedback ? (
        <div className="mt-4 rounded-xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-3 text-sm font-semibold text-fuchsia-100">{feedback}</div>
      ) : null}

      {active ? (
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-surface-container-low">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: activeBiome?.accent }}>{t(`biomes.${active.biomeId}.name`)}</p>
                <h2 className="mt-1 text-xl font-bold text-white">{active.encounter ? t("encounterTitle") : t("trailTitle")}</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-black text-white">
                <Image src="/items/hd/safari-ball.png" alt="" width={26} height={26} className="h-6 w-6 object-contain" />
                {active.ballsRemaining}
              </div>
            </div>

            {active.encounter ? (
              <div className="relative min-h-[390px] overflow-hidden px-5 py-6 md:px-7 md:py-7">
                <div className="absolute inset-0 opacity-50" style={{ background: `radial-gradient(circle at 28% 52%, ${activeBiome?.accent ?? "#64d98b"}42, transparent 30%), radial-gradient(circle at 72% 48%, ${activeBiome?.accent ?? "#64d98b"}16, transparent 42%)` }} />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="relative z-10 mx-auto grid min-h-[335px] max-w-3xl items-center gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-9">
                  <div className="relative mx-auto h-[190px] w-[190px] md:h-[220px] md:w-[220px]">
                    <div className="absolute inset-[16%] rounded-full border border-white/8" style={{ background: `${activeBiome?.accent ?? "#64d98b"}10`, boxShadow: `0 0 52px ${activeBiome?.accent ?? "#64d98b"}28` }} />
                    <div className="absolute inset-x-[17%] bottom-[7%] h-[10%] rounded-[50%] bg-black/75 blur-xl" />
                    <div className="safari-encounter-reveal absolute inset-0">
                      <Image src={spriteFor(active.encounter.spriteUrl, active.encounter.isShiny)} alt={displayName(active.encounter.name)} fill sizes="220px" className="object-contain p-2 drop-shadow-[0_20px_20px_rgba(0,0,0,0.55)]" unoptimized />
                    </div>
                  </div>
                  <div className="text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                      <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${active.encounter.isShiny ? "text-yellow-300" : "text-white/50"}`}>{active.encounter.isShiny ? "✦ SHINY" : t(`rarity.${active.encounter.rarity}`)}</span>
                      <span className="h-1 w-1 rounded-full bg-white/25" />
                      <span className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Lv. {active.encounter.level}</span>
                    </div>
                    <h3 className="page-title mt-2 text-[2rem] leading-none text-white md:text-[2.35rem]">{displayName(active.encounter.name)}</h3>
                    <div className="mt-4">
                      <div className="text-[11px] font-semibold text-white/48">
                        <span>{t("catchChance", { chance: active.encounter.catchChance })}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full" style={{ width: `${active.encounter.catchChance}%`, background: `linear-gradient(90deg, ${activeBiome?.accent ?? "#64d98b"}, #ffffff)` }} />
                      </div>
                    </div>
                    <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    <button disabled={pending || active.ballsRemaining <= 0} onClick={() => run(() => throwSafariBall(locale), (r) => r.caught ? t("caught", { score: r.score ?? 0 }) : t("escaped"))} className="game-cta game-cta--primary min-h-12 disabled:opacity-45">
                      <Image src="/items/hd/safari-ball.png" alt="" width={24} height={24} className="game-cta__icon object-contain" />
                      <span className="game-cta__label">{pending ? t("working") : t("throwBall")}</span>
                    </button>
                    <button disabled={pending} onClick={() => run(() => skipSafariEncounter(locale))} className="min-h-12 rounded-xl border border-white/12 bg-white/5 px-5 text-sm font-black text-white/75 transition hover:bg-white/10 disabled:opacity-45">{t("leave")}</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative min-h-[430px] overflow-hidden px-6 py-7">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_58%,rgba(250,204,21,0.11),transparent_30%),radial-gradient(circle_at_72%_45%,rgba(232,121,249,0.08),transparent_36%)]" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="relative z-10 mx-auto grid min-h-[370px] max-w-3xl items-center gap-2 md:grid-cols-[230px_minmax(0,1fr)] md:gap-8">
                  <div className="relative mx-auto h-[190px] w-[190px] md:h-[280px] md:w-[230px]" aria-hidden="true">
                    <div className="absolute inset-[18%] rounded-full bg-yellow-300/12 blur-3xl" />
                    <div className="absolute inset-x-[20%] bottom-[3%] h-[8%] rounded-[50%] bg-black/75 blur-lg" />
                    <div className="safari-search-guide absolute inset-0">
                      <Image
                        src="/safari/pikachu-intro.png"
                        alt=""
                        fill
                        priority
                        sizes="(min-width: 768px) 230px, 190px"
                        className="object-contain drop-shadow-[0_22px_22px_rgba(0,0,0,0.55)]"
                      />
                    </div>
                  </div>
                  <div className="max-w-md text-center md:text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: activeBiome?.accent }}>{t("trailTitle")}</p>
                    <h3 className="page-title mt-2 text-2xl leading-tight text-white md:text-[2rem]">{t("searchTitle")}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/55">{t("searchDescription")}</p>
                    <button disabled={pending || active.encountersUsed >= active.encountersMax} onClick={() => run(() => searchSafariEncounter(locale))} className="game-cta game-cta--primary mt-5 min-h-12 w-full disabled:opacity-45">
                      <span className="game-cta__icon material-symbols-outlined">footprint</span>
                      <span className="game-cta__label">{pending ? t("working") : t("search")}</span>
                    </button>
                    <button disabled={pending} onClick={() => run(() => finishSafariRun(locale))} className="mt-3 text-xs font-bold text-white/45 underline-offset-4 hover:text-white hover:underline">{t("finishEarly")}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[22px] border border-white/10 bg-surface-container-low p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">{t("runProgress")}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${(active.encountersUsed / active.encountersMax) * 100}%` }} /></div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <SmallStat value={active.encountersUsed} label={t("seen")} />
                <SmallStat value={active.catches} label={t("captures")} />
                <SmallStat value={active.ballsRemaining} label={t("balls")} />
              </div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-surface-container-low p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">{t("bestCatch")}</p>
              {active.best ? <BestCatch best={active.best} score={active.bestScore} /> : <p className="mt-4 text-sm text-white/45">{t("noBest")}</p>}
            </div>
            <div className="rounded-[22px] border border-amber-300/15 bg-amber-300/5 p-5 text-sm leading-6 text-white/58">
              <span className="material-symbols-outlined mr-2 align-middle text-[18px]! text-amber-300">lightbulb</span>{t("tip")}
            </div>
          </aside>
        </section>
      ) : (
        <section className="mt-5">
          {data.lastRun ? <LastResult run={data.lastRun} /> : null}
          <div className="mt-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">{t("chooseEyebrow")}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{t("chooseBiome")}</h2>
            <p className="mt-2 text-xs text-white/45">{t("weeklyLimit", { count: data.attemptsMax })}</p>
          </div>
          <div className="mt-6 grid gap-x-7 gap-y-10 sm:grid-cols-2 md:mt-8 md:grid-cols-3 lg:gap-x-10">
            {data.biomes.map((biome, index) => {
              const selected = selectedBiome === biome.id;
              const artwork = SAFARI_ARTWORK_BY_BIOME[biome.id];
              return (
                <button
                  key={biome.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedBiome(biome.id)}
                  className={`safari-biome-option group relative flex min-w-0 flex-col items-center text-center outline-none transition duration-500 ${selected ? "is-selected" : "opacity-70 hover:opacity-100"}`}
                  style={{ "--safari-biome-accent": biome.accent } as CSSProperties}
                >
                  <div className="relative h-[205px] w-full sm:h-[220px] lg:h-[245px]">
                    <div className="safari-biome-option__aura absolute inset-[16%] rounded-full blur-3xl" />
                    <div className="safari-biome-option__shadow absolute inset-x-[15%] bottom-[4%] h-[10%] rounded-[50%] bg-black/80 blur-xl" />
                    {artwork ? (
                      <div
                        className="safari-zone-artwork absolute inset-0"
                        style={{ animationDelay: `${index * -1.35}s` }}
                      >
                        <Image
                          src={artwork}
                          alt=""
                          fill
                          priority
                          sizes="(min-width: 1024px) 350px, (min-width: 640px) 45vw, 92vw"
                          className="object-contain drop-shadow-[0_22px_20px_rgba(0,0,0,0.62)] transition duration-500 group-hover:scale-[1.035]"
                        />
                      </div>
                    ) : null}
                  </div>
                  <h3
                    className="page-title safari-biome-option__name -mt-1 bg-clip-text text-[clamp(1.15rem,2vw,1.5rem)] leading-none text-transparent drop-shadow-[0_4px_12px_rgba(0,0,0,0.72)]"
                    style={{ backgroundImage: `linear-gradient(135deg, #ffffff 8%, ${biome.accent} 55%, #ffffff 118%)` }}
                  >
                    {t(`biomes.${biome.id}.name`)}
                  </h3>
                  <p className="mt-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Lv. {biome.levelMin}–{biome.levelMax}</p>
                  <div className="mt-3 flex max-w-full flex-wrap justify-center -space-x-1.5 px-2">
                    {biome.species.map((species) => (
                      <span key={species.id} className="relative h-10 w-10 rounded-full border border-white/12 bg-black/35 transition duration-300 group-hover:-translate-y-0.5">
                        <Image src={species.spriteUrl} alt="" fill sizes="40px" className="object-contain p-1" unoptimized />
                      </span>
                    ))}
                  </div>
                  <span className={`mt-3 h-1 rounded-full transition-all duration-500 ${selected ? "w-16 opacity-100" : "w-0 opacity-0"}`} style={{ background: biome.accent, boxShadow: `0 0 16px ${biome.accent}` }} />
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex justify-center">
            <button disabled={pending || data.attemptsRemaining <= 0} onClick={() => run(() => startSafariRun(locale, selectedBiome))} className="game-cta game-cta--safari min-h-13 w-full max-w-md disabled:opacity-45"><span className="game-cta__icon material-symbols-outlined">explore</span><span className="game-cta__label">{data.attemptsRemaining <= 0 ? t("noAttempts") : pending ? t("working") : t("start")}</span></button>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-[22px] border border-white/10 bg-surface-container-low p-5">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300">{t("rankingEyebrow")}</p><h2 className="mt-1 text-xl font-black text-white">{t("rankingTitle")}</h2></div>
        <div className="mt-4 divide-y divide-white/7">{data.leaderboard.length ? data.leaderboard.map((row) => <div key={`${row.rank}-${row.username}`} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 py-3"><span className={`font-mono text-sm font-black ${row.rank <= 3 ? "text-amber-300" : "text-white/35"}`}>#{row.rank}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{row.username}</p><p className="truncate text-[11px] text-white/40">{row.speciesName ? `${displayName(row.speciesName)}${row.isShiny ? " ✦" : ""}` : "—"}</p></div><span className="font-mono text-sm font-black text-emerald-300">{row.score}</span></div>) : <p className="py-5 text-center text-sm text-white/40">{t("rankingEmpty")}</p>}</div>
      </section>
    </main>
  );
}

function Metric({ icon, imageSrc, value, label }: { icon?: string; imageSrc?: string; value: string; label: string }) { return <div className="inline-flex items-center gap-2">{imageSrc ? <Image src={imageSrc} alt="" width={30} height={30} className="h-7 w-7 shrink-0 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.45)]" /> : <span className="material-symbols-outlined text-[18px]! text-emerald-300">{icon}</span>}<div><p className="font-mono text-xs font-black text-white">{value}</p><p className="text-[9px] font-bold uppercase tracking-wider text-white/40">{label}</p></div></div>; }
function SmallStat({ value, label }: { value: number; label: string }) { return <div className="rounded-xl bg-black/20 px-2 py-3"><p className="font-mono text-lg font-black text-white">{value}</p><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{label}</p></div>; }
function BestCatch({ best, score }: { best: { name: string; spriteUrl: string; level: number; isShiny: boolean }; score: number }) { return <div className="mt-3 flex items-center gap-3"><span className="relative h-16 w-16 shrink-0 rounded-2xl bg-black/25"><Image src={spriteFor(best.spriteUrl, best.isShiny)} alt="" fill sizes="64px" className="object-contain p-1" unoptimized /></span><div className="min-w-0"><p className="truncate font-bold text-white">{displayName(best.name)} {best.isShiny ? <span className="text-yellow-300">✦</span> : null}</p><p className="text-xs text-white/45">Lv. {best.level}</p><p className="mt-1 font-mono text-lg font-black text-emerald-300">{score} pts</p></div></div>; }
function LastResult({ run }: { run: NonNullable<SafariViewData["lastRun"]> }) { const t = useTranslations("safari"); return <div className="rounded-[22px] border border-emerald-300/20 bg-emerald-300/6 p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">{t("lastResult")}</p><p className="mt-1 text-2xl font-black text-white">{run.bestScore} pts</p><p className="mt-1 text-sm text-white/50">{t("lastSummary", { catches: run.catches })}</p></div><div className="flex items-center gap-4">{run.best ? <BestCatch best={run.best} score={run.bestScore} /> : null}<div className="rounded-xl bg-black/25 px-4 py-3 text-right"><p className="text-xs font-bold text-white/40">{t("reward")}</p><p className="font-mono font-black text-amber-300">+{run.rewardCoins} ●</p>{run.rewardGems ? <p className="font-mono text-sm font-black text-fuchsia-300">+{run.rewardGems} ◆</p> : null}</div></div></div></div>; }
